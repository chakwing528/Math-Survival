// ==============================================================================
// 3D 資產載入：GLTF 模型 (喪屍 / 士兵 / 槍械 / 植物)
// 模型來源：Quaternius (poly.pizza, CC-BY 3.0)
// ==============================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const BASE = 'assets/models/';

// 檔名清單 (下載自 poly.pizza，見 assets/models/credits.txt)
const MANIFEST = {
    // 有骨骼動畫嘅角色
    zombie_b: 'zombie_b.glb',       // Tier 1
    zombie_a: 'zombie_a.glb',       // Tier 2
    zombie_c: 'zombie_c.glb',       // Tier 3
    zombie_anim: 'zombie_anim.glb', // Tier 4 + 喪屍王
    soldier: 'soldier.glb',         // 玩家
    // 槍械 (Lv.1-9 對應)
    gun_pistol: 'gun_pistol.glb',
    gun_revolver: 'gun_revolver.glb',
    gun_9mm: 'gun_9mm.glb',
    gun_smg: 'gun_smg.glb',
    gun_shotgun: 'gun_shotgun.glb',
    gun_rifle: 'gun_rifle.glb',
    gun_scifi: 'gun_scifi.glb',
    gun_sniper: 'gun_sniper.glb',
    // 植物 / 岩石
    pine1: 'pine1.glb', pine2: 'pine2.glb',
    twisted1: 'twisted1.glb', twisted2: 'twisted2.glb',
    rock1: 'rock1.glb', rock2: 'rock2.glb',
    plant: 'plant.glb', plant_big: 'plant_big.glb',
    grass1: 'grass1.glb', tallgrass: 'tallgrass.glb', small_plant: 'small_plant.glb'
};

// 武器等級 → 槍模型 key (第 9 級用 scifi 加紅色發光做「神話」感)
export const GUN_BY_LEVEL = [
    'gun_pistol', 'gun_revolver', 'gun_9mm', 'gun_smg', 'gun_shotgun',
    'gun_rifle', 'gun_scifi', 'gun_sniper', 'gun_scifi'
];

export const ASSETS = {}; // key → { scene, animations, animMap, height, minY, length }

let loadPromise = null;

// 由動畫名稱堆入面搵出標準動作 (各模型命名唔同)
function buildAnimMap(animations) {
    const find = (re) => animations.find(a => re.test(a.name)) || null;
    return {
        idle: find(/idle(?!_)/i) || find(/idle/i),
        walk: find(/walk/i),
        run: find(/run_gun/i) || find(/(^|\|)run$/i) || find(/run(?!_)/i) || find(/run/i),
        attack: find(/attack|bite|punch/i),
        death: find(/death/i),
        hit: find(/hit/i),
        shoot: find(/shoot/i)
    };
}

let assetsReady = false;

export function loadAssets(onProgress) {
    // 已成功載入 → 即刻回傳；載入中 → 沿用同一 promise
    if (assetsReady) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
        const loader = new GLTFLoader();
        const keys = Object.keys(MANIFEST);
        let done = 0;
        await Promise.all(keys.map(async (key) => {
            const gltf = await loader.loadAsync(BASE + MANIFEST[key]);
            // 角色模型要用「骨骼變形後」嘅真實 bbox (幾何 bbox 同渲染尺寸可以差幾十倍)
            gltf.scene.updateMatrixWorld(true);
            const box = new THREE.Box3();
            let hasSkinned = false;
            gltf.scene.traverse(o => {
                if (o.isSkinnedMesh) {
                    hasSkinned = true;
                    o.computeBoundingBox();
                    box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
                }
            });
            if (!hasSkinned) box.setFromObject(gltf.scene);
            const size = new THREE.Vector3();
            box.getSize(size);
            // Skinned mesh 郁動時會走出原本 bbox，關閉視錐剔除避免消失
            gltf.scene.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; });
            ASSETS[key] = {
                scene: gltf.scene,
                animations: gltf.animations,
                animMap: buildAnimMap(gltf.animations),
                height: size.y || 1,
                minY: box.min.y,
                length: Math.max(size.x, size.z) || 1
            };
            done++;
            if (onProgress) onProgress(done, keys.length);
        }));
        assetsReady = true;
    })().catch(err => {
        // 載入失敗 (通常係網絡中斷)：清走快取，令下次可以重試而唔係卡死
        loadPromise = null;
        throw err;
    });
    return loadPromise;
}

// 複製角色模型 (含骨骼)；縮放至指定高度、腳貼地
export function cloneCharacter(key, targetHeight) {
    const asset = ASSETS[key];
    const model = SkeletonUtils.clone(asset.scene);
    const s = targetHeight / asset.height;
    model.scale.setScalar(s);
    model.position.y = -asset.minY * s;
    return { model, asset, scale: s };
}

// 複製靜態模型；縮放至指定高度 (uniform)
export function cloneProp(key, targetHeight) {
    const asset = ASSETS[key];
    const model = asset.scene.clone(true);
    const s = targetHeight / asset.height;
    model.scale.setScalar(s);
    model.position.y = -asset.minY * s;
    return model;
}

// 複製槍械模型；縮放至指定長度，槍口指向 -Z (符合遊戲慣例)
export function cloneGun(key, targetLength) {
    const asset = ASSETS[key];
    const model = asset.scene.clone(true);
    const s = targetLength / asset.length;
    const wrap = new THREE.Group();
    model.scale.setScalar(s);
    // 原模型槍管沿 +X → 轉去 -Z
    model.rotation.y = Math.PI / 2;
    // 置中
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.sub(center);
    wrap.add(model);
    // 槍口空物件 (喺 -Z 前端)
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, box.min.z - center.z - 0.02);
    wrap.add(muzzle);
    wrap.userData.muzzle = muzzle;
    return wrap;
}

// 將材質複製並染色 (俾唔同等級喪屍變色)；回傳所有材質供受擊閃白用
export function tintModel(model, tintHex, tintAmount) {
    const mats = [];
    const tint = new THREE.Color(tintHex);
    model.traverse(o => {
        if (o.isMesh || o.isSkinnedMesh) {
            const src = Array.isArray(o.material) ? o.material : [o.material];
            const cloned = src.map(m => {
                const c = m.clone();
                if (c.color && tintAmount > 0) c.color.lerp(tint, tintAmount);
                mats.push(c);
                return c;
            });
            o.material = Array.isArray(o.material) ? cloned : cloned[0];
        }
    });
    return mats;
}
