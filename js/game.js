// ==============================================================================
// FPS 遊戲引擎 (Three.js)：場景 / 玩家控制 / 武器 / 魔物 AI / 寶箱 / HUD / 小地圖
// ==============================================================================

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { WEAPONS, MONSTER_BASE, SETTINGS, DIFF_MULT, DIFF_LABELS } from './config.js?v=37';
import { playSfx, sfxZombieGrowl, sfxZombieAttack, sfxZombieDeath, sfxBossRoar, sfxCorrect, sfxWrong, sfxLevelUp, sfxHeartbeat, sfxVictory, sfxPanSwing, sfxPanClang } from './audio.js?v=37';
import { showMathQuestion } from './math.js?v=37';
import { ASSETS, GUN_BY_LEVEL, cloneCharacter, cloneProp, cloneGun, tintModel } from './assets.js?v=37';
import { buildSchool, COURT_HX, COURT_HZ, BUILD_HX, BUILD_HZ } from './school.js?v=37';
import { getQuality, downgradeQuality, isTouchMode } from './device.js?v=37';
import { GAME_STATES, GameStateMachine, InputController, TouchControlSurface } from './input.js?v=37';

// 喪屍等級 → 模型
const ZOMBIE_BY_TIER = { 1: 'zombie_b', 2: 'zombie_a', 3: 'zombie_c', 4: 'zombie_anim', 5: 'zombie_anim' };
// 等級染色 (輕微，保留原本貼圖質感)
const TIER_TINT = { 1: null, 2: 0xffa04d, 3: 0xf5d442, 4: 0x7ec850, 5: 0xb26bff };

// 場景模式：'nature' = 草地樹木 (預設) | 'school' = 明愛聖若瑟五層校舍
// 想切換返學校場景，改呢個字做 'school' 即可 (學校代碼完整保留)
const SCENE_MODE = 'nature';

const ARENA = 130;           // 競技場邊長 (擴大戰場)
const HALF = ARENA / 2;
const WALL_H = 7;
const EYE_HEIGHT = 1.7;
const PICKUP_LIFETIME = 12;  // 寶箱存活秒數
const PICKUP_RADIUS = 3.2;   // 互動距離 (按 F 開箱)
const FREEZE_AFTER_MATH = 1.5;
const RAGE_DURATION = 5;     // 答錯後魔物狂暴秒數

// 圍牆收縮階段 (草地場景)：等待秒數 / 收縮秒數 / 目標半邊長
const WALL_PHASES = [
    { wait: 35, shrink: 25, hx: 46 },
    { wait: 28, shrink: 20, hx: 30 },
    { wait: 24, shrink: 18, hx: 18 },
    { wait: 20, shrink: 14, hx: 11 }
];

// 藍圈 (縮圈) 階段設定：等待秒數 / 收縮秒數 / 目標半徑 / 圈外每秒傷害
const ZONE_PHASES = [
    { wait: 30, shrink: 25, radius: 32, dps: 2 },
    { wait: 25, shrink: 20, radius: 21, dps: 4 },
    { wait: 20, shrink: 18, radius: 13, dps: 7 },
    { wait: 20, shrink: 15, radius: 7,  dps: 12 }
];
const ZONE_START_RADIUS = 68;

// ------------------------------------------------------------------ 粒子爆發
class Burst {
    constructor(scene, pos, colorHex, count, speed, opts = {}) {
        this.scene = scene;
        this.maxLife = opts.life || 0.7;
        this.life = this.maxLife;
        this.gravity = opts.gravity !== undefined ? opts.gravity : 12;
        const positions = new Float32Array(count * 3);
        this.velocities = [];
        for (let i = 0; i < count; i++) {
            positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
            let dir;
            if (opts.upward) {
                dir = new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.7 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5).normalize();
            } else {
                dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
            }
            this.velocities.push(dir.multiplyScalar(speed * (0.4 + Math.random())));
        }
        this.geo = new THREE.BufferGeometry();
        this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.mat = new THREE.PointsMaterial({ color: colorHex, size: opts.size || 0.22, transparent: true, depthWrite: false });
        this.points = new THREE.Points(this.geo, this.mat);
        scene.add(this.points);
    }
    update(dt) {
        this.life -= dt;
        if (this.life <= 0) return false;
        const arr = this.geo.attributes.position.array;
        for (let i = 0; i < this.velocities.length; i++) {
            const v = this.velocities[i];
            arr[i * 3] += v.x * dt; arr[i * 3 + 1] += v.y * dt; arr[i * 3 + 2] += v.z * dt;
            v.y -= this.gravity * dt;
        }
        this.geo.attributes.position.needsUpdate = true;
        this.mat.opacity = this.life / this.maxLife;
        return true;
    }
    dispose() {
        this.scene.remove(this.points);
        this.geo.dispose(); this.mat.dispose();
    }
}

// ------------------------------------------------------------------ SAO 式格仔解體爆破
// 鮮艷發光立方碎片向外爆散 + 自轉 + 縮小淡出 (刀劍神域死亡特效)
const SAO_PALETTE = [0x00e5ff, 0x40c4ff, 0x18ffff, 0x80d8ff, 0xffffff, 0x4afff0];
class ShatterBurst {
    constructor(scene, pos, baseColorHex, count, spread) {
        this.scene = scene;
        this.maxLife = 1.1;
        this.life = this.maxLife;
        this.geo = new THREE.BoxGeometry(1, 1, 1);
        this.mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        this.mesh = new THREE.InstancedMesh(this.geo, this.mat, count);
        this.mesh.frustumCulled = false;
        this.parts = [];
        const base = new THREE.Color(baseColorHex);
        const col = new THREE.Color();
        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
            const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6 + 0.1, Math.random() - 0.5).normalize();
            const speed = spread * (0.5 + Math.random());
            const size = 0.18 + Math.random() * 0.35;
            this.parts.push({
                x: pos.x, y: pos.y, z: pos.z,
                vx: dir.x * speed, vy: dir.y * speed + spread * 0.3, vz: dir.z * speed,
                rx: Math.random() * Math.PI, ry: Math.random() * Math.PI, rz: Math.random() * Math.PI,
                rvx: (Math.random() - 0.5) * 12, rvy: (Math.random() - 0.5) * 12, rvz: (Math.random() - 0.5) * 12,
                size
            });
            // 七成鮮艷 SAO 藍青，三成怪物原色 (更鮮艷)
            if (Math.random() < 0.7) col.setHex(SAO_PALETTE[Math.floor(Math.random() * SAO_PALETTE.length)]);
            else { col.copy(base); col.offsetHSL(0, 0.3, 0.15); }
            this.mesh.setColorAt(i, col);
            dummy.position.set(pos.x, pos.y, pos.z);
            dummy.scale.setScalar(size);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }
        this.mesh.instanceColor.needsUpdate = true;
        this.mesh.instanceMatrix.needsUpdate = true;
        this._dummy = dummy;
        scene.add(this.mesh);
    }
    update(dt) {
        this.life -= dt;
        if (this.life <= 0) return false;
        const k = this.life / this.maxLife;
        this.mat.opacity = Math.min(1, k * 1.4);
        const dummy = this._dummy;
        for (let i = 0; i < this.parts.length; i++) {
            const p = this.parts[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            p.vy -= 14 * dt;              // 重力
            p.vx *= 0.96; p.vz *= 0.96;   // 空氣阻力
            p.rx += p.rvx * dt; p.ry += p.rvy * dt; p.rz += p.rvz * dt;
            dummy.position.set(p.x, p.y, p.z);
            dummy.rotation.set(p.rx, p.ry, p.rz);
            dummy.scale.setScalar(p.size * (0.3 + k * 0.7)); // 慢慢縮細
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        return true;
    }
    dispose() {
        this.scene.remove(this.mesh);
        this.geo.dispose(); this.mat.dispose();
    }
}

// ------------------------------------------------------------------ 主遊戲類別
export class Game {
    constructor({ difficulty, container, onGameOver, onAbort }) {
        this.difficulty = difficulty;
        this.container = container;
        this.onGameOver = onGameOver;
        this.onAbort = onAbort;

        this.lifecycle = new GameStateMachine();
        Object.defineProperty(this, 'state', { get: () => this.lifecycle.state });
        this.disposed = false;

        // 玩家狀態
        this.hp = 100; this.maxHp = 100;
        this.weaponLevel = -1;
        this.magazine = 0; this.totalAmmo = 0;
        this.isReloading = false; this.reloadTimer = 0;
        this.lastFireTime = -99; this.emptyMsgTime = -99;
        this.bobPhase = 0;
        this.fovPunch = 0;

        // PUBG 式狀態
        this.baseSens = 0.8;
        this.boost = 0;          // 能量 (0-100)：答啱數學題增加，提供緩慢回血 + 加速
        this.healAcc = 0;
        this.nearPickup = null;
        this.zoneDmgAcc = 0;
        this.zoneHurtFlash = 0;

        // 圍牆收縮狀態 (草地場景)
        this.arenaShrink = {
            idx: 0, mode: 'wait', t: WALL_PHASES[0].wait,
            hx: HALF, fromHx: HALF, targetHx: WALL_PHASES[0].hx
        };

        // 藍圈狀態
        this.zone = {
            idx: 0, mode: 'wait', t: ZONE_PHASES[0].wait,
            radius: ZONE_START_RADIUS, center: { x: 0, z: 0 },
            fromRadius: ZONE_START_RADIUS, fromCenter: { x: 0, z: 0 },
            targetRadius: ZONE_PHASES[0].radius, targetCenter: { x: 0, z: 0 },
            dps: 0
        };
        this._pickNextZone();

        // 進度
        this.kills = 0; this.questionsSolved = 0; this.combo = 0;
        this.mathStats = { total: 0, correct: 0, byTopic: {} }; // 學習報告統計
        this.heartbeatT = 0;
        this.monstersLeft = [0, 0, 0, 0, 0, 0];
        this.monsterQueue = [];
        this.TOTAL_MONSTERS = 0;
        for (const m of MONSTER_BASE) {
            for (let i = 0; i < m.count; i++) this.monsterQueue.push(m);
            this.TOTAL_MONSTERS += m.count;
            this.monstersLeft[m.tier] += m.count;
        }

        // 計時器
        this.time = 0;
        this.lootTimer = 0; this.ammoTimer = 0; this.spawnTimer = 0;
        this.freezeTimer = 0; this.rageTimer = 0; this.bossAlarm = 0;

        // 實體
        this.enemies = []; this.pickups = []; this.bursts = []; this.tracers = []; this.shatters = [];

        this.viewMode = 'TPP'; // 預設第三人稱 (V 鍵切換)
        this._tppOffsetVec = null;   // 每幀渲染時記低 TPP 相機偏移，射擊用同一偏移 (修正準星視差)
        this.recoilAccum = 0;        // 累積後座上抬，鬆手自動回復
        this.panSwing = 0;           // 平底鑊揮擊動畫進度
        this.bloom = 0;              // 準星擴散量 (開槍增加)
        this.corpses = [];           // 死亡倒地動畫中嘅屍體
        this.dmgTexts = [];          // 3D 浮動傷害數字

        this._initHUDRefs();
        this._initScene();
        this._initGun();
        this._buildPlayerModel();
        this._bindEvents();
        this._updateHUD(true);
        this._setDiffLabel();

        // 開場先送一個空投
        this._spawnPickup('UPGRADE');
        this._addMsg('🧟 喪屍來襲！行近空投包裹自動開啟，答題取得武器！', '#f2a900');
        this._addMsg('⚠️ 藍圈會縮小，留意右上地圖白圈！', '#7dd3fc');
    }

    // -------------------------------------------------------------- HUD 引用
    _initHUDRefs() {
        const g = id => document.getElementById(id);
        this.ui = {
            hud: g('hud'), hpFill: g('hud-hp-fill'), hpText: g('hud-hp-text'),
            wep: g('hud-wep'), ammoBig: g('ammo-big'), fireMode: g('fire-mode'), wepPips: g('wep-pips'),
            statLeft: g('stat-left'), statKills: g('stat-kills'), monsters: g('hud-monsters'),
            diffTag: g('hud-diff-tag'), killFeed: g('kill-feed'),
            zoneTimer: g('zone-timer'), zoneVignette: g('zone-vignette'),
            interactPrompt: g('interact-prompt'), interactText: g('interact-text'),
            lootFeed: g('loot-feed'), wepToast: g('wep-toast'), wepToastName: g('wep-toast-name'),
            wepIcon: g('wep-icon'),
            dmgDir: g('dmg-dir'),
            threatEdges: {
                top: g('threat-top'), bottom: g('threat-bottom'), left: g('threat-left'), right: g('threat-right'),
                atop: g('threat-arrow-top'), abottom: g('threat-arrow-bottom'), aleft: g('threat-arrow-left'), aright: g('threat-arrow-right')
            },
            msgStack: g('msg-stack'), hitmarker: g('hitmarker'),
            vignette: g('vignette'), bossFlash: g('boss-flash'),
            combo: g('combo-tag'),
            bossBar: g('boss-bar'), bossBarFill: g('boss-bar-fill'),
            minimap: g('minimap'), compass: g('compass'),
            resumeOverlay: g('resume-overlay'),
            pauseMenu: g('pause-menu'),
            freezeTag: g('freeze-tag')
        };
        this.minimapCtx = this.ui.minimap.getContext('2d');
        this.compassCtx = this.ui.compass.getContext('2d');
        this.boostSegs = [...document.querySelectorAll('#boost-bg .boost-seg .fill')];

        // 武器等級格 (9 格)
        this.ui.wepPips.innerHTML = '';
        this.wepPipEls = [];
        for (let i = 0; i < WEAPONS.length; i++) {
            const pip = document.createElement('div');
            pip.className = 'wep-pip';
            this.ui.wepPips.appendChild(pip);
            this.wepPipEls.push(pip);
        }
        this.lastHUD = {};
    }

    _setDiffLabel() {
        this.ui.diffTag.textContent = `程度 ${this.difficulty} (x${DIFF_MULT[this.difficulty] || 1})　${DIFF_LABELS[this.difficulty] || ''}`;
    }

    // -------------------------------------------------------------- 場景建立
    _initScene() {
        const Q = this.quality = getQuality();     // 畫質分級 (桌面 high / 手機 medium-low)

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x8ec9ed);
        this.scene.fog = new THREE.Fog(0xa8d5ec, Q.fogNear, Q.fogFar);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
        this.camera.position.set(0, EYE_HEIGHT, 8);

        this.renderer = new THREE.WebGLRenderer({ antialias: Q.antialias, powerPreference: 'high-performance' });
        this._pixelRatio = Math.min(window.devicePixelRatio, Q.pixelRatio);
        this.renderer.setPixelRatio(this._pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
        this.scene.add(this.controls.getObject());

        // 燈光
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8d7b5c, 1.1));
        const sun = new THREE.DirectionalLight(0xfff2cc, 1.4);
        sun.position.set(30, 60, 20);
        this.scene.add(sun);

        // === 場景選擇 (SCENE_MODE)：'nature' 草地 | 'school' 明愛聖若瑟校舍 ===
        if (SCENE_MODE === 'school') {
            this._initSchoolScene();
        } else {
            this._initNatureScene();
        }

        // 天空：太陽 + 飄浮雲朵
        const cloudTex = this._makeCloudTexture();
        this.clouds = [];
        for (let i = 0; i < 8; i++) {
            const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false }));
            const cs = 18 + Math.random() * 22;
            cloud.scale.set(cs, cs * 0.5, 1);
            cloud.position.set((Math.random() * 2 - 1) * 130, 40 + Math.random() * 25, (Math.random() * 2 - 1) * 130);
            this.scene.add(cloud);
            this.clouds.push({ sprite: cloud, speed: 0.4 + Math.random() * 0.6 });
        }
        const sunTex = (() => {
            const c = document.createElement('canvas'); c.width = c.height = 128;
            const ctx = c.getContext('2d');
            const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            grad.addColorStop(0, 'rgba(255, 250, 220, 1)');
            grad.addColorStop(0.3, 'rgba(255, 240, 180, 0.9)');
            grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
            return new THREE.CanvasTexture(c);
        })();
        const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false }));
        sunSprite.scale.set(30, 30, 1);
        sunSprite.position.set(80, 90, 50);
        this.scene.add(sunSprite);

        this.enemiesGroup = new THREE.Group();
        this.scene.add(this.enemiesGroup);
        this.pickupsGroup = new THREE.Group();
        this.scene.add(this.pickupsGroup);

        // 藍圈電牆 (半透明藍色圓柱)
        this.zoneMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1, 50, 64, 1, true),
            new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
        );
        this.zoneMesh.position.y = 25;
        this.scene.add(this.zoneMesh);

        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 150;

        this.clock = new THREE.Clock();
    }

    // -------------------------------------------------------------- 草地樹木場景 (預設)
    _initNatureScene() {
        this.school = null;
        this.destructibles = [];
        this.playHX = HALF;
        this.playHZ = HALF;

        const floorTex = this._makeGrassTexture();
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(ARENA, ARENA),
            new THREE.MeshLambertMaterial({ map: floorTex })
        );
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);
        this.floorMesh = floor;

        const outerFloor = new THREE.Mesh(
            new THREE.PlaneGeometry(400, 400),
            new THREE.MeshLambertMaterial({ color: 0x548a3e })
        );
        outerFloor.rotation.x = -Math.PI / 2;
        outerFloor.position.y = -0.05;
        this.scene.add(outerFloor);

        this.wallsGroup = new THREE.Group();
        const wallMat = new THREE.MeshLambertMaterial({ color: 0x3f6d33 });
        const trimMat = new THREE.MeshLambertMaterial({ color: 0x35592c });
        const mkWall = (w, d, x, z) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H * 0.55, d), wallMat);
            wall.position.set(x, WALL_H * 0.55 / 2, z);
            this.wallsGroup.add(wall);
            const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.7, d + 0.6), trimMat);
            trim.position.set(x, WALL_H * 0.55 + 0.35, z);
            this.wallsGroup.add(trim);
            return { wall, trim };
        };
        // 記低四面牆，圍牆收縮系統會將佢哋向內推
        this.natureWalls = {
            north: mkWall(ARENA + 2, 1.4, 0, -HALF),
            south: mkWall(ARENA + 2, 1.4, 0, HALF),
            west: mkWall(1.4, ARENA + 2, -HALF, 0),
            east: mkWall(1.4, ARENA + 2, HALF, 0)
        };
        this.scene.add(this.wallsGroup);

        this.colliders = [];
        this.cratesGroup = new THREE.Group();
        const cratePositions = [[15, 15], [-15, 15], [15, -15], [-15, -15], [0, 28], [0, -28], [28, 0], [-28, 0]];
        const crateMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
        const crateMat2 = new THREE.MeshLambertMaterial({ color: 0xa0693a });
        cratePositions.forEach(([x, z], i) => {
            const s = 2.4 + (i % 3) * 0.4;
            const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), i % 2 ? crateMat : crateMat2);
            crate.position.set(x, s / 2, z);
            crate.rotation.y = i * 0.5;
            this._addDestructible(crate, 30, x, z, s * 0.85, 0x8b5a2b);
        });
        const TREE_KEYS = ['pine1', 'pine2', 'twisted1', 'twisted2'];
        const treeSpots = [
            [-32, 8], [30, -22], [-8, -34], [22, 30], [-30, -18], [8, 36], [36, 8], [-22, 28], [-36, -34], [34, 34],
            [-20, -8], [12, -22], [-12, 20], [26, 12], [18, -34], [-26, 34], [38, -14], [-38, 22], [6, 12], [-8, -16], [32, 38], [-16, -28]
        ];
        treeSpots.forEach(([x, z], i) => {
            const h = 6 + (i % 3) * 2.2;
            const tree = cloneProp(TREE_KEYS[i % TREE_KEYS.length], h);
            tree.position.x = x; tree.position.z = z;
            tree.rotation.y = Math.random() * Math.PI * 2;
            this._addDestructible(tree, 50, x, z, 1.1, 0x5a3d22);
        });
        const OUTER_TREES = this.quality.outerTrees;
        for (let i = 0; i < OUTER_TREES; i++) {
            const a = (i / OUTER_TREES) * Math.PI * 2;
            const d = HALF + 6 + Math.random() * 30;
            const tree = cloneProp(TREE_KEYS[i % TREE_KEYS.length], 7 + Math.random() * 6);
            tree.position.x = Math.cos(a) * d; tree.position.z = Math.sin(a) * d;
            tree.rotation.y = Math.random() * Math.PI * 2;
            this.cratesGroup.add(tree);
        }
        for (let i = 0; i < 9; i++) {
            const rh = 0.6 + Math.random() * 1.4;
            const rock = cloneProp(i % 2 ? 'rock1' : 'rock2', rh);
            const rx = (Math.random() * 2 - 1) * (HALF - 6);
            const rz = (Math.random() * 2 - 1) * (HALF - 6);
            rock.position.x = rx; rock.position.z = rz;
            rock.rotation.y = Math.random() * Math.PI * 2;
            if (rh > 1.2) this._addDestructible(rock, 90, rx, rz, rh * 0.9, 0x8a8a82);
            else this.cratesGroup.add(rock);
        }
        // === 中央營地 (圍牆最終收到呢度，做決戰舞台) ===
        // 營火：石圈 + 交叉柴枝 + 火焰 + 閃爍燈光
        const stoneMat = new THREE.MeshLambertMaterial({ color: 0x7a7a72 });
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stoneMat);
            stone.position.set(Math.cos(a) * 0.85, 0.12, Math.sin(a) * 0.85);
            stone.rotation.set(Math.random(), Math.random(), 0);
            this.cratesGroup.add(stone);
        }
        const logMat = new THREE.MeshLambertMaterial({ color: 0x5a3d22 });
        for (let i = 0; i < 3; i++) {
            const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 6), logMat);
            log.position.set(0, 0.22, 0);
            log.rotation.set(Math.PI / 2.3, (i / 3) * Math.PI, 0);
            this.cratesGroup.add(log);
        }
        // 火焰 sprite (加法混色，_updateEffects 入面閃爍)
        const flameCanvas = document.createElement('canvas');
        flameCanvas.width = flameCanvas.height = 64;
        const fctx2 = flameCanvas.getContext('2d');
        const fgrad = fctx2.createRadialGradient(32, 40, 2, 32, 36, 30);
        fgrad.addColorStop(0, 'rgba(255,240,160,1)');
        fgrad.addColorStop(0.4, 'rgba(255,140,40,0.85)');
        fgrad.addColorStop(1, 'rgba(255,60,0,0)');
        fctx2.fillStyle = fgrad;
        fctx2.beginPath();
        fctx2.ellipse(32, 36, 18, 26, 0, 0, Math.PI * 2);
        fctx2.fill();
        const flameTex = new THREE.CanvasTexture(flameCanvas);
        this.campFlames = [];
        for (let i = 0; i < 2; i++) {
            const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
            flame.raycast = () => {}; // sprite 唔好食任何射線 (TPP 相機/子彈)
            flame.position.set((i - 0.5) * 0.2, 0.55 + i * 0.25, 0);
            flame.scale.set(0.9 - i * 0.25, 1.2 - i * 0.3, 1);
            this.cratesGroup.add(flame);
            this.campFlames.push({ sprite: flame, phase: i * 2.1 });
        }
        this.campLight = new THREE.PointLight(0xff8830, 1.4, 14);
        this.campLight.position.set(0, 1.2, 0);
        this.scene.add(this.campLight);
        this.colliders.push({ x: 0, z: 0, r: 1.2 });

        // 木製瞭望塔 (中央側邊地標，可破壞 HP 150)
        const towerWood = new THREE.MeshLambertMaterial({ color: 0x6e4a26 });
        const towerWood2 = new THREE.MeshLambertMaterial({ color: 0x82552d });
        const twx = 6, twz = -5;
        const tower = new THREE.Group();
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 4.2, 7), towerWood);
            leg.position.set(twx + sx * 1.1, 2.1, twz + sz * 1.1);
            tower.add(leg);
        });
        const platform = new THREE.Mesh(new THREE.BoxGeometry(3, 0.22, 3), towerWood2);
        platform.position.set(twx, 4.2, twz);
        tower.add(platform);
        [[-1, 0, 0, 1], [1, 0, 0, 1], [0, -1, 1, 0], [0, 1, 1, 0]].forEach(([ox, oz, lx, lz]) => {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(lx ? 3 : 0.1, 0.55, lz ? 3 : 0.1), towerWood);
            rail.position.set(twx + ox * 1.45, 4.75, twz + oz * 1.45);
            tower.add(rail);
        });
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.5, 4), new THREE.MeshLambertMaterial({ color: 0x8a3a2a }));
        roof.position.set(twx, 6, twz);
        roof.rotation.y = Math.PI / 4;
        tower.add(roof);
        this._addDestructible(tower, 150, twx, twz, 1.9, 0x6e4a26);

        // 沙包掩體弧 (半圍住營火，radius 5.5)
        const sandbagMat = new THREE.MeshLambertMaterial({ color: 0x9c8b62 });
        for (let i = 0; i < 5; i++) {
            const a = Math.PI * 0.55 + (i / 5) * Math.PI * 0.9;
            const bx = Math.cos(a) * 5.5, bz = Math.sin(a) * 5.5;
            const bag = new THREE.Mesh(new THREE.BoxGeometry(2, 0.85, 0.7), sandbagMat);
            bag.position.set(bx, 0.42, bz);
            bag.rotation.y = -a + Math.PI / 2;
            const bagTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.6), sandbagMat);
            bagTop.position.set(bx, 1, bz);
            bagTop.rotation.y = -a + Math.PI / 2;
            const bagGrp = new THREE.Group();
            bagGrp.add(bag, bagTop);
            this._addDestructible(bagGrp, 45, bx, bz, 1.0, 0x9c8b62);
        }

        // 中央補給箱堆
        const midCrateMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
        [[-5, 3.5, 1.6], [-6.2, 5, 1.3], [-4.6, 5.2, 1.1]].forEach(([cx2, cz2, cs]) => {
            const c2 = new THREE.Mesh(new THREE.BoxGeometry(cs, cs, cs), midCrateMat);
            c2.position.set(cx2, cs / 2, cz2);
            c2.rotation.y = cx2 * 0.7;
            this._addDestructible(c2, 30, cx2, cz2, cs * 0.8, 0x8b5a2b);
        });

        this.scene.add(this.cratesGroup);

        const bladeTex = this._makeGrassBladeTexture();
        const grassGeo = new THREE.PlaneGeometry(0.9, 0.65);
        grassGeo.translate(0, 0.32, 0);
        const grassMat = new THREE.MeshLambertMaterial({ map: bladeTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, depthWrite: true });
        const GRASS_COUNT = this.quality.grass;
        const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, GRASS_COUNT);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < GRASS_COUNT; i++) {
            dummy.position.set((Math.random() * 2 - 1) * (HALF - 2), 0, (Math.random() * 2 - 1) * (HALF - 2));
            dummy.rotation.y = Math.random() * Math.PI;
            const gs = 0.7 + Math.random() * 0.9;
            dummy.scale.set(gs, gs, gs);
            dummy.updateMatrix();
            grassMesh.setMatrixAt(i, dummy.matrix);
        }
        grassMesh.instanceMatrix.needsUpdate = true;
        this.scene.add(grassMesh);

        const PLANT_KEYS = ['tallgrass', 'grass1', 'small_plant', 'plant', 'plant_big'];
        for (let i = 0; i < 55; i++) {
            const key = PLANT_KEYS[i % PLANT_KEYS.length];
            const ph = key === 'plant_big' ? 1.6 : (key === 'tallgrass' ? 1.1 : 0.5 + Math.random() * 0.4);
            const p = cloneProp(key, ph);
            p.position.x = (Math.random() * 2 - 1) * (HALF - 3);
            p.position.z = (Math.random() * 2 - 1) * (HALF - 3);
            p.rotation.y = Math.random() * Math.PI * 2;
            this.cratesGroup.add(p);
        }
    }

    // -------------------------------------------------------------- 明愛聖若瑟校舍場景 (保留備用)
    _initSchoolScene() {
        this.destructibles = [];
        const school = buildSchool(this.scene);
        this.school = school;
        this.colliders = school.colliders;
        this.schoolSpawns = school.spawnPoints;
        this.playHX = COURT_HX - 1.5;
        this.playHZ = COURT_HZ - 1.5;

        const courtFloor = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            new THREE.MeshLambertMaterial({ color: 0x3f9d63 })
        );
        courtFloor.rotation.x = -Math.PI / 2;
        courtFloor.position.y = 0;
        this.scene.add(courtFloor);
        this.floorMesh = courtFloor;

        this.wallsGroup = school.group;
        this.cratesGroup = new THREE.Group();
        this.scene.add(this.cratesGroup);
    }

    // 草地紋理 (綠色底 + 隨機草叢筆觸)
    _makeGrassTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 512;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#5d9142'; ctx.fillRect(0, 0, 512, 512);
        // 深淺色斑駁
        for (let i = 0; i < 260; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            const r = 6 + Math.random() * 22;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(74, 124, 51, 0.35)' : 'rgba(120, 165, 87, 0.3)';
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        // 草葉筆觸
        ctx.strokeStyle = 'rgba(52, 94, 36, 0.5)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 350; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            ctx.beginPath(); ctx.moveTo(x, y);
            ctx.lineTo(x + (Math.random() - 0.5) * 4, y - 4 - Math.random() * 5);
            ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(9, 9);
        return tex;
    }

    // 樹木：type 0 = 針葉樹 / 1 = 闊葉樹 (圓形樹冠) / 2 = 秋葉樹 (橙紅)
    _makeTree(x, z, s, type) {
        if (type === undefined) type = Math.floor(Math.random() * 3);
        const g = new THREE.Group();
        const trunkMat = new THREE.MeshLambertMaterial({ color: type === 2 ? 0x5a4632 : 0x6b4423 });

        if (type === 0) {
            // 針葉樹
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.45 * s, 3 * s, 7), trunkMat);
            trunk.position.y = 1.5 * s;
            g.add(trunk);
            const leafColors = [0x2d5a27, 0x3a7233, 0x2f6b2a];
            for (let i = 0; i < 3; i++) {
                const cone = new THREE.Mesh(
                    new THREE.ConeGeometry((2.2 - i * 0.5) * s, 2.4 * s, 8),
                    new THREE.MeshLambertMaterial({ color: leafColors[i % 3] })
                );
                cone.position.y = (3 + i * 1.4) * s;
                g.add(cone);
            }
        } else {
            // 闊葉/秋葉樹：彎曲樹幹 + 多球樹冠
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.5 * s, 3.6 * s, 7), trunkMat);
            trunk.position.y = 1.8 * s;
            trunk.rotation.z = (Math.random() - 0.5) * 0.12;
            g.add(trunk);
            // 分叉樹枝
            const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.6 * s, 5), trunkMat);
            branch.position.set(0.6 * s, 3.2 * s, 0);
            branch.rotation.z = -0.7;
            g.add(branch);
            const palette = type === 1
                ? [0x3f7a33, 0x4c8a3d, 0x36692c, 0x568f45]
                : [0xc26a2a, 0xd18432, 0xb35525, 0xdd9c3f]; // 秋葉橙紅
            const puffs = 4 + Math.floor(Math.random() * 3);
            for (let i = 0; i < puffs; i++) {
                const pr = (1.1 + Math.random() * 0.9) * s;
                const puff = new THREE.Mesh(
                    new THREE.SphereGeometry(pr, 9, 7),
                    new THREE.MeshLambertMaterial({ color: palette[i % palette.length] })
                );
                puff.position.set(
                    (Math.random() - 0.5) * 2.4 * s,
                    (4 + Math.random() * 1.6) * s,
                    (Math.random() - 0.5) * 2.4 * s
                );
                puff.scale.y = 0.85;
                g.add(puff);
            }
        }

        g.position.set(x, 0, z);
        g.rotation.y = Math.random() * Math.PI;
        return g;
    }

    // 草叢紋理 (透明背景草葉，畀 instancing 用)
    _makeGrassBladeTexture() {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        const ctx = c.getContext('2d');
        const colors = ['#4a7c33', '#5d9142', '#3e6b2b', '#6fa050'];
        for (let i = 0; i < 9; i++) {
            const bx = 8 + i * 6 + (Math.random() - 0.5) * 4;
            const h = 28 + Math.random() * 30;
            const lean = (Math.random() - 0.5) * 14;
            ctx.strokeStyle = colors[i % colors.length];
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(bx, 64);
            ctx.quadraticCurveTo(bx + lean * 0.4, 64 - h * 0.6, bx + lean, 64 - h);
            ctx.stroke();
        }
        return new THREE.CanvasTexture(c);
    }

    // 雲朵 sprite (radial gradient 白泡)
    _makeCloudTexture() {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 128;
        const ctx = c.getContext('2d');
        const puff = (x, y, r) => {
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(255,255,255,0.95)');
            grad.addColorStop(0.7, 'rgba(255,255,255,0.55)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        };
        puff(80, 75, 45); puff(130, 60, 55); puff(180, 78, 42); puff(105, 88, 38);
        return new THREE.CanvasTexture(c);
    }

    // -------------------------------------------------------------- 第一人稱武器模型
    _initGun() {
        this.gunGroup = new THREE.Group();
        this.camera.add(this.gunGroup);
        this.gunKick = 0;

        // 槍口火光：點光源 + 星形 sprite (放喺場景，兩種視角都啱位)
        this.flashLight = new THREE.PointLight(0xffdd88, 0, 12);
        this.scene.add(this.flashLight);
        this.flashTimer = 0;

        const flashCanvas = document.createElement('canvas');
        flashCanvas.width = flashCanvas.height = 128;
        const fctx = flashCanvas.getContext('2d');
        fctx.translate(64, 64);
        const grad = fctx.createRadialGradient(0, 0, 0, 0, 0, 60);
        grad.addColorStop(0, 'rgba(255,255,230,1)');
        grad.addColorStop(0.3, 'rgba(255,200,80,0.9)');
        grad.addColorStop(1, 'rgba(255,140,0,0)');
        fctx.fillStyle = grad;
        // 星形火光
        fctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const rOut = i % 2 === 0 ? 60 : 22;
            fctx.lineTo(Math.cos(a) * rOut, Math.sin(a) * rOut);
        }
        fctx.closePath(); fctx.fill();
        this.muzzleFlashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(flashCanvas), transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.muzzleFlashSprite.visible = false;
        this.scene.add(this.muzzleFlashSprite);

        this._buildGunModel();
    }

    // 平底鑊模型 (鑊身圓盤 + 手柄)
    _makePanMesh(scale) {
        const g = new THREE.Group();
        const panMat = new THREE.MeshLambertMaterial({ color: 0x2f2f33 });
        const panMat2 = new THREE.MeshLambertMaterial({ color: 0x46464c });
        // 鑊身 (圓盤 + 邊)
        const face = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.16 * scale, 0.025 * scale, 18), panMat);
        face.rotation.x = Math.PI / 2;
        g.add(face);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.155 * scale, 0.018 * scale, 8, 18), panMat2);
        g.add(rim);
        // 手柄
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.045 * scale, 0.045 * scale, 0.24 * scale), panMat2);
        handle.position.set(0, -0.02 * scale, 0.26 * scale);
        g.add(handle);
        return g;
    }

    _buildGunModel() {
        // 清走舊模型
        while (this.gunGroup.children.length) {
            const child = this.gunGroup.children.pop();
            child.traverse && child.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material && o.material.dispose) o.material.dispose();
            });
        }

        // 皮膚 + 衫袖 (第一人稱雙手)
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a878 });
        const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x4a5d43 });
        const mkArm = () => {
            const arm = new THREE.Group();
            const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.34), skinMat);
            forearm.position.z = 0.17;
            arm.add(forearm);
            const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.105, 0.16), sleeveMat);
            sleeve.position.z = 0.3;
            arm.add(sleeve);
            const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.12), skinMat);
            hand.position.z = -0.02;
            arm.add(hand);
            return arm;
        };

        if (this.weaponLevel < 0) {
            // 未有槍：右手揸平底鑊 (PUBG Mobile 開局經典)
            const pan = this._makePanMesh(1);
            pan.position.set(0.12, -0.05, -0.15);
            pan.rotation.set(-0.4, 0.25, 0.15);
            this.panMesh = pan;
            const armR = mkArm();
            armR.position.set(0.16, -0.18, 0.16);
            armR.rotation.set(0.4, -0.3, 0.1);
            const armL = mkArm();
            armL.position.set(-0.22, -0.1, 0.14);
            armL.rotation.set(0.5, 0.3, 0);
            this.gunGroup.add(pan, armR, armL);
            this.muzzleObj = null;
            this.gunBase = { x: 0.1, y: -0.26, z: -0.5 };
            this.gunGroup.position.set(0.1, -0.26, -0.5);
            this.gunGroup.rotation.set(0, 0, 0);
            this._updateTppGun();
            return;
        }

        const wep = WEAPONS[this.weaponLevel];
        const gunKey = GUN_BY_LEVEL[this.weaponLevel] || 'gun_pistol';

        // 第一人稱：Quaternius 真槍模型 (等級越高越長)
        const fpGun = cloneGun(gunKey, 0.85 + wep.level * 0.05);
        // 高級武器加武器色發光 (Lv.7+ 至勁)
        if (wep.level >= 7) {
            tintModel(fpGun, 0xffffff, 0).forEach(m => {
                if (m.emissive) { m.emissive.set(wep.glow || wep.color); m.emissiveIntensity = 0.35; }
            });
        }
        this.muzzleObj = fpGun.userData.muzzle;

        // 右手握把、左手托槍管
        const armR = mkArm();
        armR.position.set(0.08, -0.2, 0.26);
        armR.rotation.set(0.35, -0.3, 0.1);
        const armL = mkArm();
        armL.position.set(-0.08, -0.12, -0.15);
        armL.rotation.set(0.25, 0.5, -0.1);

        this.gunGroup.add(fpGun, armR, armL);
        this.gunBase = { x: 0.3, y: -0.28, z: -0.6 };
        this.gunGroup.position.set(0.3, -0.28, -0.6);
        this.gunGroup.rotation.set(0, 0, 0);

        this._updateTppGun();
    }

    // 更新第三人稱士兵手上支槍
    _updateTppGun() {
        if (!this.tpGunWrap) return;
        while (this.tpGunWrap.children.length) {
            const c = this.tpGunWrap.children.pop();
            c.traverse && c.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material && o.material.dispose) o.material.dispose();
            });
        }
        this.tpMuzzle = null;
        if (this.weaponLevel < 0) {
            // 平底鑊喺手
            const tpPan = this._makePanMesh(1);
            tpPan.traverse(o => { o.raycast = () => {}; });
            if (this.playerHandBone) {
                this.playerModel.updateMatrixWorld(true);
                const ws = new THREE.Vector3();
                this.playerHandBone.getWorldScale(ws);
                const inv = ws.x > 0.0001 ? 1 / ws.x : 1;
                tpPan.scale.setScalar(inv * 0.9);
                tpPan.position.set(0, 0.1 * inv, 0.12 * inv);
            }
            this.tpGunWrap.add(tpPan);
            return;
        }

        const wep = WEAPONS[this.weaponLevel];
        const gunKey = GUN_BY_LEVEL[this.weaponLevel] || 'gun_pistol';
        const tpGun = cloneGun(gunKey, 0.55 + wep.level * 0.04);
        if (wep.level >= 7) {
            tintModel(tpGun, 0xffffff, 0).forEach(m => {
                if (m.emissive) { m.emissive.set(wep.glow || wep.color); m.emissiveIntensity = 0.35; }
            });
        }
        tpGun.traverse(o => { o.raycast = () => {}; });

        if (this.playerHandBone) {
            // 掛喺手骨：用骨骼 world scale 反算，令槍喺世界空間保持正確大細
            this.playerModel.updateMatrixWorld(true);
            const ws = new THREE.Vector3();
            this.playerHandBone.getWorldScale(ws);
            const inv = ws.x > 0.0001 ? 1 / ws.x : 1;
            tpGun.scale.setScalar(inv);
            tpGun.rotation.set(0, 0, 0);
            tpGun.position.set(0, 0.1 * inv, 0.15 * inv);
        } else {
            tpGun.rotation.set(0, 0, 0);
        }
        this.tpGunWrap.add(tpGun);
        this.tpMuzzle = tpGun.userData.muzzle;
    }

    // -------------------------------------------------------------- 第三人稱玩家 (Quaternius 士兵模型)
    _buildPlayerModel() {
        const g = new THREE.Group();

        // 士兵模型 (1.8 米高，帶 Idle/Run_Gun/Idle_Shoot 動畫)
        const { model, asset } = cloneCharacter('soldier', 1.8);
        tintModel(model, 0xffffff, 0); // 複製材質，避免同其他 clone 共用
        g.add(model);

        this.playerMixer = new THREE.AnimationMixer(model);
        this.playerActions = {};
        for (const [k, clip] of Object.entries(asset.animMap)) {
            if (clip) this.playerActions[k] = this.playerMixer.clipAction(clip);
        }
        this._playerAnim = null;
        this._setPlayerAnim('idle');

        // 搵右手骨骼，將槍模型揸喺手度；搵唔到就掛喺身前
        this.playerHandBone = null;
        model.traverse(o => {
            if (!this.playerHandBone && o.isBone && /^(hand|fist|lowerarm|wrist)r$/i.test(o.name)) {
                this.playerHandBone = o;
            }
        });
        this.tpGunWrap = new THREE.Group(); // 第三人稱槍容器 (換武器時替換內容)
        if (this.playerHandBone) {
            this.playerHandBone.add(this.tpGunWrap);
        } else {
            this.tpGunWrap.position.set(0.15, 1.25, 0.35);
            g.add(this.tpGunWrap);
        }
        this.tpMuzzle = null; // 換武器時設定

        // 陰影
        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(0.5, 14),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.02;
        g.add(shadow);

        g.traverse(o => { o.raycast = () => {}; }); // 玩家模型唔好擋自己嘅子彈

        g.visible = false;
        this.scene.add(g);
        this.playerModel = g;
        this._tppRaycaster = new THREE.Raycaster();
        this._updateTppGun(); // 開局補掛平底鑊 (之前 _buildGunModel 行嗰陣 playerModel 未起好)
    }

    // 切換玩家動畫 (crossfade)
    _setPlayerAnim(name) {
        const next = this.playerActions[name] || this.playerActions.idle;
        if (!next || this._playerAnim === next) return;
        if (this._playerAnim) {
            next.reset();
            next.crossFadeFrom(this._playerAnim, 0.2, false);
        }
        next.play();
        this._playerAnim = next;
    }

    // -------------------------------------------------------------- 喪屍建立 (Quaternius 3D 模型)
    _buildMonster(cfg) {
        const r = (cfg.size / 28) * 2;   // 體型加倍 (巨大化)
        const H = r * 2.1;
        const g = new THREE.Group();

        // 複製對應等級嘅喪屍模型 (含骨骼)，縮放至全高 H、腳貼地
        const key = ZOMBIE_BY_TIER[cfg.tier] || 'zombie_b';
        const { model, asset } = cloneCharacter(key, H);
        // 等級染色 (輕微 lerp，保留貼圖質感)；並收集材質俾受擊閃白
        const mats = tintModel(model, TIER_TINT[cfg.tier] || 0xffffff, TIER_TINT[cfg.tier] ? 0.35 : 0);
        g.add(model);

        // 骨骼動畫：預設行走 (冇 walk 就用 run)
        const mixer = new THREE.AnimationMixer(model);
        const actions = {};
        for (const [k, clip] of Object.entries(asset.animMap)) {
            if (clip) actions[k] = mixer.clipAction(clip);
        }
        const move = actions.walk || actions.run;
        if (move) move.play();

        // 喪屍王：金皇冠
        if (cfg.tier === 5) {
            const crownMat = new THREE.MeshLambertMaterial({ color: 0xfbbf24, emissive: 0x92610a });
            const crown = new THREE.Group();
            const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.32, r * 0.14, 10), crownMat);
            crown.add(ring);
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2;
                const point = new THREE.Mesh(new THREE.ConeGeometry(r * 0.06, r * 0.2, 6), crownMat);
                point.position.set(Math.cos(a) * r * 0.24, r * 0.14, Math.sin(a) * r * 0.24);
                crown.add(point);
            }
            crown.position.y = H * 1.02;
            g.add(crown);
        }

        // 地面陰影
        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(r * 0.7, 14),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.02;
        g.add(shadow);

        // 視覺件全部唔參與射線判定 (改用統一 hitbox，穩定易中)
        g.traverse(o => { o.raycast = () => {}; });

        // 身體膠囊 hitbox (隱形，略大過視覺模型)
        const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
        const bodyHit = new THREE.Mesh(
            new THREE.CylinderGeometry(r * 0.62, r * 0.62, H * 0.92, 8),
            hitboxMat
        );
        bodyHit.position.y = H * 0.46;
        g.add(bodyHit);
        // 頭部爆頭 hitbox (傷害 ×2)
        const headHit = new THREE.Mesh(new THREE.SphereGeometry(r * 0.42, 8, 6), hitboxMat);
        headHit.position.y = H * 0.85;
        headHit.userData.headshot = true;
        g.add(headHit);

        // 頭頂血條 (canvas sprite)
        const hpCanvas = document.createElement('canvas');
        hpCanvas.width = 128; hpCanvas.height = 36;
        const hpTex = new THREE.CanvasTexture(hpCanvas);
        const hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: hpTex }));
        hpSprite.scale.set(r * 1.8, r * 0.5, 1);
        hpSprite.position.y = H * 1.18;
        hpSprite.raycast = () => {}; // 血條唔食子彈
        g.add(hpSprite);

        return {
            group: g, hpCanvas, hpTex, radius: r,
            stagger: 0, dying: false,
            mixer, actions, mats,
            colorHex: new THREE.Color(cfg.color).getHex()
        };
    }

    _drawEnemyHpBar(e) {
        const ctx = e.hpCanvas.getContext('2d');
        ctx.clearRect(0, 0, 128, 36);
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'black'; ctx.fillText(`Lv.${e.tier}`, 65, 15);
        ctx.fillStyle = 'white'; ctx.fillText(`Lv.${e.tier}`, 64, 14);
        ctx.fillStyle = '#334155'; ctx.fillRect(14, 20, 100, 10);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(14, 20, 100 * Math.max(0, e.hp / e.maxHp), 10);
        e.hpTex.needsUpdate = true;
    }

    _spawnEnemy() {
        if (this.monsterQueue.length === 0) return;
        const cfg = this.monsterQueue.shift();

        const built = this._buildMonster(cfg);
        let x, z;
        if (this.school) {
            // 學校：喺操場邊緣生成 (模擬由校舍門口湧出)
            const sp = this.schoolSpawns[Math.floor(Math.random() * this.schoolSpawns.length)];
            x = sp.x + (Math.random() - 0.5) * 2;
            z = sp.z + (Math.random() - 0.5) * 2;
        } else {
            // 草地：喺場邊四方生成
            const m = HALF - 4;
            const side = Math.floor(Math.random() * 4);
            if (side === 0) { x = -m; z = (Math.random() * 2 - 1) * m; }
            else if (side === 1) { x = m; z = (Math.random() * 2 - 1) * m; }
            else if (side === 2) { x = (Math.random() * 2 - 1) * m; z = -m; }
            else { x = (Math.random() * 2 - 1) * m; z = m; }
        }
        built.group.position.set(x, 0, z);

        const enemy = {
            ...built,
            tier: cfg.tier, name: cfg.name,
            hp: cfg.hp, maxHp: cfg.hp,
            speed: cfg.speed * 3,
            attackCd: 0, bobPhase: Math.random() * Math.PI * 2,
            flash: 0, growlT: 1.5 + Math.random() * 5
        };
        enemy.group.userData.enemy = enemy;
        this._drawEnemyHpBar(enemy);
        this.enemiesGroup.add(enemy.group);
        this.enemies.push(enemy);

        if (cfg.tier === 5) {
            this.bossAlarm = 2.5;
            sfxBossRoar();
            this._addMsg('⚠️ 萬血首領來襲！ ⚠️', '#ef4444');
            this.ui.bossBar.style.display = 'block';
        }
    }

    // -------------------------------------------------------------- 藍圈 (縮圈)
    _pickNextZone() {
        const z = this.zone;
        const phase = ZONE_PHASES[z.idx];
        if (!phase) return;
        z.targetRadius = phase.radius;
        // 下一圈中心：喺現有圈內隨機，保證新圈完全在舊圈裡面，且在場地內
        const maxOffset = Math.max(0, z.radius - phase.radius);
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * maxOffset;
        let cx = z.center.x + Math.cos(a) * d;
        let cz = z.center.z + Math.sin(a) * d;
        const lim = HALF - phase.radius * 0.3;
        cx = Math.max(-lim, Math.min(lim, cx));
        cz = Math.max(-lim, Math.min(lim, cz));
        z.targetCenter = { x: cx, z: cz };
    }

    _updateZone(dt) {
        // 學校地圖：顯示清剿進度
        if (this.school) {
            if (this.zoneMesh) this.zoneMesh.visible = false;
            this.ui.zoneVignette.style.opacity = '0';
            const left = Math.max(0, this.TOTAL_MONSTERS - this.kills);
            this.ui.zoneTimer.textContent = `🧟 校園清剿：剩餘 ${left} 隻喪屍`;
            this.ui.zoneTimer.style.color = '#fca5a5';
            return;
        }

        // === 草地場景：四面圍牆向內收細 (取代藍圈) ===
        if (this.zoneMesh) this.zoneMesh.visible = false;
        this.ui.zoneVignette.style.opacity = '0';

        const a = this.arenaShrink;
        const ph = WALL_PHASES[a.idx];

        if (ph) {
            a.t -= dt;
            if (a.mode === 'wait' && a.t <= 0) {
                a.mode = 'shrink';
                a.t = ph.shrink;
                a.fromHx = a.hx;
                a.targetHx = ph.hx;
                this._addMsg('⚠️ 圍牆開始向內收窄！場地縮細！', '#f97316');
            } else if (a.mode === 'shrink') {
                const k = 1 - Math.max(0, a.t / ph.shrink);
                a.hx = a.fromHx + (a.targetHx - a.fromHx) * k;
                if (a.t <= 0) {
                    a.hx = a.targetHx;
                    a.idx++;
                    const next = WALL_PHASES[a.idx];
                    if (next) { a.mode = 'wait'; a.t = next.wait; }
                    else a.mode = 'done';
                }
            }
        }

        // 將四面牆推到現時邊界，並縮短牆身長度
        if (this.natureWalls) {
            const hx = a.hx;
            const lenScale = (hx * 2 + 2) / (ARENA + 2);
            const nw = this.natureWalls;
            nw.north.wall.position.z = -hx; nw.north.trim.position.z = -hx;
            nw.south.wall.position.z = hx;  nw.south.trim.position.z = hx;
            nw.west.wall.position.x = -hx;  nw.west.trim.position.x = -hx;
            nw.east.wall.position.x = hx;   nw.east.trim.position.x = hx;
            nw.north.wall.scale.x = lenScale; nw.north.trim.scale.x = lenScale;
            nw.south.wall.scale.x = lenScale; nw.south.trim.scale.x = lenScale;
            nw.west.wall.scale.z = lenScale;  nw.west.trim.scale.z = lenScale;
            nw.east.wall.scale.z = lenScale;  nw.east.trim.scale.z = lenScale;
        }

        // 玩家活動範圍 = 現時牆內
        this.playHX = a.hx;
        this.playHZ = a.hx;

        // 圍牆計時 HUD
        const fmt = s => {
            s = Math.max(0, Math.ceil(s));
            return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
        };
        if (a.mode === 'wait') this.ui.zoneTimer.textContent = `🧱 圍牆將於 ${fmt(a.t)} 後收窄`;
        else if (a.mode === 'shrink') this.ui.zoneTimer.textContent = `⚠️ 圍牆收窄中 ${fmt(a.t)}`;
        else this.ui.zoneTimer.textContent = `⚔️ 最終決戰區 (${Math.round(a.hx * 2)}米)`;
        this.ui.zoneTimer.style.color = a.mode === 'shrink' ? '#f97316' : '#7dd3fc';
    }

    // -------------------------------------------------------------- 寶箱
    _spawnPickup(type) {
        const isUp = type === 'UPGRADE';
        if (isUp && this.pickups.filter(p => p.type === 'UPGRADE').length >= 2) return;
        if (!isUp && this.pickups.filter(p => p.type === 'AMMO').length >= 3) return;

        const g = new THREE.Group();
        let box, parachute = null, goldBeam = null;

        if (isUp) {
            // PUBG 空投包裹：卡其色箱 + 紅色帶 + 降落傘
            const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a8065 });
            box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.5), crateMat);
            box.position.y = 0.55;
            g.add(box);
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.34, 1.54), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
            stripe.position.y = 0.55;
            g.add(stripe);
            const lid = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.12, 1.56), new THREE.MeshLambertMaterial({ color: 0x6e6650 }));
            lid.position.y = 1.13;
            g.add(lid);

            // 降落傘 (紅白傘蓋 + 傘繩)
            parachute = new THREE.Group();
            const canopy = new THREE.Mesh(
                new THREE.SphereGeometry(2.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4),
                new THREE.MeshLambertMaterial({ color: 0xd94f3d, side: THREE.DoubleSide })
            );
            canopy.position.y = 4.6;
            parachute.add(canopy);
            const stringMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
                const string = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.6, 4), stringMat);
                string.position.set(sx * 0.85, 2.9, sz * 0.85);
                string.rotation.z = -sx * 0.32;
                string.rotation.x = sz * 0.32;
                parachute.add(string);
            });
            g.add(parachute);

            // === 金色信號光柱 (整場最搶眼，一直照住) ===
            goldBeam = new THREE.Group();
            // 外層柔光柱
            const outerMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
            const outer = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 60, 16, 1, true), outerMat);
            outer.position.y = 30;
            outer.raycast = () => {};
            goldBeam.add(outer);
            // 內層亮芯
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
            const core = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 60, 12, 1, true), coreMat);
            core.position.y = 30;
            core.raycast = () => {};
            goldBeam.add(core);
            // 底部發光圓盤
            const discMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
            const disc = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), discMat);
            disc.rotation.x = -Math.PI / 2;
            disc.position.y = 0.05;
            disc.raycast = () => {};
            goldBeam.add(disc);
            // 金色點光源
            const beamLight = new THREE.PointLight(0xffcc44, 2, 22);
            beamLight.position.y = 3;
            goldBeam.add(beamLight);
            g.add(goldBeam);
        } else {
            // 軍用彈藥箱 (綠色，自動拾取)
            const ammoMat = new THREE.MeshLambertMaterial({ color: 0x4a5d33 });
            box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.8), ammoMat);
            box.position.y = 0.35;
            g.add(box);
            const lid = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.14, 0.84), new THREE.MeshLambertMaterial({ color: 0x3a4a28 }));
            lid.position.y = 0.73;
            g.add(lid);
            // 子彈裝飾
            const bulletMat = new THREE.MeshLambertMaterial({ color: 0xd4a017, emissive: 0x6b500c });
            for (let i = 0; i < 3; i++) {
                const bullet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6), bulletMat);
                bullet.position.set(-0.2 + i * 0.2, 0.9, 0);
                g.add(bullet);
            }
            // === 淡藍色弱光柱 (幼身柔和，同升級金色強光分得清) ===
            goldBeam = new THREE.Group();
            goldBeam.userData.dim = true; // 標記為弱光 (脈動時用低亮度)
            const outerMat = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
            const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 45, 12, 1, true), outerMat);
            outer.position.y = 22.5; outer.raycast = () => {};
            goldBeam.add(outer);
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
            const core = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 45, 10, 1, true), coreMat);
            core.position.y = 22.5; core.raycast = () => {};
            goldBeam.add(core);
            const discMat = new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
            const disc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 18), discMat);
            disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; disc.raycast = () => {};
            goldBeam.add(disc);
            const beamLight = new THREE.PointLight(0x9fd0ff, 0.5, 12);
            beamLight.position.y = 2.5;
            goldBeam.add(beamLight);
            g.add(goldBeam);
        }

        // 文字標籤
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 160; labelCanvas.height = 48;
        const lctx = labelCanvas.getContext('2d');
        lctx.font = 'bold 26px Arial'; lctx.textAlign = 'center';
        const labelText = isUp ? '空投補給' : '彈藥';
        lctx.fillStyle = 'black'; lctx.fillText(labelText, 82, 34);
        lctx.fillStyle = isUp ? '#ff6b5b' : '#93c5fd'; lctx.fillText(labelText, 80, 32);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labelCanvas), depthTest: false }));
        label.scale.set(2.6, 0.8, 1);
        label.position.y = isUp ? 2.2 : 1.7;
        g.add(label);

        // 隨機位置 (避開障礙物，並與玩家保持距離)
        const ppos = this.camera.position;
        let x, z, tries = 0;
        do {
            x = (Math.random() * 2 - 1) * (this.playHX - 3);
            z = (Math.random() * 2 - 1) * (this.playHZ - 3);
            tries++;
        } while (tries < 30 && (
            this.colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 2) ||
            Math.hypot(x - ppos.x, z - ppos.z) < 8
        ));

        // 空投由天而降；彈藥箱直接放地面
        g.position.set(x, isUp ? 32 : 0, z);

        this.pickupsGroup.add(g);
        this.pickups.push({
            group: g, box, type, parachute, goldBeam,
            falling: isUp, life: PICKUP_LIFETIME,
            spin: Math.random() * Math.PI, smokeTimer: 0
        });

        this._addMsg(isUp ? '✈️ 空投補給投放中！留意金色光柱！' : '🔵 彈藥箱空投到場！留意藍色光柱！', isUp ? '#ffd24a' : '#4aa8ff');
    }

    // -------------------------------------------------------------- 事件綁定
    _bindEvents() {
        const handleAction = action => {
            if (action === 'pause') {
                this.pause('keyboard');
                return;
            }
            if (this.state !== GAME_STATES.PLAYING) return;
            if (action === 'reload') this._startReload();
            if (action === 'melee') this._tryMelee();
            if (action === 'toggle-view') {
                this.viewMode = this.viewMode === 'TPP' ? 'FPP' : 'TPP';
                this._addMsg(this.viewMode === 'TPP' ? '👤 第三人稱視角' : '👁️ 第一人稱視角', '#e5e5e5');
            }
        };
        this.input = new InputController({
            target: document,
            pointerTarget: this.renderer.domElement,
            onAction: handleAction
        });
        this.input.bind();
        this.touchControls = new TouchControlSurface({ root: document, input: this.input, onAction: handleAction });
        this.touchControls.bind();
        this._onContextMenu = (e) => { e.preventDefault(); };
        this._onResize = () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        };
        this._onLock = () => {
            if (document.hidden) {
                this.controls.unlock();
                return;
            }
            this.resume('pointer-lock');
        };
        this._onUnlock = () => this.pause('pointer-lock');
        this._onPointerLockError = () => this.pause('pointer-lock-error');
        this._onResumeClick = () => this.requestResume();
        this._onVisibilityChange = () => {
            if (document.hidden) this.pause('visibility');
        };

        document.addEventListener('contextmenu', this._onContextMenu);
        document.addEventListener('visibilitychange', this._onVisibilityChange);
        document.addEventListener('pointerlockerror', this._onPointerLockError);
        window.addEventListener('resize', this._onResize);
        this.controls.addEventListener('lock', this._onLock);
        this.controls.addEventListener('unlock', this._onUnlock);
        this.ui.resumeOverlay.addEventListener('click', this._onResumeClick);

        // 暫停選單按鈕
        this._onBtnResume = () => this.requestResume();
        this._onBtnTouchPause = () => this.pause('touch-control');
        this._onBtnQuit = () => this.abort();
        document.getElementById('btn-resume').addEventListener('click', this._onBtnResume);
        document.getElementById('btn-touch-pause').addEventListener('click', this._onBtnTouchPause);
        document.getElementById('btn-quit').addEventListener('click', this._onBtnQuit);
        this._onSens = (e) => {
            this.baseSens = parseFloat(e.target.value);
            try { localStorage.setItem('ms_sens', String(this.baseSens)); } catch (err) {}
        };
        // 開局時讀返滑桿現值 (main.js 已從 localStorage 恢復)
        const sensEl = document.getElementById('sens-slider');
        if (sensEl) this.baseSens = parseFloat(sensEl.value) || 0.8;
        document.getElementById('sens-slider').addEventListener('input', this._onSens);
    }

    start() {
        if (!isTouchMode()) this.ui.resumeOverlay.style.display = 'flex';
        this.requestResume();
        this._animate();
    }

    pause(reason = 'manual') {
        if (this.state !== GAME_STATES.PLAYING && this.state !== GAME_STATES.RESUME_WAIT) return false;
        this.lifecycle.transition(GAME_STATES.PAUSED);
        this.touchControls.reset();
        this.input.reset();
        this.ui.resumeOverlay.style.display = 'none';
        this.ui.pauseMenu.style.display = 'flex';
        if (reason !== 'pointer-lock' && this.controls.isLocked) this.controls.unlock();
        return true;
    }

    resume() {
        if (this.state !== GAME_STATES.PAUSED && this.state !== GAME_STATES.RESUME_WAIT) return false;
        this.lifecycle.transition(GAME_STATES.PLAYING);
        this.touchControls.reset();
        this.input.reset();
        this.ui.pauseMenu.style.display = 'none';
        this.ui.resumeOverlay.style.display = 'none';
        this.clock.getDelta();
        return true;
    }

    requestResume() {
        if (isTouchMode()) return this.resume('touch');
        this.controls.lock();
        return true;
    }

    // -------------------------------------------------------------- 瞄準/射擊輔助
    // 設定瞄準射線：TPP 時臨時套用渲染相機偏移，確保準星指邊打邊
    _setAimRay(ndcX, ndcY) {
        if (this.viewMode === 'TPP' && this._tppOffsetVec) {
            const pivot = this.camera.position.clone();
            this.camera.position.add(this._tppOffsetVec);
            this.camera.updateMatrixWorld();
            this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
            this.camera.position.copy(pivot);
            this.camera.updateMatrixWorld();
        } else {
            this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
        }
    }

    // WebAudio 合成命中音效 (爆頭高音)
    _playHitSound(headshot) {
        try {
            if (!this._actx) this._actx = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = this._actx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = headshot ? 880 : 440;
            gain.gain.setValueAtTime(headshot ? 0.16 : 0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.09);
        } catch (e) { /* WebAudio 不可用時靜默 */ }
    }

    // 3D 浮動傷害數字 (PUBG Mobile 式)
    _spawnDmgText(pos, text, color) {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 64;
        const ctx = c.getContext('2d');
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(text, 64, 44);
        ctx.fillStyle = color;
        ctx.fillText(text, 64, 44);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
        sprite.scale.set(1.5, 0.75, 1);
        sprite.position.copy(pos);
        sprite.position.x += (Math.random() - 0.5) * 0.4;
        sprite.position.y += 0.3;
        this.scene.add(sprite);
        this.dmgTexts.push({ sprite, life: 0.8, maxLife: 0.8 });
        if (this.dmgTexts.length > 20) {
            const old = this.dmgTexts.shift();
            this._disposeDmgText(old);
        }
    }

    _disposeDmgText(t) {
        this.scene.remove(t.sprite);
        t.sprite.material.map.dispose();
        t.sprite.material.dispose();
    }

    // 每幀更新動態準星 (擴散 / 指敵變紅)
    _updateCrosshair() {
        const ch = document.getElementById('crosshair');
        if (!ch) return;

        // 擴散量：基礎 + 開槍 bloom + 移動 + 疾跑；開鏡大幅收細
        let gap = 7 + this.bloom * 16;
        if (this._movingNow) gap += 5;
        if (this._sprintingNow) gap += 8;
        if (this.input.aim) gap = 3 + this.bloom * 5;
        if (Math.abs(gap - (this._lastGap || 0)) > 0.4) {
            this._lastGap = gap;
            const q = ch.querySelectorAll('.ch');
            // t b l r dot 順序
            q[0].style.transform = `translateY(${-gap - 9}px)`;
            q[1].style.transform = `translateY(${gap}px)`;
            q[2].style.transform = `translateX(${-gap - 9}px)`;
            q[3].style.transform = `translateX(${gap}px)`;
        }

        // 指住喪屍 → 準星變紅 (每幀一條中心射線，只測喪屍 hitbox)
        if (this.state === GAME_STATES.PLAYING && this.enemies.length) {
            this._setAimRay(0, 0);
            this.raycaster.far = 120;
            const hits = this.raycaster.intersectObject(this.enemiesGroup, true);
            ch.classList.toggle('on-target', hits.length > 0);
        } else {
            ch.classList.remove('on-target');
        }
    }

    // -------------------------------------------------------------- 射擊
    _tryMelee() {
        const now = this.time;
        if (now - this.lastFireTime < 0.55) return;
        this.lastFireTime = now;
        this.panSwing = 1;
        const pos = this.camera.position;
        const fwd = new THREE.Vector3();
        this.camera.getWorldDirection(fwd);
        let hitAny = false, killAny = false;
        for (const e of this.enemies) {
            if (e.dying) continue;
            const dx = e.group.position.x - pos.x;
            const dz = e.group.position.z - pos.z;
            const dist = Math.hypot(dx, dz);
            if (dist > e.radius + 2.4) continue;
            if ((dx * fwd.x + dz * fwd.z) / (dist || 1) < 0.35) continue;
            const hitPoint = e.group.position.clone();
            hitPoint.y += e.radius * 1.2;
            const killed = this._damageEnemy(e, 3, hitPoint, fwd);
            hitAny = true;
            if (killed) killAny = true;
            this._spawnDmgText(hitPoint, '-3', '#ffd166');
        }
        if (hitAny) {
            sfxPanClang();
            this._showHitmarker(killAny, false);
        } else {
            sfxPanSwing();
        }
    }

    _tryShoot() {
        const now = this.time;

        if (this.weaponLevel < 0) {
            return this._tryMelee();
        }

        const wep = WEAPONS[this.weaponLevel];
        if (now - this.lastFireTime < wep.fireRate / 60) return;

        if (this.isReloading) return;

        if (this.magazine <= 0) {
            if (this.totalAmmo > 0) { this._startReload(); }
            else if (now - this.emptyMsgTime >= 0.6) {
                this._addMsg('❗ 彈藥耗盡！尋找藍色補給箱！', '#ef4444');
                playSfx('emptyAmmoSfx');
                this.emptyMsgTime = now;
            }
            return;
        }

        // 開火
        this.magazine--;
        this.lastFireTime = now;
        playSfx('shootSfx');

        // 槍口位置：TPP 用角色模型步槍口，FPP 用手上槍口
        const muzzlePos = new THREE.Vector3();
        if (this.viewMode === 'TPP' && this.tpMuzzle) {
            this.tpMuzzle.getWorldPosition(muzzlePos);
        } else if (this.muzzleObj) {
            this.muzzleObj.getWorldPosition(muzzlePos);
        } else {
            this.camera.getWorldPosition(muzzlePos);
        }

        const targets = [this.enemiesGroup, this.wallsGroup, this.cratesGroup, this.floorMesh];
        let anyHit = false, anyKill = false, anyHead = false;
        const shotDmg = new Map(); // enemy → {dmg, point, head} 一槍統計一個傷害數字

        for (let k = 0; k < wep.bullets; k++) {
            // 開鏡瞄準時散佈更細 (更準)；bloom 連射擴散
            const spread = (wep.bullets > 1 ? 0.045 : 0.012) * (this.input.aim ? 0.4 : 1) * (1 + this.bloom * 0.6);
            this._setAimRay((Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * spread * 2);
            this.raycaster.far = 150;
            const hits = this.raycaster.intersectObjects(targets, true);

            let endPoint = null;
            let pelletHitEnemy = false;
            const damaged = new Set();
            for (const h of hits) {
                // 向上尋找喪屍根節點
                let obj = h.object, enemy = null;
                while (obj) {
                    if (obj.userData && obj.userData.enemy) { enemy = obj.userData.enemy; break; }
                    obj = obj.parent;
                }
                if (enemy) {
                    if (enemy.dying || damaged.has(enemy)) continue;
                    damaged.add(enemy);
                    pelletHitEnemy = true;
                    // 爆頭判定：頭部 hitbox 傷害 ×2
                    const isHead = !!h.object.userData.headshot;
                    const dmg = wep.damage * (isHead ? 2 : 1);
                    const rec = shotDmg.get(enemy) || { dmg: 0, point: h.point, head: false };
                    rec.dmg += dmg; rec.point = h.point; rec.head = rec.head || isHead;
                    shotDmg.set(enemy, rec);
                    const killed = this._damageEnemy(enemy, dmg, h.point, this.raycaster.ray.direction);
                    anyHit = true;
                    if (isHead) anyHead = true;
                    if (killed) anyKill = true;
                    if (!wep.penetrate || damaged.size >= 4) { endPoint = h.point; break; }
                } else {
                    endPoint = h.point;
                    // 搵可破壞物件 (樹/箱/石/營地)
                    let dobj = h.object, dest = null;
                    while (dobj) {
                        if (dobj.userData && dobj.userData.destructible) { dest = dobj.userData.destructible; break; }
                        dobj = dobj.parent;
                    }
                    if (dest) {
                        this._damageDestructible(dest, wep.damage, h.point);
                    } else {
                        // 打中不可破壞面：火花四濺 + 塵土
                        this.bursts.push(new Burst(this.scene, h.point, 0xffdd66, 8, 5, { life: 0.4 }));
                        this.bursts.push(new Burst(this.scene, h.point, 0x9a8a6a, 6, 3, { life: 0.6, size: 0.3 }));
                    }
                    break;
                }
            }

            // 輕度輔助瞄準：射線擦過 hitbox 邊緣 ~35cm 內就算中 (幫學生用普通滑鼠)
            if (!pelletHitEnemy && this.enemies.length) {
                const origin = this.raycaster.ray.origin;
                const rdir = this.raycaster.ray.direction;
                const wallDist = endPoint ? origin.distanceTo(endPoint) : 150;
                let best = null, bestPerp = Infinity;
                const chest = new THREE.Vector3();
                for (const e of this.enemies) {
                    if (e.dying) continue;
                    chest.set(e.group.position.x, e.group.position.y + e.radius * 1.05, e.group.position.z);
                    const toChest = chest.clone().sub(origin);
                    const along = toChest.dot(rdir); // 沿射線嘅距離
                    if (along < 1 || along > 90 || along > wallDist + 1) continue;
                    // 射線同胸口嘅垂直距離
                    const perp = toChest.sub(rdir.clone().multiplyScalar(along)).length();
                    const maxPerp = e.radius * 0.62 + 0.35; // hitbox 半徑 + 磁吸邊界
                    if (perp < maxPerp && perp < bestPerp) {
                        bestPerp = perp;
                        best = { e, point: chest.clone(), dist: along };
                    }
                }
                if (best) {
                    const isHead = false;
                    const dmg = wep.damage;
                    const rec = shotDmg.get(best.e) || { dmg: 0, point: best.point, head: false };
                    rec.dmg += dmg; rec.point = best.point;
                    shotDmg.set(best.e, rec);
                    const killed = this._damageEnemy(best.e, dmg, best.point, rdir);
                    anyHit = true;
                    if (killed) anyKill = true;
                    endPoint = best.point;
                }
            }

            if (!endPoint) {
                endPoint = this.raycaster.ray.origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(120));
            }
            this._addTracer(muzzlePos, endPoint, wep.color);
        }

        // 傷害數字 (每槍每隻喪屍一個，爆頭紅字)
        shotDmg.forEach((rec) => {
            this._spawnDmgText(rec.point, (rec.head ? '💥' : '') + '-' + Math.round(rec.dmg), rec.head ? '#ff5252' : '#ffd166');
        });
        if (anyHit) this._playHitSound(anyHead);

        // 槍口火光 (點光源 + 星形閃光) / 後座力 / 命中標記
        this.flashLight.color.set(wep.color);
        this.flashLight.position.copy(muzzlePos);
        this.flashLight.intensity = 4;
        this.muzzleFlashSprite.position.copy(muzzlePos);
        const fs = 0.5 + Math.random() * 0.4 + wep.level * 0.05;
        this.muzzleFlashSprite.scale.set(fs, fs, 1);
        this.muzzleFlashSprite.material.rotation = Math.random() * Math.PI * 2;
        this.muzzleFlashSprite.visible = true;
        this.flashTimer = 0.06;
        this.gunKick = Math.min(0.16, this.gunKick + 0.06);
        // 後座上抬 (累積落 recoilAccum，鬆手自動回復)
        const kick = wep.recoil * 0.0011 * (this.input.aim ? 0.65 : 1);
        this.camera.rotateX(kick);
        this.recoilAccum = Math.min(0.35, this.recoilAccum + kick);
        // 準星擴散
        this.bloom = Math.min(1, this.bloom + 0.18);
        if (anyHit) this._showHitmarker(anyKill, anyHead);
    }

    _addTracer(from, to, color) {
        // 粗身發光彈道：白熱核心 + 武器色光暈 (加法混色)
        const len = from.distanceTo(to);
        if (len < 0.1) return;
        const mid = from.clone().add(to).multiplyScalar(0.5);
        const dir = to.clone().sub(from).normalize();

        const group = new THREE.Group();
        const core = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, len, 5, 1, true),
            new THREE.MeshBasicMaterial({ color: 0xfffbe0, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        const glow = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, len, 5, 1, true),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        group.add(core, glow);
        // Cylinder 沿 Y 軸 → 對準彈道方向
        group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        group.position.copy(mid);
        this.scene.add(group);
        this.tracers.push({ line: group, core, glow, life: 0.12, maxLife: 0.12 });
    }

    // 註冊可破壞物件：加入場景 + 碰撞 + 標記 hp
    _addDestructible(group, hp, x, z, r, debrisColor) {
        if (!this.destructibles) this.destructibles = [];
        this.cratesGroup.add(group);
        const collider = { x, z, r };
        this.colliders.push(collider);
        const rec = { group, hp, maxHp: hp, collider, debrisColor, mats: [] };

        // 頭頂血條 (受傷先顯示)
        const box = new THREE.Box3().setFromObject(group);
        const topY = box.max.y + 0.4;
        const hpCanvas = document.createElement('canvas');
        hpCanvas.width = 96; hpCanvas.height = 16;
        const hpTex = new THREE.CanvasTexture(hpCanvas);
        const hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: hpTex, depthTest: false, transparent: true }));
        hpSprite.scale.set(Math.min(3, r * 2.2), 0.5, 1);
        hpSprite.position.set(x, topY, z);
        hpSprite.visible = false;
        hpSprite.raycast = () => {};
        this.cratesGroup.add(hpSprite);
        rec.hpSprite = hpSprite;
        rec.hpCanvas = hpCanvas;
        rec.hpTex = hpTex;

        group.traverse(o => {
            if (o.isMesh) {
                o.userData.destructible = rec;
                // clone material：閃白/摧毀時唔連累其他共用同一 material 嘅樹/箱
                if (o.material) {
                    o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
                    const ms = Array.isArray(o.material) ? o.material : [o.material];
                    ms.forEach(m => rec.mats.push(m));
                }
            }
        });
        this.destructibles.push(rec);
        return rec;
    }

    _drawDestructibleHpBar(rec) {
        const ctx = rec.hpCanvas.getContext('2d');
        const w = rec.hpCanvas.width, h = rec.hpCanvas.height;
        ctx.clearRect(0, 0, w, h);
        // 底
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, w, h);
        // 血 (綠→黃→紅)
        const pct = Math.max(0, rec.hp / rec.maxHp);
        ctx.fillStyle = pct > 0.5 ? '#4ade80' : (pct > 0.25 ? '#fbbf24' : '#ef4444');
        ctx.fillRect(2, 2, (w - 4) * pct, h - 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        rec.hpTex.needsUpdate = true;
    }

    _damageDestructible(rec, dmg, hitPoint) {
        if (rec.dead) return;
        rec.hp -= dmg;
        // 中彈碎屑 + 閃白
        this.bursts.push(new Burst(this.scene, hitPoint, rec.debrisColor, 6, 4, { life: 0.5, size: 0.25 }));
        rec.mats.forEach(m => { if (m.emissive) { m.emissive.setHex(0x555555); } });
        rec.flashT = 0.08;
        // 顯示血條 + 3 秒後自動收起
        if (rec.hpSprite) {
            rec.hpSprite.visible = true;
            this._drawDestructibleHpBar(rec);
            rec.hpShowT = 3;
        }
        if (rec.hp <= 0) this._destroyDestructible(rec);
    }

    _destroyDestructible(rec) {
        if (rec.dead) return;
        rec.dead = true;
        // 大量碎屑爆散
        const c = new THREE.Vector3();
        new THREE.Box3().setFromObject(rec.group).getCenter(c);
        this.bursts.push(new Burst(this.scene, c, rec.debrisColor, 40, 8, { life: 0.9, size: 0.3 }));
        this.bursts.push(new Burst(this.scene, c, 0x9a8a6a, 20, 5, { life: 1.1, size: 0.35 }));
        playSfx('emptyAmmoSfx'); // 崩塌「啪」聲 (借用現有音效)
        // 移除碰撞
        const ci = this.colliders.indexOf(rec.collider);
        if (ci >= 0) this.colliders.splice(ci, 1);
        // 移除模型 (只 dispose clone 咗嘅 material；geometry 共用，唔 dispose)
        this.cratesGroup.remove(rec.group);
        rec.mats.forEach(m => m.dispose());
        if (rec.hpSprite) {
            this.cratesGroup.remove(rec.hpSprite);
            rec.hpTex.dispose();
            rec.hpSprite.material.dispose();
        }
        const di = this.destructibles.indexOf(rec);
        if (di >= 0) this.destructibles.splice(di, 1);
        this._addLoot('💥 <b>建築物被摧毀</b>');
    }

    _damageEnemy(enemy, dmg, hitPoint, rayDir) {
        enemy.hp -= dmg;
        enemy.flash = 0.12;
        enemy.stagger = 0.15; // 中彈硬直
        enemy.mats.forEach(m => { if (m.emissive) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 0.55; } });
        this._drawEnemyHpBar(enemy);
        // 中彈擊退 (沿子彈方向，體型越大退越少)
        if (rayDir) {
            const push = 0.15 / enemy.tier;
            enemy.group.position.x += rayDir.x * push;
            enemy.group.position.z += rayDir.z * push;
        }
        // 喪屍中彈血花
        this.bursts.push(new Burst(this.scene, hitPoint, 0x8f1414, 10, 5, { life: 0.5, size: 0.28 }));
        this.bursts.push(new Burst(this.scene, hitPoint, 0xc62828, 5, 3.5, { life: 0.35 }));

        if (enemy.hp <= 0) {
            this._killEnemy(enemy);
            return true;
        }
        return false;
    }

    _killEnemy(enemy) {
        const pos = enemy.group.position.clone();
        pos.y += enemy.radius;
        // SAO 式格仔數據解體 (鮮艷發光碎片爆散) — 首領更誇張
        const cubeCount = enemy.tier === 5 ? this.quality.shardsBoss : this.quality.shardsNormal;
        this.shatters.push(new ShatterBurst(this.scene, pos, enemy.colorHex, cubeCount, enemy.tier === 5 ? 14 : 10));
        // 中心藍白閃光爆 (兩層)
        this.bursts.push(new Burst(this.scene, pos, 0xffffff, enemy.tier === 5 ? 90 : 40, 9, { life: 0.4, size: 0.35 }));
        this.bursts.push(new Burst(this.scene, pos, 0x8befff, enemy.tier === 5 ? 120 : 45, 7, { life: 0.6, size: 0.3 }));

        this.monstersLeft[enemy.tier]--;
        this.kills++;
        this._addKillFeed(enemy.name, enemy.tier);
        sfxZombieDeath();

        // 由活躍名單移除，但唔即刻消失 → 死亡動畫
        const idx = this.enemies.indexOf(enemy);
        if (idx >= 0) this.enemies.splice(idx, 1);
        enemy.dying = true;
        enemy.group.traverse(o => { o.raycast = () => {}; }); // 屍體唔再食子彈
        // 收埋血條
        enemy.group.children.forEach(c => { if (c.isSprite) c.visible = false; });
        // 有 Death 骨骼動畫就播佢；冇就用程序化向後倒
        let hasDeathAnim = false;
        if (enemy.actions && enemy.actions.death) {
            enemy.mixer.stopAllAction();
            const d = enemy.actions.death;
            d.reset();
            d.setLoop(THREE.LoopOnce);
            d.clampWhenFinished = true;
            d.play();
            hasDeathAnim = true;
        }
        this.corpses.push({ group: enemy.group, enemy, t: 0, hasDeathAnim });

        if (enemy.tier === 5) {
            this.ui.bossBar.style.display = 'none';
            this._addMsg('👑 喪屍王已被擊敗！', '#fbbf24');
        }

        if (this.kills >= this.TOTAL_MONSTERS) this._endGame(true);
    }

    _removeEnemy(enemy) {
        const idx = this.enemies.indexOf(enemy);
        if (idx >= 0) this.enemies.splice(idx, 1);
        this.enemiesGroup.remove(enemy.group);
        enemy.group.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
        });
    }

    _startReload() {
        if (this.weaponLevel < 0 || this.isReloading) return;
        const cap = WEAPONS[this.weaponLevel].magCapacity || 30;
        if (this.totalAmmo > 0 && this.magazine < cap) {
            this.isReloading = true;
            this.reloadTimer = 0.5;
            playSfx('reloadSfx');
        }
    }

    // -------------------------------------------------------------- 數學題流程
    _triggerMath(type) {
        this.lifecycle.transition(GAME_STATES.MATH);
        this.input.reset();
        this.controls.unlock();

        showMathQuestion({
            type,
            difficulty: this.difficulty,
            questionsSolved: this.questionsSolved,
            weaponLevel: this.weaponLevel,
            onResolve: (correct, topic) => this._onMathResolved(type, correct, topic)
        });
    }

    _onMathResolved(type, correct, topic) {
        if (this.disposed) return;

        // 學習統計 (賽後報告)
        this.mathStats.total++;
        if (!this.mathStats.byTopic[topic]) this.mathStats.byTopic[topic] = { c: 0, t: 0 };
        this.mathStats.byTopic[topic].t++;
        if (correct) {
            this.mathStats.correct++;
            this.mathStats.byTopic[topic].c++;
            sfxCorrect();
        } else {
            sfxWrong();
        }

        if (correct) {
            this.questionsSolved++;
            this.combo++;

            if (type === 'UPGRADE') {
                if (this.weaponLevel === -1) {
                    this.weaponLevel = 0;
                    this.magazine = WEAPONS[0].magCapacity || 30;
                    this.totalAmmo += WEAPONS[0].reloadAmmo || 30;
                    this._showWeaponToast(WEAPONS[0].name);
                    this._addLoot(`🔫 自動裝備 <b>${WEAPONS[0].name}</b>`);
                } else if (this.weaponLevel < WEAPONS.length - 1) {
                    this.weaponLevel++;
                    const ammoToAdd = WEAPONS[this.weaponLevel].reloadAmmo || 30;
                    this.totalAmmo += ammoToAdd;
                    this._showWeaponToast(WEAPONS[this.weaponLevel].name);
                    this._addLoot(`🔫 自動裝備 <b>${WEAPONS[this.weaponLevel].name}</b>`);
                    this._addLoot(`拾取 <b>彈藥 ×${ammoToAdd}</b>`);
                } else {
                    const ammoToAdd = WEAPONS[this.weaponLevel].reloadAmmo || 30;
                    this.totalAmmo += ammoToAdd;
                    this._addMsg(`⚡ 武器已達上限！`, '#fbbf24');
                    this._addLoot(`拾取 <b>彈藥 ×${ammoToAdd}</b>`);
                }
                sfxLevelUp();
                this.hp = Math.min(this.maxHp, this.hp + 50);
                this._addLoot(`💚 <b>HP +50</b>`);
                this._buildGunModel();
            } else {
                const ammoToAdd = (this.weaponLevel >= 0 && WEAPONS[this.weaponLevel].ammoBoxRefill) ? WEAPONS[this.weaponLevel].ammoBoxRefill : 30;
                this.totalAmmo += ammoToAdd;
                this._addMsg(`🔵 +${ammoToAdd} 總彈藥`, '#38bdf8');
            }

            // 能量 (Boost)：答啱題增加，提供回血 + 加速 (PUBG 能量飲品效果)
            this.boost = Math.min(100, this.boost + 40);
            this._addMsg('⚡ 能量 +40 (緩慢回血 + 移速加成)', '#f2a900');

            // 連擊獎勵：連續答啱 2 題以上，每題額外送彈藥
            if (this.combo >= 2) {
                const bonus = this.combo * 5;
                this.totalAmmo += bonus;
                this._addMsg(`🔥 連續答對 x${this.combo}！額外 +${bonus} 彈藥`, '#f97316');
            }
            this._updateComboTag();
        } else {
            this.combo = 0;
            this._updateComboTag();
            this.rageTimer = RAGE_DURATION;
            this._addMsg('❌ 答錯了！空投損毀，喪屍狂暴 5 秒！', '#ef4444');
        }

        this.freezeTimer = FREEZE_AFTER_MATH;

        // 等玩家點擊畫面重新鎖定滑鼠
        this.lifecycle.transition(GAME_STATES.RESUME_WAIT);
        if (isTouchMode()) this.resume('math-complete');
        else this.ui.resumeOverlay.style.display = 'flex';
    }

    _updateComboTag() {
        if (this.combo >= 2) {
            this.ui.combo.textContent = `🔥 連對 x${this.combo}`;
            this.ui.combo.style.display = 'block';
        } else {
            this.ui.combo.style.display = 'none';
        }
    }

    // -------------------------------------------------------------- 傷害 / 結束
    _hurtPlayer(dmg, fromPos) {
        this.hp -= dmg;
        this.fovPunch = 1;
        this.ui.vignette.style.opacity = '1';
        setTimeout(() => { if (!this.disposed) this.ui.vignette.style.opacity = '0'; }, 250);

        // 受擊方向指示器 (PUBG 式紅色弧形)
        if (fromPos) {
            const pos = this.camera.position;
            const dir = new THREE.Vector3();
            this.camera.getWorldDirection(dir);
            const dx = fromPos.x - pos.x, dz = fromPos.z - pos.z;
            // 攻擊者相對玩家面向嘅角度
            const worldAngle = Math.atan2(dx, dz);
            const faceAngle = Math.atan2(dir.x, dir.z);
            const rel = (worldAngle - faceAngle) * 180 / Math.PI;
            this.ui.dmgDir.style.transform = `translate(-50%, -50%) rotate(${rel}deg)`;
            this.ui.dmgDir.style.opacity = '1';
            clearTimeout(this._dmgDirTimer);
            this._dmgDirTimer = setTimeout(() => { if (!this.disposed) this.ui.dmgDir.style.opacity = '0'; }, 700);
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this._endGame(false);
        }
    }

    // 右側自動拾取通知 (PUBG Mobile 式)
    _addLoot(html) {
        const div = document.createElement('div');
        div.className = 'loot-entry';
        div.innerHTML = html;
        this.ui.lootFeed.appendChild(div);
        while (this.ui.lootFeed.children.length > 4) this.ui.lootFeed.removeChild(this.ui.lootFeed.firstChild);
        setTimeout(() => { div.classList.add('fade'); }, 2200);
        setTimeout(() => { div.remove(); }, 2900);
    }

    // 中央「獲得新武器」提示卡 (自動打開武器庫)
    _showWeaponToast(name) {
        this.ui.wepToastName.textContent = name;
        this.ui.wepToast.style.display = 'block';
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { if (!this.disposed) this.ui.wepToast.style.display = 'none'; }, 2600);
    }

    // 武器側面圖示 (畫喺武器卡片 canvas 上)
    _drawWeaponIcon() {
        const ctx = this.ui.wepIcon.getContext('2d');
        const w = this.ui.wepIcon.width, h = this.ui.wepIcon.height;
        ctx.clearRect(0, 0, w, h);
        if (this.weaponLevel < 0) {
            // 平底鑊側面圖示
            const cy = h / 2;
            ctx.fillStyle = '#46464c';
            ctx.fillRect(58, cy - 3, 46, 6);           // 手柄
            ctx.fillStyle = '#2f2f33';
            ctx.beginPath();
            ctx.ellipse(38, cy, 22, 13, 0, 0, Math.PI * 2); // 鑊身
            ctx.fill();
            ctx.strokeStyle = '#5a5a60'; ctx.lineWidth = 2.5;
            ctx.stroke();
            return;
        }
        const wep = WEAPONS[this.weaponLevel];
        const lvl = wep.level;
        const cy = h / 2;
        // 槍托
        ctx.fillStyle = '#5d4024';
        ctx.fillRect(6, cy - 5, 18, 12);
        // 槍身
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(22, cy - 7, 46, 13);
        // 彈匣
        ctx.fillStyle = '#334155';
        ctx.fillRect(40, cy + 5, 10, 12);
        // 握把
        ctx.fillStyle = '#475569';
        ctx.fillRect(28, cy + 6, 8, 10);
        // 槍管 (等級越高越長)
        const barrelLen = 28 + lvl * 3;
        ctx.fillStyle = '#475569';
        ctx.fillRect(68, cy - 4, barrelLen, 7);
        // 準星
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(60, cy - 12, 4, 6);
        // 發光槍口 (武器色)
        ctx.fillStyle = wep.color;
        ctx.shadowColor = wep.color; ctx.shadowBlur = 6;
        ctx.fillRect(68 + barrelLen, cy - 5, 8, 9);
        ctx.shadowBlur = 0;
    }

    _addKillFeed(name, tier) {
        const div = document.createElement('div');
        div.className = 'kf-entry';
        div.innerHTML = `<b>你</b> 🔫 擊倒了 ${tier === 5 ? '👑 ' : ''}${name}`;
        this.ui.killFeed.appendChild(div);
        while (this.ui.killFeed.children.length > 5) this.ui.killFeed.removeChild(this.ui.killFeed.firstChild);
        setTimeout(() => { div.classList.add('fade'); }, 3500);
        setTimeout(() => { div.remove(); }, 4400);
    }

    _endGame(victory) {
        if (this.state === GAME_STATES.OVER) return;
        this.lifecycle.transition(GAME_STATES.OVER);
        if (victory) sfxVictory();
        this.input.reset();
        const weaponName = this.weaponLevel >= 0 ? WEAPONS[this.weaponLevel].name : '無';
        setTimeout(() => {
            if (this.disposed) return;
            this.controls.unlock();
            this.onGameOver(victory, this.kills, this.TOTAL_MONSTERS, weaponName, this.mathStats);
        }, victory ? 1200 : 800);
    }

    abort() {
        if (this.state !== GAME_STATES.OVER) this.lifecycle.transition(GAME_STATES.OVER);
        this.input.reset();
        this.ui.pauseMenu.style.display = 'none';
        this.controls.unlock();
        this.onAbort();
    }

    // -------------------------------------------------------------- HUD
    _addMsg(text, color) {
        const div = document.createElement('div');
        div.className = 'hud-msg';
        div.style.color = color || '#fff';
        div.textContent = text;
        this.ui.msgStack.appendChild(div);
        while (this.ui.msgStack.children.length > 4) this.ui.msgStack.removeChild(this.ui.msgStack.firstChild);
        setTimeout(() => { div.classList.add('fade'); }, 2000);
        setTimeout(() => { div.remove(); }, 2600);
    }

    _showHitmarker(kill, headshot) {
        const hm = this.ui.hitmarker;
        hm.style.color = (kill || headshot) ? '#ff3b30' : '#ffffff';
        hm.style.opacity = '1';
        hm.style.transform = 'translate(-50%, -50%) scale(' + (kill ? 1.6 : (headshot ? 1.35 : 1)) + ')';
        clearTimeout(this._hmTimer);
        this._hmTimer = setTimeout(() => { hm.style.opacity = '0'; }, headshot ? 130 : 90);
    }

    _updateHUD(force) {
        const L = this.lastHUD;
        if (force || L.hp !== this.hp) {
            const pct = Math.max(0, this.hp) / this.maxHp * 100;
            this.ui.hpFill.style.width = pct + '%';
            // PUBG 式血條：白色 → 低血量轉紅
            this.ui.hpFill.style.backgroundColor = pct > 40 ? '#ffffff' : (pct > 20 ? '#f59e0b' : '#ef4444');
            this.ui.hpText.textContent = Math.max(0, Math.round(this.hp));
            L.hp = this.hp;
        }
        // 能量條 (4 段式，PUBG 式)
        const boostKey = Math.round(this.boost);
        if (force || L.boost !== boostKey) {
            for (let i = 0; i < 4; i++) {
                const segFill = Math.max(0, Math.min(25, this.boost - i * 25)) / 25 * 100;
                if (this.boostSegs[i]) this.boostSegs[i].style.width = segFill + '%';
            }
            L.boost = boostKey;
        }
        const wepKey = this.weaponLevel + '|' + this.magazine + '|' + this.totalAmmo + '|' + this.isReloading;
        if (force || L.wepKey !== wepKey) {
            if (this.weaponLevel >= 0) {
                this.ui.wep.textContent = WEAPONS[this.weaponLevel].name;
                this.ui.ammoBig.innerHTML = this.isReloading
                    ? `<span style="font-size:20px;">換彈中...</span>`
                    : `${this.magazine}<span> / ${this.totalAmmo}</span>`;
            } else {
                this.ui.wep.textContent = '🍳 平底鑊 (搵空投升級!)';
                this.ui.ammoBig.innerHTML = `<span style="font-size:20px;">近戰</span>`;
            }
            for (let i = 0; i < this.wepPipEls.length; i++) {
                this.wepPipEls[i].classList.toggle('on', i <= this.weaponLevel);
            }
            if (L.wepLvl !== this.weaponLevel) {
                this._drawWeaponIcon();
                L.wepLvl = this.weaponLevel;
            }
            L.wepKey = wepKey;
        }
        if (force || L.kills !== this.kills) {
            this.ui.statLeft.textContent = Math.max(0, this.TOTAL_MONSTERS - this.kills);
            this.ui.statKills.textContent = this.kills;
            let parts = [];
            for (let t = 1; t <= 5; t++) {
                if (this.monstersLeft[t] > 0) parts.push(`${t === 5 ? '👑' : 'Lv' + t}×${this.monstersLeft[t]}`);
            }
            this.ui.monsters.textContent = parts.length ? parts.join('　') : '全部消滅！';
            L.kills = this.kills;
        }
        // 首領血條
        const boss = this.enemies.find(e => e.tier === 5);
        if (boss) {
            this.ui.bossBarFill.style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
        }
        // 凍結/狂暴標籤
        if (this.freezeTimer > 0) {
            this.ui.freezeTag.textContent = '❄️ 喪屍凍結中';
            this.ui.freezeTag.style.display = 'block';
            this.ui.freezeTag.style.color = '#7dd3fc';
        } else if (this.rageTimer > 0) {
            this.ui.freezeTag.textContent = `😡 喪屍狂暴中 ${this.rageTimer.toFixed(1)}s`;
            this.ui.freezeTag.style.display = 'block';
            this.ui.freezeTag.style.color = '#f87171';
        } else {
            this.ui.freezeTag.style.display = 'none';
        }
    }

    // -------------------------------------------------------------- 方形地圖 (PUBG 式，北向固定)
    _drawMinimap() {
        const ctx = this.minimapCtx;
        const size = this.ui.minimap.width;
        const pad = 8;
        const c0 = size / 2;
        const span = this.school ? Math.max(BUILD_HX, BUILD_HZ) + 3 : HALF;
        const scale = (size / 2 - pad) / span;
        const toMap = (wx, wz) => [c0 + wx * scale, c0 + wz * scale];

        ctx.clearRect(0, 0, size, size);

        // 圓形雷達裁切 (PUBG Mobile 式)
        ctx.save();
        ctx.beginPath();
        ctx.arc(c0, c0, size / 2 - 2, 0, Math.PI * 2);
        ctx.clip();
        // 圓底
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.fillRect(0, 0, size, size);

        const rect = (x0, z0, x1, z1, color) => {
            const [ax, az] = toMap(x0, z0);
            ctx.fillStyle = color;
            ctx.fillRect(ax, az, (x1 - x0) * scale, (z1 - z0) * scale);
        };

        if (this.school) {
            // 校舍建築 (灰) + 操場 (綠) + 籃球場 (藍)
            rect(-BUILD_HX, -BUILD_HZ, BUILD_HX, BUILD_HZ, 'rgba(120,120,130,0.85)');
            rect(-COURT_HX, -COURT_HZ, COURT_HX, COURT_HZ, 'rgba(70,150,95,0.9)');
            rect(-COURT_HX * 0.85, -COURT_HZ * 0.85, COURT_HX * 0.85, COURT_HZ * 0.85, 'rgba(63,124,174,0.9)');
        } else {
            // 草地：牆外變暗，牆內亮綠 + 白色邊框顯示現時圍牆
            rect(-HALF, -HALF, HALF, HALF, 'rgba(45,65,40,0.85)');
            const hx = this.arenaShrink ? this.arenaShrink.hx : HALF;
            rect(-hx, -hx, hx, hx, 'rgba(90,140,70,0.95)');
            ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2;
            const [wx, wz] = toMap(-hx, -hx);
            ctx.strokeRect(wx, wz, hx * 2 * scale, hx * 2 * scale);
        }

        ctx.save();
        ctx.beginPath(); ctx.arc(c0, c0, size / 2 - 3, 0, Math.PI * 2); ctx.clip();

        // 寶箱 (金/藍方點，無黑邊)
        for (const p of this.pickups) {
            const [sx, sy] = toMap(p.group.position.x, p.group.position.z);
            ctx.fillStyle = p.type === 'UPGRADE' ? '#f2a900' : '#60a5fa';
            ctx.fillRect(sx - 3, sy - 3, 6, 6);
        }

        // 喪屍：用喪屍頭像 (emoji) 取代紅點；首領大隻
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const e of this.enemies) {
            if (e.dying) continue;
            const [sx, sy] = toMap(e.group.position.x, e.group.position.z);
            const fs = e.tier === 5 ? 17 : 12;
            ctx.font = `${fs}px "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
            ctx.fillText('🧟', sx, sy);
            if (e.tier === 5) ctx.fillText('👑', sx, sy - fs * 0.55); // 喪屍王加皇冠
        }
        ctx.restore();

        // 玩家箭頭 (準確指向公仔面向方向)
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        const [px, py] = toMap(this.camera.position.x, this.camera.position.z);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.atan2(dir.z, dir.x) + Math.PI / 2); // 面向方向 = 箭嘴方向
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(-5, 6); ctx.lineTo(0, 3); ctx.lineTo(5, 6);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();

        // 完成圓形裁切 + 畫圓框
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c0, c0, size / 2 - 2, 0, Math.PI * 2);
        ctx.stroke();
    }

    // -------------------------------------------------------------- 頂部羅盤 (PUBG 式)
    _drawCompass() {
        const ctx = this.compassCtx;
        const w = this.ui.compass.width, h = this.ui.compass.height;
        ctx.clearRect(0, 0, w, h);

        // 半透明底
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(0, 0, w, h);

        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        // 北 = -Z；順時針角度 0-360
        let headingDeg = Math.atan2(dir.x, -dir.z) * 180 / Math.PI;
        if (headingDeg < 0) headingDeg += 360;

        const pxPerDeg = 4;
        const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

        ctx.textAlign = 'center';
        for (let d = -65; d <= 65; d += 5) {
            let deg = Math.round((headingDeg + d) / 5) * 5;
            const offset = deg - headingDeg;
            const x = w / 2 + offset * pxPerDeg;
            if (x < 8 || x > w - 8) continue;
            let norm = ((deg % 360) + 360) % 360;

            if (norm % 45 === 0) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px Arial';
                ctx.fillText(labels[norm], x, 15);
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fillRect(x - 1, 20, 2, 9);
            } else if (norm % 15 === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.font = '10px Arial';
                ctx.fillText(String(norm), x, 14);
                ctx.fillRect(x - 0.5, 20, 1, 7);
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.fillRect(x - 0.5, 22, 1, 5);
            }
        }
    }

    // -------------------------------------------------------------- 主迴圈
    _animate() {
        if (this.disposed) return;
        this._raf = requestAnimationFrame(() => this._animate());
        const dt = Math.min(this.clock.getDelta(), 0.05);

        if (this.state === GAME_STATES.PLAYING) {
            this.time += dt;
            this._updatePlaying(dt);
        }
        this._updateEffects(dt);
        this._updateHUD(false);
        this._drawMinimap();
        this._drawCompass();
        this._lastDt = dt;
        this._renderView();
        this._updateCrosshair();
        this._updateThreatEdges();
        this._watchPerf(dt);
    }

    // 實測跌幀 → 即時降 pixelRatio (唯一唔使重建場景就見效嘅手段)，並記低下一局降級
    _watchPerf(dt) {
        if (this.state !== GAME_STATES.PLAYING) return;
        const p = this._perf || (this._perf = { t: 0, frames: 0, drops: 0 });
        p.t += dt; p.frames++;
        if (p.t < 3) return;
        const fps = p.frames / p.t;
        p.t = 0; p.frames = 0;
        if (fps >= 40 || p.drops >= 2) return;
        p.drops++;
        this._pixelRatio = Math.max(0.6, this._pixelRatio - 0.25);
        this.renderer.setPixelRatio(this._pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        downgradeQuality();     // 下一局用低一級設定開場
        console.warn(`[perf] ${fps.toFixed(1)} fps → pixelRatio ${this._pixelRatio.toFixed(2)}`);
    }

    // 近距喪屍：喺畫面對應嗰邊亮紅色警告 (方便學生辨方向)
    _updateThreatEdges() {
        const te = this.ui.threatEdges;
        if (!te || !te.top) return;
        const WARN_DIST = 30; // 幾多米內先警告

        // 相機面向 (前) 同右方向 (world XZ 平面)
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        const fx = dir.x, fz = dir.z;
        const rx = -fz, rz = fx; // 右 = 前向量順時針轉 90°
        const pos = this.camera.position;

        // 四邊各記錄最強威脅 (越近越強)
        const intensity = { top: 0, bottom: 0, left: 0, right: 0 };
        if (this.state === GAME_STATES.PLAYING) {
            for (const e of this.enemies) {
                if (e.dying) continue;
                const dx = e.group.position.x - pos.x;
                const dz = e.group.position.z - pos.z;
                const d = Math.hypot(dx, dz);
                if (d > WARN_DIST) continue;
                const forward = (dx * fx + dz * fz) / (d || 1); // >0 前 <0 後
                const right = (dx * rx + dz * rz) / (d || 1);    // >0 右 <0 左
                const str = 1 - d / WARN_DIST; // 0-1，越近越大
                // 揀最主要方向 (前/後/左/右)
                if (Math.abs(forward) >= Math.abs(right)) {
                    if (forward >= 0) intensity.top = Math.max(intensity.top, str);
                    else intensity.bottom = Math.max(intensity.bottom, str);
                } else {
                    if (right >= 0) intensity.right = Math.max(intensity.right, str);
                    else intensity.left = Math.max(intensity.left, str);
                }
            }
        }

        // 套用 (脈動增加緊張感)
        const pulse = 0.7 + Math.abs(Math.sin(this.time * 6)) * 0.3;
        const apply = (edge, arrow, val) => {
            const o = val > 0.02 ? Math.min(1, val * 1.3) * pulse : 0;
            edge.style.opacity = o.toFixed(2);
            arrow.style.opacity = (o > 0.15 ? Math.min(1, o + 0.2) : 0).toFixed(2);
        };
        apply(te.top, te.atop, intensity.top);
        apply(te.bottom, te.abottom, intensity.bottom);
        apply(te.left, te.aleft, intensity.left);
        apply(te.right, te.aright, intensity.right);
    }

    // 依視角模式渲染：TPP 時相機臨時退後過肩，渲染完還原
    _renderView() {
        if (this.viewMode !== 'TPP' || !this.playerModel) {
            if (this.playerModel) this.playerModel.visible = false;
            this.gunGroup.visible = true;
            this._tppOffsetVec = null;
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const pivot = this.camera.position.clone();
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);

        // 更新角色模型位置與朝向
        this.playerModel.visible = true;
        this.gunGroup.visible = false;
        this.playerModel.position.set(pivot.x, pivot.y - EYE_HEIGHT, pivot.z);
        this.playerModel.rotation.y = Math.atan2(dir.x, dir.z);
        // 士兵骨骼動畫：企定 Idle / 移動 Run_Gun / 開槍 Idle_Shoot
        if (this.playerMixer && this.state === GAME_STATES.PLAYING) {
            let anim = 'idle';
            if (this._movingNow) anim = 'run';
            else if (this.input.fire && this.weaponLevel >= 0) anim = 'shoot';
            this._setPlayerAnim(anim);
            // 疾跑時動畫加速
            this.playerMixer.timeScale = this._sprintingNow ? 1.5 : 1;
            this.playerMixer.update(this._lastDt || 0.016);
        }

        // 相機退後過肩 (右肩 + 升高)，並防止穿牆
        let dist = this.input.aim ? 2.2 : 4.3;
        this._tppRaycaster.camera = this.camera; // Sprite 射線判定需要 camera，唔設會 throw
        this._tppRaycaster.set(pivot, dir.clone().negate());
        this._tppRaycaster.far = dist + 0.5;
        const hits = this._tppRaycaster.intersectObjects([this.wallsGroup, this.cratesGroup], true);
        if (hits.length && hits[0].distance < dist) dist = Math.max(1.0, hits[0].distance - 0.3);

        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        this.camera.position.addScaledVector(dir, -dist);
        this.camera.position.addScaledVector(right, 0.55);
        this.camera.position.y += 0.5;

        // 記低偏移量：射擊射線用同一位置，準星先會指邊打邊 (修正視差)
        this._tppOffsetVec = this.camera.position.clone().sub(pivot);

        this.renderer.render(this.scene, this.camera);
        this.camera.position.copy(pivot);
    }

    _updatePlaying(dt) {
        const look = this.input.consumeLookDelta();
        if (isTouchMode() && (look.x || look.y)) {
            const euler = this._touchLookEuler || (this._touchLookEuler = new THREE.Euler(0, 0, 0, 'YXZ'));
            euler.setFromQuaternion(this.camera.quaternion);
            const sensitivity = 0.0022 * this.baseSens;
            euler.y -= look.x * sensitivity;
            euler.x -= look.y * sensitivity;
            euler.x = Math.max(-Math.PI / 2 + 0.08, Math.min(Math.PI / 2 - 0.08, euler.x));
            this.camera.quaternion.setFromEuler(euler);
        }

        // ---- 計時生成
        this.lootTimer += dt; this.ammoTimer += dt; this.spawnTimer += dt;
        if (this.lootTimer >= SETTINGS.lootBoxInterval) { this.lootTimer = 0; this._spawnPickup('UPGRADE'); }
        if (this.weaponLevel >= 0 && this.ammoTimer >= SETTINGS.ammoBoxInterval) { this.ammoTimer = 0; this._spawnPickup('AMMO'); }
        if (this.monsterQueue.length > 0 && (this.enemies.length < 4 ? this.spawnTimer >= 0.6 : this.spawnTimer >= 3)) {
            this.spawnTimer = 0;
            this._spawnEnemy();
        }

        if (this.freezeTimer > 0) this.freezeTimer -= dt;
        if (this.rageTimer > 0) this.rageTimer -= dt;
        if (this.bossAlarm > 0) {
            this.bossAlarm -= dt;
            this.ui.bossFlash.style.opacity = String(Math.abs(Math.sin(this.bossAlarm * 6)) * 0.35);
            if (this.bossAlarm <= 0) this.ui.bossFlash.style.opacity = '0';
        }

        // ---- 換彈
        if (this.isReloading) {
            this.reloadTimer -= dt;
            if (this.reloadTimer <= 0) {
                const cap = WEAPONS[this.weaponLevel].magCapacity || 30;
                const need = cap - this.magazine;
                const load = Math.min(need, this.totalAmmo);
                this.magazine += load;
                this.totalAmmo -= load;
                this.isReloading = false;
            }
        }

        // ---- 移動 (Shift 疾跑 / 能量加速 / 開鏡減速)
        const speedCfg = this.weaponLevel >= 0 ? WEAPONS[this.weaponLevel].playerSpeed : SETTINGS.basePlayerSpeed;
        let speed = speedCfg * 1.5;
        let mx = 0, mz = 0;
        if (this.input.movement.w) mz += 1;
        if (this.input.movement.s) mz -= 1;
        if (this.input.movement.a) mx -= 1;
        if (this.input.movement.d) mx += 1;
        const moving = (mx !== 0 || mz !== 0);
        this._movingNow = moving;
        const sprinting = this.input.sprint && moving && !this.input.aim;
        if (sprinting) speed *= 1.4;
        if (this.input.aim) speed *= 0.6;
        if (this.boost > 70) speed *= 1.12;
        else if (this.boost > 30) speed *= 1.06;
        if (moving) {
            const len = Math.hypot(mx, mz);
            this.controls.moveForward((mz / len) * speed * dt);
            this.controls.moveRight((mx / len) * speed * dt);
        }
        this._sprintingNow = sprinting;

        // ---- 能量 (Boost)：緩慢消耗，提供回血
        if (this.boost > 0) {
            this.boost = Math.max(0, this.boost - 1.2 * dt);
            this.healAcc += 0.9 * dt;
            if (this.healAcc >= 1) {
                this.healAcc -= 1;
                if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 1);
            }
        }

        // ---- 低血心跳聲
        if (this.hp > 0 && this.hp < 30) {
            this.heartbeatT -= dt;
            if (this.heartbeatT <= 0) {
                sfxHeartbeat();
                this.heartbeatT = this.hp < 15 ? 0.6 : 0.9;
            }
        }

        // ---- 藍圈
        this._updateZone(dt);
        if (this.state !== GAME_STATES.PLAYING) return;

        // ---- 開鏡瞄準時滑鼠減速
        this.controls.pointerSpeed = this.baseSens * (this.input.aim ? 0.55 : 1);

        // 邊界 + 障礙物碰撞
        const pos = this.camera.position;
        pos.x = Math.max(-this.playHX + 1.5, Math.min(this.playHX - 1.5, pos.x));
        pos.z = Math.max(-this.playHZ + 1.5, Math.min(this.playHZ - 1.5, pos.z));
        for (const cld of this.colliders) {
            const dx = pos.x - cld.x, dz = pos.z - cld.z;
            const d = Math.hypot(dx, dz);
            const minD = cld.r + 0.8;
            if (d < minD && d > 0.001) {
                pos.x = cld.x + (dx / d) * minD;
                pos.z = cld.z + (dz / d) * minD;
            }
        }

        // 走路搖晃
        if (moving) this.bobPhase += dt * 9;
        pos.y = EYE_HEIGHT + (moving ? Math.sin(this.bobPhase) * 0.045 : 0);

        // ---- 射擊 (疾跑中不能開槍，同 PUBG 一樣)
        if (this.input.fire && !this._sprintingNow) this._tryShoot();

        // ---- 魔物 AI
        const frozen = this.freezeTimer > 0;
        const rage = this.rageTimer > 0 ? 1.5 : 1;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            const g = e.group;
            const dx = pos.x - g.position.x, dz = pos.z - g.position.z;
            const dist = Math.hypot(dx, dz);

            if (e.stagger > 0) e.stagger -= dt;
            if (!frozen && e.stagger <= 0 && dist > 0.01) {
                const step = e.speed * rage * dt;
                if (dist > e.radius + 1.2) {
                    g.position.x += (dx / dist) * step;
                    g.position.z += (dz / dist) * step;
                }
                g.lookAt(pos.x, g.position.y, pos.z);
            }
            // 魔物間簡單分離
            for (let j = i + 1; j < this.enemies.length; j++) {
                const o = this.enemies[j];
                const sx = g.position.x - o.group.position.x, sz = g.position.z - o.group.position.z;
                const sd = Math.hypot(sx, sz);
                const minSd = e.radius + o.radius;
                if (sd < minSd && sd > 0.001) {
                    const push = (minSd - sd) / 2;
                    g.position.x += (sx / sd) * push; g.position.z += (sz / sd) * push;
                    o.group.position.x -= (sx / sd) * push; o.group.position.z -= (sz / sd) * push;
                }
            }
            // 障礙物碰撞
            for (const cld of this.colliders) {
                const cx = g.position.x - cld.x, cz = g.position.z - cld.z;
                const cd = Math.hypot(cx, cz);
                const minCd = cld.r + e.radius * 0.6;
                if (cd < minCd && cd > 0.001) {
                    g.position.x = cld.x + (cx / cd) * minCd;
                    g.position.z = cld.z + (cz / cd) * minCd;
                }
            }
            // 收縮圍牆一樣推埋喪屍入嚟
            if (!this.school) {
                const lim = this.playHX - 0.5;
                g.position.x = Math.max(-lim, Math.min(lim, g.position.x));
                g.position.z = Math.max(-lim, Math.min(lim, g.position.z));
            }

            // 骨骼動畫更新 (凍結時暫停；狂暴時加速)
            if (e.mixer && !frozen) e.mixer.update(dt * rage);

            // 隨機低吼 (音量隨距離衰減，行近先聽得清)
            e.growlT -= dt;
            if (e.growlT <= 0) {
                e.growlT = 4 + Math.random() * 7;
                if (dist < 45) sfxZombieGrowl(1 - dist / 45);
            }

            // 受擊閃白衰減
            if (e.flash > 0) {
                e.flash -= dt;
                if (e.flash <= 0) {
                    e.mats.forEach(m => { if (m.emissive) { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; } });
                }
            }

            // 攻擊玩家
            if (e.attackCd > 0) e.attackCd -= dt;
            if (!frozen && dist < e.radius + 1.8 && e.attackCd <= 0) {
                e.attackCd = 1;
                sfxZombieAttack();
                this._hurtPlayer(10 + e.tier * 5, g.position);
                if (this.state !== GAME_STATES.PLAYING) return;
            }
        }

        // ---- 補給箱 (PUBG Mobile 式自動拾取)
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];

            // 空投下降階段
            if (p.falling) {
                p.group.position.y -= 6.5 * dt;
                p.group.rotation.y += dt * 0.4;
                if (p.group.position.y <= 0) {
                    p.group.position.y = 0;
                    p.falling = false;
                    if (p.parachute) p.parachute.visible = false;
                    this.bursts.push(new Burst(this.scene, p.group.position.clone().setY(0.5), 0xc0392b, 20, 5));
                    this._addMsg('📦 空投已著陸！行近自動開啟！', '#ff6b5b');
                }
                continue; // 落地前不倒數、不可拾取
            }

            p.life -= dt;

            // 信號光柱脈動 + 緩慢旋轉；弱光 (彈藥箱) 用柔和數值，強光 (升級) 搶眼
            if (p.goldBeam) {
                p.spin += dt;
                p.goldBeam.rotation.y = p.spin * 0.6;
                const dim = p.goldBeam.userData.dim;
                const pulse = dim
                    ? 0.7 + Math.abs(Math.sin(this.time * 2.2)) * 0.3   // 柔和慢脈動
                    : 0.8 + Math.abs(Math.sin(this.time * 3.5)) * 0.5;  // 搶眼快脈動
                const parts = p.goldBeam.children;
                const oOuter = dim ? 0.07 : 0.16;
                const oCore = dim ? 0.16 : 0.4;
                const oDisc = dim ? 0.22 : 0.5;
                const lInt = dim ? 0.5 : 2;
                if (parts[0] && parts[0].material) parts[0].material.opacity = oOuter * pulse;
                if (parts[1] && parts[1].material) parts[1].material.opacity = oCore * pulse;
                if (parts[2] && parts[2].material) parts[2].material.opacity = oDisc * pulse;
                if (parts[3] && parts[3].isLight) parts[3].intensity = lInt * pulse;
            }

            if (p.type === 'UPGRADE') {
                // 彈藥箱輕微浮動提示
                p.spin += dt * 2;
                p.box.rotation.y = p.spin * 0.5;
            }

            if (p.life <= 0) {
                this.bursts.push(new Burst(this.scene, p.group.position.clone().setY(1), 0x94a3b8, 12, 4));
                this._removePickup(i);
                continue;
            }
            // 最後 3 秒閃爍
            p.group.visible = !(p.life < 3 && Math.floor(p.life * 5) % 2 === 0);

            // 自動拾取判定
            const d = Math.hypot(pos.x - p.group.position.x, pos.z - p.group.position.z);
            if (d < PICKUP_RADIUS) {
                if (p.type === 'AMMO') {
                    // 自動補給子彈 (唔使答題，PUBG Mobile 自動拾取)
                    const ammoToAdd = (this.weaponLevel >= 0 && WEAPONS[this.weaponLevel].ammoBoxRefill) ? WEAPONS[this.weaponLevel].ammoBoxRefill : 30;
                    this.totalAmmo += ammoToAdd;
                    this._addLoot(`🔫 自動拾取 <b>彈藥 ×${ammoToAdd}</b>`);
                    playSfx('reloadSfx');
                    this.bursts.push(new Burst(this.scene, p.group.position.clone().setY(0.8), 0x60a5fa, 15, 4));
                    this._removePickup(i);
                } else {
                    // 空投包裹：自動開啟 → 數學挑戰
                    this.bursts.push(new Burst(this.scene, p.group.position.clone().setY(1), 0xeab308, 25, 6));
                    this._removePickup(i);
                    this._triggerMath('UPGRADE');
                    return;
                }
            }
        }
    }

    _removePickup(idx) {
        const p = this.pickups[idx];
        this.pickupsGroup.remove(p.group);
        p.group.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
        });
        this.pickups.splice(idx, 1);
    }

    _updateEffects(dt) {
        // 雲朵飄移
        if (this.clouds) {
            for (const c of this.clouds) {
                c.sprite.position.x += c.speed * dt;
                if (c.sprite.position.x > 150) c.sprite.position.x = -150;
            }
        }
        // 粒子
        for (let i = this.bursts.length - 1; i >= 0; i--) {
            if (!this.bursts[i].update(dt)) {
                this.bursts[i].dispose();
                this.bursts.splice(i, 1);
            }
        }
        // SAO 格仔解體碎片
        for (let i = this.shatters.length - 1; i >= 0; i--) {
            if (!this.shatters[i].update(dt)) {
                this.shatters[i].dispose();
                this.shatters.splice(i, 1);
            }
        }
        // 彈道光束
        for (let i = this.tracers.length - 1; i >= 0; i--) {
            const t = this.tracers[i];
            t.life -= dt;
            if (t.life <= 0) {
                this.scene.remove(t.line);
                t.line.traverse(o => {
                    if (o.geometry) o.geometry.dispose();
                    if (o.material) o.material.dispose();
                });
                this.tracers.splice(i, 1);
            } else {
                const k = t.life / t.maxLife;
                if (t.core) { t.core.material.opacity = k; t.glow.material.opacity = k * 0.4; }
            }
        }
        // 槍口火光
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) {
                this.flashLight.intensity = 0;
                this.muzzleFlashSprite.visible = false;
            }
        }
        // 後座力自動回復 (鬆手後鏡頭滑返落原位，PUBG 式)
        if (this.recoilAccum > 0 && !this.input.fire) {
            const rec = Math.min(this.recoilAccum, dt * 0.5);
            this.camera.rotateX(-rec);
            this.recoilAccum -= rec;
        }
        // 準星擴散衰減
        if (this.bloom > 0) this.bloom = Math.max(0, this.bloom - dt * 2.2);
        // 死亡動畫 → 沉入地面 → 清理
        for (let i = this.corpses.length - 1; i >= 0; i--) {
            const c = this.corpses[i];
            c.t += dt;
            if (c.hasDeathAnim && c.enemy.mixer) {
                c.enemy.mixer.update(dt); // 播 Death 骨骼動畫
            } else {
                const fall = Math.min(1, c.t / 0.4);
                c.group.rotation.x = -(fall * fall) * (Math.PI / 2 - 0.08);
            }
            if (c.t > 1.4) c.group.position.y -= dt * 1.5;
            if (c.t > 2.3) {
                this.enemiesGroup.remove(c.group);
                c.group.traverse(o => {
                    if (o.geometry) o.geometry.dispose();
                    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
                });
                this.corpses.splice(i, 1);
            }
        }
        // 浮動傷害數字 (升起 + 淡出)
        for (let i = this.dmgTexts.length - 1; i >= 0; i--) {
            const t = this.dmgTexts[i];
            t.life -= dt;
            if (t.life <= 0) {
                this._disposeDmgText(t);
                this.dmgTexts.splice(i, 1);
            } else {
                t.sprite.position.y += dt * 1.4;
                t.sprite.material.opacity = t.life / t.maxLife;
            }
        }
        // 槍後座復位
        if (this.gunKick > 0) {
            this.gunKick = Math.max(0, this.gunKick - dt * 0.9);
        }
        // 平底鑊揮擊進度 (0.45 秒一下)
        if (this.panSwing > 0) {
            this.panSwing = Math.max(0, this.panSwing - dt * 2.2);
        }
        // 可破壞物件受擊閃白衰減 + 血條倒數收起
        if (this.destructibles) {
            for (const rec of this.destructibles) {
                if (rec.flashT > 0) {
                    rec.flashT -= dt;
                    if (rec.flashT <= 0) rec.mats.forEach(m => { if (m.emissive) m.emissive.setHex(0x000000); });
                }
                if (rec.hpShowT > 0) {
                    rec.hpShowT -= dt;
                    if (rec.hpShowT <= 0 && rec.hpSprite) rec.hpSprite.visible = false;
                }
            }
        }
        // 營火閃爍
        if (this.campFlames) {
            const t = performance.now() * 0.001;
            for (const f of this.campFlames) {
                const flick = 0.85 + Math.sin(t * 11 + f.phase) * 0.12 + Math.sin(t * 23 + f.phase * 2) * 0.06;
                f.sprite.scale.y = (1.2 - f.phase * 0.14) * flick;
                f.sprite.material.opacity = 0.75 + flick * 0.2;
            }
            if (this.campLight) this.campLight.intensity = 1.2 + Math.sin(t * 13) * 0.3 + Math.random() * 0.12;
        }
        if (this.gunGroup && this.gunBase) {
            if (this.panSwing > 0) {
                // 近戰大動作揮擊：空手用鑊，有槍時用槍托。
                const k = 1 - this.panSwing;                 // 0 → 1
                const e = 1 - Math.pow(1 - k, 2);            // ease-out：起手快
                this.gunGroup.position.x = 0.55 - e * 1.0;   // 右 0.55 → 左 -0.45
                this.gunGroup.position.y = 0.25 - e * 0.85;  // 上 0.25 → 下 -0.6
                this.gunGroup.position.z = this.gunBase.z - 0.15;
                this.gunGroup.rotation.z = 0.9 - e * 2.0;    // 鑊面隨手轉
                this.gunGroup.rotation.x = -0.5 + e * 1.1;
            } else {
                // 疾跑收槍 / 開鏡舉槍至中央 (PUBG 式)
                const hasGun = this.weaponLevel >= 0;
                const sprintLower = this._sprintingNow ? 0.18 : 0;
                const aimX = (this.input.aim && hasGun) ? 0.02 : this.gunBase.x;
                const aimY = (this.input.aim && hasGun) ? -0.18 : this.gunBase.y;
                this.gunGroup.position.x += (aimX - this.gunGroup.position.x) * Math.min(1, dt * 12);
                this.gunGroup.position.y += ((aimY - sprintLower) - this.gunGroup.position.y) * Math.min(1, dt * 10);
                this.gunGroup.position.z = this.gunBase.z + this.gunKick;
                this.gunGroup.rotation.x = this.gunKick * 1.2 + (this._sprintingNow ? -0.5 : 0);
                // 揮擊完慢慢轉返正
                this.gunGroup.rotation.z += (0 - this.gunGroup.rotation.z) * Math.min(1, dt * 10);
            }
        }
        // 第三人稱：手上近戰武器／槍托跟住揮。
        if (this.tpGunWrap && this.panSwing > 0) {
            const k = Math.sin((1 - this.panSwing) * Math.PI);
            this.tpGunWrap.rotation.x = -k * 1.4;
        } else if (this.tpGunWrap) {
            this.tpGunWrap.rotation.x += (0 - this.tpGunWrap.rotation.x) * Math.min(1, dt * 10);
        }
        // FOV：開鏡縮放 + 受傷震動
        if (this.fovPunch > 0) this.fovPunch = Math.max(0, this.fovPunch - dt * 4);
        const targetFov = (this.input.aim ? 52 : 75) + this.fovPunch * 5;
        if (Math.abs(this.camera.fov - targetFov) > 0.1) {
            this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 10);
            this.camera.updateProjectionMatrix();
        }
    }

    // -------------------------------------------------------------- 清理
    dispose() {
        this.disposed = true;
        cancelAnimationFrame(this._raf);

        this.touchControls.dispose();
        this.input.dispose();
        document.removeEventListener('contextmenu', this._onContextMenu);
        document.removeEventListener('visibilitychange', this._onVisibilityChange);
        document.removeEventListener('pointerlockerror', this._onPointerLockError);
        window.removeEventListener('resize', this._onResize);
        this.controls.removeEventListener('lock', this._onLock);
        this.controls.removeEventListener('unlock', this._onUnlock);
        this.ui.resumeOverlay.removeEventListener('click', this._onResumeClick);
        document.getElementById('btn-resume').removeEventListener('click', this._onBtnResume);
        document.getElementById('btn-touch-pause').removeEventListener('click', this._onBtnTouchPause);
        document.getElementById('btn-quit').removeEventListener('click', this._onBtnQuit);
        document.getElementById('sens-slider').removeEventListener('input', this._onSens);

        this.bursts.forEach(b => b.dispose());
        this.shatters.forEach(s => s.dispose());
        this.tracers.forEach(t => { t.line.geometry.dispose(); t.line.material.dispose(); });

        this.scene.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
            }
        });

        this.controls.dispose && this.controls.dispose();
        this.renderer.dispose();
        this.renderer.domElement.remove();

        this.ui.pauseMenu.style.display = 'none';
        this.ui.resumeOverlay.style.display = 'none';
        this.ui.bossBar.style.display = 'none';
        this.ui.bossFlash.style.opacity = '0';
        this.ui.vignette.style.opacity = '0';
        this.ui.zoneVignette.style.opacity = '0';
        this.ui.dmgDir.style.opacity = '0';
        this.ui.combo.style.display = 'none';
        this.ui.freezeTag.style.display = 'none';
        this.ui.interactPrompt.style.display = 'none';
        this.ui.wepToast.style.display = 'none';
        this.ui.msgStack.innerHTML = '';
        this.ui.killFeed.innerHTML = '';
        this.ui.lootFeed.innerHTML = '';
        this.ui.zoneTimer.textContent = '';
    }
}
