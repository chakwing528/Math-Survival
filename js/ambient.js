// ==============================================================================
// 選單背景環境場景 (輕量程序化：草地 + 樹 + 天空 + 慢旋鏡頭)
// 唔需要載入 19MB GLTF 模型，即開即有，襯托選單/結算畫面
// ==============================================================================

import * as THREE from 'three';

let renderer, scene, camera, clock, raf = null;
let clouds = [];
let started = false, paused = false;

function makeGrassTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5a9e4a'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 160; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, r = 4 + Math.random() * 14;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(70,130,55,0.35)' : 'rgba(120,170,90,0.35)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
    return tex;
}

function makeBladeTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const cols = ['#3e6b2b', '#4a7c33', '#345e24'];
    for (let i = 0; i < 8; i++) {
        const bx = 8 + i * 6 + (Math.random() - 0.5) * 4;
        const h = 26 + Math.random() * 30, lean = (Math.random() - 0.5) * 12;
        ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(bx, 64);
        ctx.quadraticCurveTo(bx + lean * 0.4, 64 - h * 0.6, bx + lean, 64 - h);
        ctx.stroke();
    }
    return new THREE.CanvasTexture(c);
}

function makeCloudTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    const puff = (x, y, r) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(200,220,245,0.85)');
        g.addColorStop(0.7, 'rgba(160,185,220,0.4)');
        g.addColorStop(1, 'rgba(160,185,220,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    puff(80, 75, 45); puff(130, 60, 55); puff(180, 78, 42); puff(105, 88, 38);
    return new THREE.CanvasTexture(c);
}

function makeTree(x, z, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3 * s, 0.45 * s, 3 * s, 7),
        new THREE.MeshLambertMaterial({ color: 0x5a3d22 })
    );
    trunk.position.y = 1.5 * s;
    g.add(trunk);
    const cols = [0x3f7a33, 0x4c8a3d, 0x36692c];
    for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry((2.1 - i * 0.5) * s, 2.3 * s, 8),
            new THREE.MeshLambertMaterial({ color: cols[i % 3] })
        );
        cone.position.y = (3 + i * 1.4) * s;
        g.add(cone);
    }
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI;
    return g;
}

export function startAmbient(container) {
    if (started) { resumeAmbient(); return; }
    try {
        scene = new THREE.Scene();
        // 明亮日間天空 (睇得清背景)
        scene.background = new THREE.Color(0x7fb4e6);
        scene.fog = new THREE.Fog(0x9fc8ec, 40, 150);

        camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 400);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.domElement.id = 'ambient-canvas';
        renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
        container.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x9ab87a, 1.15));
        const sun = new THREE.DirectionalLight(0xfff2cc, 1.35);
        sun.position.set(20, 42, 12);
        scene.add(sun);

        // 地面
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(400, 400),
            new THREE.MeshLambertMaterial({ map: makeGrassTexture() })
        );
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // 密集草叢 (instancing)
        const bladeTex = makeBladeTexture();
        const grassGeo = new THREE.PlaneGeometry(0.9, 0.65);
        grassGeo.translate(0, 0.32, 0);
        const grassMat = new THREE.MeshLambertMaterial({ map: bladeTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
        const N = 350;
        const grass = new THREE.InstancedMesh(grassGeo, grassMat, N);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < N; i++) {
            dummy.position.set((Math.random() * 2 - 1) * 45, 0, (Math.random() * 2 - 1) * 45);
            dummy.rotation.y = Math.random() * Math.PI;
            const gs = 0.7 + Math.random() * 1;
            dummy.scale.set(gs, gs, gs);
            dummy.updateMatrix();
            grass.setMatrixAt(i, dummy.matrix);
        }
        grass.instanceMatrix.needsUpdate = true;
        scene.add(grass);

        // 一圈樹木
        for (let i = 0; i < 22; i++) {
            const a = (i / 22) * Math.PI * 2 + Math.random() * 0.2;
            const d = 20 + Math.random() * 28;
            scene.add(makeTree(Math.cos(a) * d, Math.sin(a) * d, 0.9 + Math.random() * 0.9));
        }

        // 飄雲
        const cloudTex = makeCloudTexture();
        clouds = [];
        for (let i = 0; i < 6; i++) {
            const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.7, depthWrite: false }));
            const cs = 16 + Math.random() * 20;
            cloud.scale.set(cs, cs * 0.5, 1);
            cloud.position.set((Math.random() * 2 - 1) * 110, 34 + Math.random() * 22, (Math.random() * 2 - 1) * 110);
            scene.add(cloud);
            clouds.push({ sprite: cloud, speed: 0.4 + Math.random() * 0.6 });
        }

        clock = new THREE.Clock();
        started = true; paused = false;
        window.addEventListener('resize', _onResize);
        _animate();
    } catch (e) {
        console.warn('環境背景載入失敗 (選單仍可正常使用)', e);
    }
}

function _onResize() {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function _animate() {
    if (paused) return;
    raf = requestAnimationFrame(_animate);
    const t = clock.getElapsedTime();
    // 慢慢環繞旋轉 + 輕微上下浮動
    const R = 34;
    camera.position.set(Math.cos(t * 0.045) * R, 7 + Math.sin(t * 0.15) * 1.2, Math.sin(t * 0.045) * R);
    camera.lookAt(0, 4.5, 0);
    for (const c of clouds) {
        c.sprite.position.x += c.speed * 0.03;
        if (c.sprite.position.x > 120) c.sprite.position.x = -120;
    }
    renderer.render(scene, camera);
}

export function pauseAmbient() {
    paused = true;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (renderer) renderer.domElement.style.display = 'none';
}

export function resumeAmbient() {
    if (!started) return;
    paused = false;
    if (renderer) renderer.domElement.style.display = 'block';
    if (!raf) _animate();
}
