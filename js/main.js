// ==============================================================================
// 主流程：載入 → 登入 → 選難度 → 遊戲 → 結算上傳 → 返回選單
// ==============================================================================

import { loadCloudConfig, DIFF_MULT } from './config.js?v=35';
import { initAudio, setBgmVolume, setSfxVolume } from './audio.js?v=35';
import { fetchLeaderboard, renderLeaderboard, submitScore } from './leaderboard.js?v=35';
import { TOPIC_NAMES } from './math.js?v=35';
import { initInputMode, initOrientationGuard, enterImmersive } from './device.js?v=35';

// 3D 引擎 (Three.js) 採用動態載入：就算 CDN 有問題，選單同排行榜都照常運作
let GameClass = null;
async function loadEngine() {
    if (!GameClass) {
        const mod = await import('./game.js?v=35');
        GameClass = mod.Game;
    }
    return GameClass;
}

const $ = id => document.getElementById(id);

let game = null;
let currentDifficulty = '1';
let lastResult = null; // { victory, kills, total, weaponName }
let scoreSubmitted = false;

// ------------------------------------------------------------------ 排行榜輪詢
async function refreshMenuLeaderboard() {
    try {
        const data = await fetchLeaderboard();
        renderLeaderboard(data, $('menu-lb-list'), null);
    } catch (e) {
        const list = $('menu-lb-list');
        if (list && list.textContent.includes("載入排行榜中")) {
            globalThis.MathSurvivalCloud.setListMessage(list, "載入失敗，可能權限被阻擋");
        }
    }
}

setInterval(() => {
    if (!game && $('start-menu').style.display !== 'none') refreshMenuLeaderboard();
}, 5000);

// ------------------------------------------------------------------ 選單切換
function showMenu() {
    $('start-menu').style.display = 'flex';
    $('gameover-overlay').style.display = 'none';
    $('hud').style.display = 'none';
    $('diff-selection').style.display = 'none';
    $('login-selection').style.display = 'flex';
    refreshMenuLeaderboard();
    ensureAmbient();
}

// 選單背景環境場景 (輕量，即開即有)
let ambientMod = null;
function ensureAmbient() {
    if (ambientMod) { ambientMod.resumeAmbient(); return; }
    import('./ambient.js?v=35')
        .then(m => { ambientMod = m; m.startAmbient($('game-container')); })
        .catch(() => {}); // 失敗都唔影響選單
}

$('btn-next').addEventListener('click', () => {
    const cls = $('login-class').value.trim();
    const sid = $('login-sid').value.trim();
    if (cls === "" || sid === "") {
        alert("請填寫班別及學號才能開始遊戲！");
        return;
    }
    initAudio();
    $('login-selection').style.display = 'none';
    $('diff-selection').style.display = 'flex';
});

$('btn-back-login').addEventListener('click', () => {
    $('diff-selection').style.display = 'none';
    $('login-selection').style.display = 'flex';
});

document.querySelectorAll('.diff-btn[data-level]').forEach(btn => {
    btn.addEventListener('click', () => startGame(btn.dataset.level));
});

// ------------------------------------------------------------------ 開始遊戲
async function startGame(level) {
    enterImmersive();     // 必須喺 user gesture 內同步呼叫 (全螢幕 + 鎖橫屏)
    initAudio();
    if (ambientMod) ambientMod.pauseAmbient();  // 暫停選單背景，讓位俾真正遊戲
    destroyGame();        // 銷毀上一局 (結算畫面背後仍保留住嘅遊戲)
    currentDifficulty = level;
    scoreSubmitted = false;
    lastResult = null;

    let Game;
    try {
        Game = await loadEngine();
        // 載入 3D 模型 (首次需時，顯示進度)
        const { loadAssets } = await import('./assets.js?v=35');
        const ls = $('loading-screen');
        const sub = $('loading-subtext');
        ls.style.display = 'flex';
        ls.firstElementChild.textContent = '載入 3D 模型中...';
        if (sub) sub.textContent = '(首次載入約 19MB，之後有快取會好快)';
        await loadAssets((done, total) => {
            ls.firstElementChild.textContent = `載入 3D 模型中... ${done}/${total}`;
        });
        ls.style.display = 'none';
    } catch (e) {
        console.error("3D 引擎/模型載入失敗:", e);
        $('loading-screen').style.display = 'none';
        alert("無法載入 3D 引擎或模型檔案。\n請檢查網絡連線後重新整理頁面。");
        return;
    }

    $('start-menu').style.display = 'none';
    $('gameover-overlay').style.display = 'none';
    $('hud').style.display = 'block';

    game = new Game({
        difficulty: level,
        container: $('game-container'),
        onGameOver: handleGameOver,
        onAbort: handleAbort
    });
    window.__game = game; // debug 用
    game.start();
}

function destroyGame() {
    if (game) { game.dispose(); game = null; }
    $('hud').style.display = 'none';
}

function handleAbort() {
    destroyGame();
    showMenu();
}

// ------------------------------------------------------------------ 遊戲結束
function handleGameOver(victory, kills, total, weaponName, mathStats) {
    // 唔銷毀遊戲：保留背後畫面 (半透明結算畫面透出調暗嘅遊戲場景)，只收起 HUD
    $('hud').style.display = 'none';
    lastResult = { victory, kills, total, weaponName };

    // 學習報告：答題正確率 + 各課題表現 + 最弱課題提示
    const report = $('go-report');
    if (mathStats && mathStats.total > 0) {
        const pct = Math.round(mathStats.correct / mathStats.total * 100);
        let rows = '';
        let weakest = null;
        for (const [topic, st] of Object.entries(mathStats.byTopic)) {
            const tp = Math.round(st.c / st.t * 100);
            const name = TOPIC_NAMES[topic] || topic;
            const bar = tp >= 80 ? '🟢' : (tp >= 50 ? '🟡' : '🔴');
            rows += `<div>${bar} ${name}：${st.c}/${st.t} 題 (${tp}%)</div>`;
            if (!weakest || tp < weakest.tp) weakest = { name, tp, t: st.t };
        }
        let tip = '';
        if (weakest && weakest.tp < 80 && weakest.t >= 2) {
            tip = `<div style="margin-top:8px; color:#fbbf24;">💡 建議溫習：<b>${weakest.name}</b></div>`;
        } else if (pct === 100) {
            tip = `<div style="margin-top:8px; color:#4ade80;">🌟 全部答對，數學高手！</div>`;
        }
        report.innerHTML = `
            <div style="color:#38bdf8; font-weight:800; font-size:23px; margin-bottom:10px; letter-spacing:1px;">📊 學習報告</div>
            <div>答題成績：<b style="color:${pct >= 70 ? '#4ade80' : '#fbbf24'}; font-size:1.15em;">${mathStats.correct} / ${mathStats.total}</b>　(正確率 ${pct}%)</div>
            ${rows}${tip}`;
        report.style.display = 'block';
    } else {
        report.style.display = 'none';
    }

    const mult = DIFF_MULT[currentDifficulty] || 1;
    const finalScore = Math.round(kills * mult);

    $('go-title').textContent = victory ? '🍗 大吉大利，今晚食雞！' : '你已陣亡';
    $('go-title').className = victory ? 'win' : 'dead';
    $('go-detail').innerHTML = victory
        ? `WINNER WINNER CHICKEN DINNER!<br>全部魔物殲滅！最終武器: ${weaponName}<br>擊殺 ${kills}　總得分: ${kills} × ${mult} = <span style="color:#f2a900; font-size: 1.3em;">${finalScore} 分</span>`
        : `擊殺數: ${kills} / ${total}　最終武器: ${weaponName}<br>總得分: ${kills} × ${mult} = <span style="color:#f2a900; font-size: 1.3em;">${finalScore} 分</span>`;

    $('btn-submit-score').style.display = 'block';
    $('btn-submit-score').disabled = false;
    $('btn-submit-score').textContent = '上傳成績並觀看排名';
    $('go-lb-box').style.display = 'none';
    $('gameover-overlay').style.display = 'flex';
}

$('btn-submit-score').addEventListener('click', async () => {
    if (scoreSubmitted || !lastResult) return;
    scoreSubmitted = true;

    const btn = $('btn-submit-score');
    btn.disabled = true;
    btn.textContent = '上傳中並配對資料...';

    const cls = $('login-class').value.trim();
    const sid = $('login-sid').value.trim();
    const mult = DIFF_MULT[currentDifficulty] || 1;
    const score = Math.round(lastResult.kills * mult);

    const data = await submitScore({ cls, sid, score, difficulty: currentDifficulty });

    btn.style.display = 'none';
    $('go-lb-box').style.display = 'block';
    renderLeaderboard(data, $('go-lb-list'), $('go-my-rank'));
});

$('btn-play-again').addEventListener('click', () => startGame(currentDifficulty));
$('btn-go-menu').addEventListener('click', () => { destroyGame(); showMenu(); });

// ------------------------------------------------------------------ 音量設定
$('bgm-slider').addEventListener('input', e => {
    setBgmVolume(parseFloat(e.target.value));
    try { localStorage.setItem('ms_bgm', e.target.value); } catch (err) {}
});
$('sfx-slider').addEventListener('input', e => {
    setSfxVolume(parseFloat(e.target.value));
    try { localStorage.setItem('ms_sfx', e.target.value); } catch (err) {}
});

// 開機時恢復上次嘅設定 (靈敏度 / 音量)
function restoreSettings() {
    try {
        const sens = localStorage.getItem('ms_sens');
        const bgm = localStorage.getItem('ms_bgm');
        const sfx = localStorage.getItem('ms_sfx');
        if (sens) $('sens-slider').value = sens;
        if (bgm) { $('bgm-slider').value = bgm; setBgmVolume(parseFloat(bgm)); }
        if (sfx) { $('sfx-slider').value = sfx; setSfxVolume(parseFloat(sfx)); }
    } catch (err) {}
}
restoreSettings();

// ------------------------------------------------------------------ 啟動
async function boot() {
    // 輸入模式偵測 (desktop / touch) + 直屏提示
    initInputMode();
    initOrientationGuard();

    try {
        await Promise.race([
            loadCloudConfig(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
        ]);
    } catch (e) {
        console.error("載入雲端數據失敗，使用本地預設值:", e);
        const sub = $('loading-subtext');
        if (sub) sub.textContent = '(雲端連線失敗，使用本地預設值啟動)';
        await new Promise(r => setTimeout(r, 1500));
    }

    if (window.__bootWatchdog) clearTimeout(window.__bootWatchdog);
    $('loading-screen').style.display = 'none';
    showMenu();

    // 背景預載 3D 引擎 + 模型，令首次入場更快
    loadEngine()
        .then(() => import('./assets.js?v=35'))
        .then(m => m.loadAssets())
        .catch(() => {});
}

boot();
