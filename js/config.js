// ==============================================================================
// 遊戲設定：武器 / 魔物 / 難度 / Google Apps Script 雲端設定
// ==============================================================================

export const GAS_URL = "https://script.google.com/macros/s/AKfycbyhAYaMKRTbD_VyHDe-MZZ5OBZVdsvY2l9qcKWq8TuliBKptbhLpQsHbc4wdyKmX24Cvg/exec";

export const WEAPONS = [
    { level: 1, name: "Lv.1 基礎手槍",     damage: 1,    bullets: 1, fireRate: 15, playerSpeed: 4,  reloadAmmo: 30,  magCapacity: 30, ammoBoxRefill: 30, color: '#fde047', glow: '#ca8a04', recoil: 4 },
    { level: 2, name: "Lv.2 雙發衝鋒",     damage: 1.5,  bullets: 2, fireRate: 12, playerSpeed: 5,  reloadAmmo: 30,  magCapacity: 30, ammoBoxRefill: 30, color: '#60a5fa', glow: '#2563eb', recoil: 5 },
    { level: 3, name: "Lv.3 散彈速射",     damage: 2.25, bullets: 3, fireRate: 10, playerSpeed: 6,  reloadAmmo: 40,  magCapacity: 30, ammoBoxRefill: 30, color: '#34d399', glow: '#059669', recoil: 6 },
    { level: 4, name: "Lv.4 脈衝步槍",     damage: 3.4,  bullets: 4, fireRate: 8,  playerSpeed: 7,  reloadAmmo: 40,  magCapacity: 30, ammoBoxRefill: 30, color: '#f472b6', glow: '#db2777', recoil: 7 },
    { level: 5, name: "Lv.5 穿甲重砲",     damage: 5.1,  bullets: 1, fireRate: 6,  playerSpeed: 8,  reloadAmmo: 50,  magCapacity: 30, ammoBoxRefill: 30, color: '#a78bfa', glow: '#7c3aed', recoil: 8,  penetrate: true },
    { level: 6, name: "Lv.6 散射激光",     damage: 7.6,  bullets: 5, fireRate: 4,  playerSpeed: 9,  reloadAmmo: 50,  magCapacity: 30, ammoBoxRefill: 30, color: '#fb923c', glow: '#ea580c', recoil: 10 },
    { level: 7, name: "Lv.7 電漿風暴",     damage: 11.4, bullets: 3, fireRate: 3,  playerSpeed: 10, reloadAmmo: 60,  magCapacity: 30, ammoBoxRefill: 30, color: '#38bdf8', glow: '#0284c7', recoil: 12, penetrate: true },
    { level: 8, name: "Lv.8 終極殲滅射線", damage: 17.1, bullets: 7, fireRate: 2,  playerSpeed: 10, reloadAmmo: 60,  magCapacity: 30, ammoBoxRefill: 30, color: '#ffffff', glow: '#fef08a', recoil: 14, penetrate: true },
    { level: 9, name: "Lv.MAX 神話武器",   damage: 25.6, bullets: 9, fireRate: 1,  playerSpeed: 10, reloadAmmo: 100, magCapacity: 30, ammoBoxRefill: 30, color: '#ef4444', glow: '#b91c1c', recoil: 16, penetrate: true }
];

export const MONSTER_BASE = [
    { tier: 1, name: "一級喪屍", count: 5, hp: 8,    speed: 0.5, size: 22, color: '#ef4444' },
    { tier: 2, name: "二級喪屍", count: 5, hp: 25,   speed: 0.8, size: 28, color: '#f97316' },
    { tier: 3, name: "三級喪屍", count: 5, hp: 200,  speed: 1.0, size: 35, color: '#eab308' },
    { tier: 4, name: "四級喪屍", count: 3, hp: 500,  speed: 1.2, size: 45, color: '#84cc16' },
    { tier: 5, name: "喪屍王",   count: 1, hp: 1500, speed: 1.5, size: 70, color: '#a855f7' }
];

export const DIFF_MULT = { '1': 1, '2': 1.2, '3': 1.4, '4': 1.6, '5': 1.8 };
export const DIFF_LABELS = {
    '1': '10-50 整數加減運算',
    '2': '整數四則混合運算 (先乘除後加減)',
    '3': '加減混合 及 基礎指數',
    '4': '捨入、展開、因式分解、指數 (基礎隨機)',
    '5': '捨入、展開、因式分解、指數 (進階隨機)'
};

// 可被 Google Sheet 覆寫的全域參數 (時間單位: 秒)
export const SETTINGS = {
    lootBoxInterval: 8,
    ammoBoxInterval: 3,
    basePlayerSpeed: 4
};

// 從 Google Sheet 讀取武器 / 魔物 / 箱子時間設定 (沿用原有 GAS API)
export async function loadCloudConfig() {
    if (!GAS_URL) return;
    let res = await fetch(`${GAS_URL}?action=getGameData&t=${new Date().getTime()}_${Math.random()}`);
    let data = await res.json();

    let weaponsData = data.weapons || data.Weapons || data['設定武器'];
    if (weaponsData && weaponsData.length > 1) {
        let rows = weaponsData;
        let wepIdx = 0;

        for (let i = 1; i < rows.length; i++) {
            let levelCol = String(rows[i][0]).trim();
            let nameCol = String(rows[i][1]).trim();
            if (!levelCol && !nameCol) continue;

            // 從整行掃描全域箱子時間設定 (試算表填的是秒數)
            if (rows[i].length > 9 && rows[i][9] !== "") {
                let val = parseFloat(rows[i][9]);
                if (!isNaN(val) && val > 0) SETTINGS.lootBoxInterval = val;
            }
            if (rows[i].length > 10 && rows[i][10] !== "") {
                let val = parseFloat(rows[i][10]);
                if (!isNaN(val) && val > 0) SETTINGS.ammoBoxInterval = val;
            }

            let isBaseLevel = levelCol === "0" || levelCol.includes("0") || nameCol.includes("空手") || nameCol.includes("沒有槍") || nameCol.includes("未裝備");

            if (isBaseLevel) {
                if (rows[i].length > 5 && rows[i][5] !== "") {
                    let spd = parseFloat(rows[i][5]);
                    if (!isNaN(spd)) SETTINGS.basePlayerSpeed = spd;
                }
            } else if (wepIdx < WEAPONS.length && rows[i].length >= 6) {
                WEAPONS[wepIdx].name = nameCol || WEAPONS[wepIdx].name;
                if (rows[i][2] !== "") { let v = parseFloat(rows[i][2]); if (!isNaN(v)) WEAPONS[wepIdx].damage = v; }
                if (rows[i][3] !== "") { let v = parseInt(rows[i][3]); if (!isNaN(v)) WEAPONS[wepIdx].bullets = v; }
                if (rows[i][4] !== "") { let v = parseInt(rows[i][4]); if (!isNaN(v)) WEAPONS[wepIdx].fireRate = v; }
                if (rows[i][5] !== "") { let v = parseFloat(rows[i][5]); if (!isNaN(v)) WEAPONS[wepIdx].playerSpeed = v; }
                if (rows[i].length > 6 && rows[i][6] !== "") { let v = parseInt(rows[i][6]); if (!isNaN(v)) WEAPONS[wepIdx].reloadAmmo = v; }
                if (rows[i].length > 7 && rows[i][7] !== "") { let v = parseInt(rows[i][7]); if (!isNaN(v)) WEAPONS[wepIdx].magCapacity = v; }
                if (rows[i].length > 8 && rows[i][8] !== "") { let v = parseInt(rows[i][8]); if (!isNaN(v)) WEAPONS[wepIdx].ammoBoxRefill = v; }
                wepIdx++;
            }
        }
    }

    let monstersData = data.monsters || data.Monsters || data['設定魔物'];
    if (monstersData && monstersData.length > 1) {
        let rows = monstersData;
        for (let i = 1; i < rows.length; i++) {
            let mIdx = i - 1;
            if (rows[i].length >= 5 && mIdx >= 0 && mIdx < MONSTER_BASE.length) {
                if (rows[i][1] !== "") MONSTER_BASE[mIdx].name = String(rows[i][1]).trim() || MONSTER_BASE[mIdx].name;
                if (rows[i][2] !== "") { let v = parseInt(rows[i][2]); if (!isNaN(v)) MONSTER_BASE[mIdx].count = v; }
                if (rows[i][3] !== "") { let v = parseFloat(rows[i][3]); if (!isNaN(v)) MONSTER_BASE[mIdx].hp = v; }
                if (rows[i][4] !== "") { let v = parseFloat(rows[i][4]); if (!isNaN(v)) MONSTER_BASE[mIdx].speed = v; }
            }
        }
    }
}
