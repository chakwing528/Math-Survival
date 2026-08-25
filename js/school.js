// ==============================================================================
// 明愛聖若瑟中學 — 程序化五層口字形校舍
// 參考照片：白牆 + 深藍直柱 + 紅色橫欄 + 中央籃球場 + 開放走廊
// ==============================================================================

import * as THREE from 'three';

// ---- 尺寸 ----
export const FLOOR_H = 4.2;          // 每層高
export const FLOORS = 5;             // 五層
export const COURT_HX = 22;          // 操場半闊 (X)
export const COURT_HZ = 17;          // 操場半深 (Z)
export const WING = 9;               // 校舍翼進深
export const CORRIDOR = 2.6;         // 開放走廊闊度
export const BUILD_HX = COURT_HX + WING; // 建築外緣半闊
export const BUILD_HZ = COURT_HZ + WING;

// ---- 配色 (對住照片) ----
const C = {
    white: 0xf1efe8,
    wall: 0xe9e7df,
    navy: 0x243a6b,       // 深藍直柱
    navyDark: 0x1c2f57,
    red: 0xc8202e,        // 紅色橫欄
    pink: 0xff4d8f,       // 粉紅點綴
    slab: 0xd8d5cc,       // 樓板
    ceil: 0xcfccc2,
    railTop: 0xb8b3a6,
    courtGreen: 0x3f9d63, // 操場綠
    courtBlue: 0x3f7cae,  // 籃球場藍
    padBlue: 0x2f74c0,    // 藍色軟墊
    matGreen: 0x2f7d4a,   // 綠色護墊
    woodFloor: 0xcdc7ba,  // 走廊木地
    glass: 0x9fc7d9,
    frame: 0x8a8f96,
    door: 0x6b5a44
};

function box(w, h, d, color, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
}

// 籃球場地面貼圖 (藍底白線)
function makeCourtTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 768;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3f7cae'; ctx.fillRect(0, 0, 1024, 768);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 6;
    ctx.strokeRect(40, 40, 944, 688);
    // 中線
    ctx.beginPath(); ctx.moveTo(512, 40); ctx.lineTo(512, 728); ctx.stroke();
    // 中圈
    ctx.beginPath(); ctx.arc(512, 384, 90, 0, Math.PI * 2); ctx.stroke();
    // 兩端罰球區 + 籃圈
    [[40, 1], [984, -1]].forEach(([bx, dir]) => {
        ctx.strokeRect(bx, 274, dir * 190, 220);
        ctx.beginPath(); ctx.arc(bx + dir * 190, 384, 90, 0, Math.PI * 2); ctx.stroke();
    });
    return new THREE.CanvasTexture(c);
}

// 直向中文校名貼圖 (白塔用)
function makeNameTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 640;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 640);
    ctx.fillStyle = '#c8202e';
    ctx.beginPath(); ctx.arc(64, 60, 22, 0, Math.PI * 2); ctx.fill(); // 明愛紅十字圈 (簡化)
    ctx.fillStyle = '#333'; ctx.font = 'bold 62px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const name = '明愛聖若瑟中學';
    for (let i = 0; i < name.length; i++) ctx.fillText(name[i], 64, 130 + i * 68);
    return new THREE.CanvasTexture(c);
}

// 橫額貼圖 (掛喺欄河)
function makeBannerTexture(hue) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = `hsl(${hue}, 65%, 55%)`; ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(10, 24, 236, 16);
    ctx.fillStyle = `hsl(${hue}, 70%, 45%)`;
    for (let i = 0; i < 6; i++) ctx.fillRect(20 + i * 40, 12, 24, 8);
    return new THREE.CanvasTexture(c);
}

// 一條校舍翼 (沿 X 軸伸展的一段建築)，回傳含樓板/牆/柱/欄河/課室
// side: 'back'|'left'|'right'，決定朝向 (走廊面向操場)
function buildWing(group, colliders, side, courtTex) {
    const wing = new THREE.Group();

    // 依方位設定：翼中心、長度、朝向 (走廊法線指向操場中心)
    let cx, cz, len, horizontal, faceZ, faceX;
    if (side === 'back') { cx = 0; cz = -(COURT_HZ + WING / 2); len = (COURT_HX + WING) * 2; horizontal = true; faceZ = 1; faceX = 0; }
    else if (side === 'left') { cx = -(COURT_HX + WING / 2); cz = 0; len = COURT_HZ * 2; horizontal = false; faceZ = 0; faceX = 1; }
    else { cx = (COURT_HX + WING / 2); cz = 0; len = COURT_HZ * 2; horizontal = false; faceZ = 0; faceX = -1; }

    const half = len / 2;
    // 沿翼長度方向嘅座標軸 (u)、進深方向 (v = 指向操場)
    const place = (u, vOffset, y, meshFn) => {
        // vOffset: 由翼中心向操場方向嘅偏移
        let x, z;
        if (horizontal) { x = cx + u; z = cz + faceZ * vOffset; }
        else { x = cx + faceX * vOffset; z = cz + u; }
        meshFn(x, y, z);
    };
    const wingW = horizontal ? len : WING;      // 建築塊喺 X 方向尺寸
    const wingD = horizontal ? WING : len;

    for (let f = 0; f < FLOORS; f++) {
        const y0 = f * FLOOR_H;
        // 樓板
        const slab = box(wingW, 0.3, wingD, C.slab, cx, y0 + 0.15, cz, wing);
        // 天花 (上層樓板底)
        box(wingW, 0.15, wingD, C.ceil, cx, y0 + FLOOR_H - 0.1, cz, wing);

        // 外牆 (背向操場嗰邊)：白牆
        const outerV = -WING / 2 + 0.2;
        if (horizontal) box(wingW, FLOOR_H, 0.4, C.wall, cx, y0 + FLOOR_H / 2, cz + faceZ * outerV, wing);
        else box(0.4, FLOOR_H, wingD, C.wall, cx + faceX * outerV, y0 + FLOOR_H / 2, cz, wing);

        // 課室隔牆 + 窗 (沿外牆排列)
        const bays = horizontal ? Math.floor(len / 6) : Math.floor(len / 6);
        for (let b = 0; b <= bays; b++) {
            const u = -half + (b / bays) * len;
            // 深藍直柱 (由地到頂樓，只喺 f==0 畫一次全高)
            if (f === 0) {
                place(u, outerV + 0.15, FLOORS * FLOOR_H / 2, (x, y, z) => {
                    box(0.7, FLOORS * FLOOR_H, 0.7, C.navy, x, y, z, wing);
                });
            }
            // 窗 (紅框 / 粉紅框交替)
            if (b < bays) {
                const wu = u + (len / bays) / 2;
                const frameColor = (f + b) % 3 === 0 ? C.pink : C.red;
                place(wu, outerV + 0.25, y0 + FLOOR_H * 0.55, (x, y, z) => {
                    const fw = horizontal ? 2.6 : 0.25, fd = horizontal ? 0.25 : 2.6;
                    box(fw, 1.9, fd, frameColor, x, y, z, wing);        // 紅框
                    const gw = horizontal ? 2.2 : 0.15, gd = horizontal ? 0.15 : 2.2;
                    box(gw, 1.5, gd, C.glass, x, y, z + (horizontal ? 0.02 : 0), wing); // 玻璃
                });
            }
        }

        // 開放走廊嘅紅色橫欄 (面向操場嗰邊)
        const railV = WING / 2 - 0.2;
        const railColor = f === 0 ? C.red : (f % 2 ? C.red : C.pink);
        if (horizontal) {
            box(wingW, 1.1, 0.3, railColor, cx, y0 + 0.9, cz + faceZ * railV, wing);
            box(wingW, 0.18, 0.4, C.railTop, cx, y0 + 1.5, cz + faceZ * railV, wing);
        } else {
            box(0.3, 1.1, wingD, railColor, cx + faceX * railV, y0 + 0.9, cz, wing);
            box(0.4, 0.18, wingD, C.railTop, cx + faceX * railV, y0 + 1.5, cz, wing);
        }

        // 走廊木地板
        if (horizontal) box(wingW, 0.06, CORRIDOR, C.woodFloor, cx, y0 + 0.33, cz + faceZ * (WING / 2 - CORRIDOR / 2 - 0.3), wing);
        else box(CORRIDOR, 0.06, wingD, C.woodFloor, cx + faceX * (WING / 2 - CORRIDOR / 2 - 0.3), y0 + 0.33, cz, wing);

        // 掛橫額 (每層兩幅)
        for (let bnr = 0; bnr < 2; bnr++) {
            const u = (-0.4 + bnr * 0.8) * half;
            const tex = makeBannerTexture((f * 60 + bnr * 130) % 360);
            const bmat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
            const bw = 4.5;
            const banner = new THREE.Mesh(new THREE.PlaneGeometry(bw, 1.1), bmat);
            place(u, railV - 0.05, y0 + 0.85, (x, y, z) => {
                banner.position.set(x, y, z);
                if (!horizontal) banner.rotation.y = Math.PI / 2;
                wing.add(banner);
            });
        }
    }

    // 花盆 (每層走廊擺幾盆)
    for (let f = 0; f < FLOORS; f++) {
        const y0 = f * FLOOR_H;
        const n = horizontal ? 6 : 4;
        for (let i = 0; i < n; i++) {
            const u = -half + (i + 0.5) / n * len;
            place(u, WING / 2 - 0.6, y0 + 0.5, (x, y, z) => {
                box(1.1, 0.4, 0.4, 0x2f6b3d, x, y, z, wing); // 花槽
                for (let k = 0; k < 3; k++) {
                    const hue = (i * 60 + k * 90) % 360;
                    const flower = new THREE.Mesh(
                        new THREE.SphereGeometry(0.16, 6, 5),
                        new THREE.MeshLambertMaterial({ color: new THREE.Color(`hsl(${hue},70%,60%)`) })
                    );
                    flower.position.set(x - 0.35 + k * 0.35, y + 0.35, z);
                    wing.add(flower);
                }
            });
        }
    }

    // (出界碰撞牆統一喺 buildSchool 加，呢度唔重複)
    group.add(wing);
    return wing;
}

// 中央操場 + 設施
function buildCourtyard(group, colliders) {
    const court = new THREE.Group();

    // 綠色底 (整個建築footprint)
    const green = new THREE.Mesh(
        new THREE.PlaneGeometry(BUILD_HX * 2 + 4, BUILD_HZ * 2 + 4),
        new THREE.MeshLambertMaterial({ color: C.courtGreen })
    );
    green.rotation.x = -Math.PI / 2;
    green.position.y = 0.02;
    court.add(green);

    // 藍色籃球場 (中央)
    const courtTex = makeCourtTexture();
    const bcourt = new THREE.Mesh(
        new THREE.PlaneGeometry(COURT_HX * 1.7, COURT_HZ * 1.7),
        new THREE.MeshLambertMaterial({ map: courtTex })
    );
    bcourt.rotation.x = -Math.PI / 2;
    bcourt.position.y = 0.04;
    court.add(bcourt);

    // 旗桿 + 旗
    const pole = box(0.2, 12, 0.2, 0xdddddd, 0, 6, -COURT_HZ + 3, court);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshLambertMaterial({ color: C.red, side: THREE.DoubleSide }));
    flag.position.set(1.3, 10.5, -COURT_HZ + 3);
    court.add(flag);

    // 兩個籃球架
    [-1, 1].forEach(dir => {
        const bx = 0, bz = dir * (COURT_HZ - 3);
        box(0.25, 4, 0.25, 0x999999, bx, 2, bz, court);
        const board = box(2.2, 1.4, 0.15, 0xffffff, bx, 4.3, bz - dir * 0.3, court);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 6, 12), new THREE.MeshLambertMaterial({ color: 0xe8770e }));
        rim.rotation.x = Math.PI / 2;
        rim.position.set(bx, 3.9, bz - dir * 0.7);
        court.add(rim);
    });

    group.add(court);
    return { courtGroup: court, courtTex };
}

// 主入口：起成間學校，回傳所有需要嘅 handle
export function buildSchool(scene) {
    const group = new THREE.Group();
    const colliders = [];

    const { courtGroup, courtTex } = buildCourtyard(group, colliders);

    buildWing(group, colliders, 'back', courtTex);
    buildWing(group, colliders, 'left', courtTex);
    buildWing(group, colliders, 'right', courtTex);

    // 前面 (操場開口方向 +Z)：矮牆 + 主閘 + 白色校名塔
    // 白塔 (前左角，高過五層)
    const towerH = FLOORS * FLOOR_H + 6;
    box(6, towerH, 6, C.white, -(COURT_HX + WING / 2), towerH / 2, COURT_HZ + WING / 2, group);
    const nameTex = makeNameTexture();
    const namePanel = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, towerH * 0.75),
        new THREE.MeshLambertMaterial({ map: nameTex, transparent: true })
    );
    namePanel.position.set(-(COURT_HX + WING / 2), towerH * 0.55, COURT_HZ + WING + 0.05);
    group.add(namePanel);

    // 前排矮教學樓 (右邊，五層) 令口字更完整
    box(WING, FLOORS * FLOOR_H, WING, C.wall, (COURT_HX + WING / 2), FLOORS * FLOOR_H / 2, COURT_HZ + WING / 2, group);

    // 藍色軟墊柱 (操場四角地面，安全護墊)
    const padSpots = [
        [-COURT_HX + 1, -COURT_HZ + 1], [COURT_HX - 1, -COURT_HZ + 1],
        [-COURT_HX + 1, COURT_HZ - 1], [COURT_HX - 1, COURT_HZ - 1],
        [0, -COURT_HZ + 1], [0, COURT_HZ - 1]
    ];
    padSpots.forEach(([x, z]) => {
        box(1.4, 2.4, 1.4, C.padBlue, x, 1.2, z, group);
        colliders.push({ x, z, r: 1.0 });
    });

    // (玩家/喪屍留喺操場內：由 game.js 用操場矩形邊界夾住，唔使 box collider)
    scene.add(group);

    // 喪屍生成點：操場邊緣 (模擬由校舍門口湧出)
    const spawnPoints = [];
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        spawnPoints.push({ x: Math.cos(a) * (COURT_HX - 2), z: Math.sin(a) * (COURT_HZ - 2) });
    }

    return {
        group,
        colliders,
        courtGroup,
        spawnPoints,
        bounds: { hx: COURT_HX - 1.5, hz: COURT_HZ - 1.5 }
    };
}
