// --- 題庫必需的輔助函數 (確保 indices.js 能獨立運作) ---
function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min)) + min; }
function getRandomExp() { let e = getRandomInt(-5, 6); return e === 0 ? 2 : e; }
function buildEq(steps) { return steps.map(s => s.text).join(" = "); }
function wrapHint(msg, eq) { return `${msg}<br>\\( \\displaystyle ${eq} \\)`; }
const msgCorrect = "<span style='color:green'>正確！</span>";
function shuffleArray(array) { 
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [arr[i], arr[j]] = [arr[j], arr[i]]; 
    } 
    return arr; 
}

// ==========================================
// 🌐 API 後台設定區 
// ==========================================
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyhAYaMKRTbD_VyHDe-MZZ5OBZVdsvY2l9qcKWq8TuliBKptbhLpQsHbc4wdyKmX24Cvg/exec"; 
const GAS_LEADERBOARD_URL = GAS_WEB_APP_URL; 

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let audioInitialized = false;
function initAudio() {
    if (!audioInitialized) {
        let bgm = document.getElementById('bgm');
        if(bgm) { bgm.volume = 0.4; bgm.play().catch(e=>{}); }
        audioInitialized = true;
    }
}

const UI_BOUND = 200; 

// --- 控制系統變數 ---
let leftJoyBase = { x: UI_BOUND + 60, y: 120 }; 
let leftJoy = { active: false, id: null, stick: {x:0, y:0}, dir: {x:0, y:0} };
let rightJoy = { active: false, id: null, base: {x:0,y:0}, stick: {x:0,y:0}, dir: {x:0,y:0}, angle: 0 };
const joyRadius = 50;

const keys = { w: false, a: false, s: false, d: false };
let mouseX = canvas.width / 2; let mouseY = canvas.height / 2;
let isShooting = false;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    leftJoyBase = { x: UI_BOUND + 60, y: canvas.height - 100 };
    leftJoy.stick = { x: leftJoyBase.x, y: leftJoyBase.y };
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let gameState = 'START_MENU'; 
let globalTime = 0; let shakeTime = 0; let bossAlarmTimer = 0;

// --- 題庫與難度系統 ---
let currentDifficulty = 'S1';
let questionBank = [];
let currentMathType = ''; 
let mathTimer = 0;

let enemiesKilled = 0; let totalMonstersSpawned = 0; let TOTAL_MONSTERS = 19; 
let monstersLeft = [0, 0, 0, 0, 0, 0]; 
let currentWave = 1;

let lootBoxSpawnInterval = 480; let ammoBoxSpawnInterval = 180; 

let MONSTER_BASE = [
    {tier: 1, name: "一級怪物", count: 5, hp: 8, speed: 0.5, size: 22, color: '#ef4444'},
    {tier: 2, name: "二級怪物", count: 5, hp: 25, speed: 0.8, size: 28, color: '#f97316'},
    {tier: 3, name: "三級怪物", count: 5, hp: 200, speed: 1.0, size: 35, color: '#eab308'},
    {tier: 4, name: "四級怪物", count: 3, hp: 500, speed: 1.2, size: 45, color: '#84cc16'},
    {tier: 5, name: "五級首領", count: 1, hp: 1500, speed: 1.5, size: 70, color: '#a855f7'}
];

const WEAPONS = [
    { level: 1, name: "Lv.1 基礎手槍", damage: 1, bullets: 1, fireRate: 15, playerSpeed: 4, reloadAmmo: 30, magCapacity: 30, ammoBoxRefill: 30, color: '#fde047', glow: '#ca8a04', recoil: 4, speed: 12 },
    { level: 2, name: "Lv.2 雙發衝鋒", damage: 1.5, bullets: 2, fireRate: 12, playerSpeed: 5, reloadAmmo: 30, magCapacity: 30, ammoBoxRefill: 30, color: '#60a5fa', glow: '#2563eb', recoil: 5, speed: 14 },
    { level: 3, name: "Lv.3 散彈速射", damage: 2.25, bullets: 3, fireRate: 10, playerSpeed: 6, reloadAmmo: 40, magCapacity: 30, ammoBoxRefill: 30, color: '#34d399', glow: '#059669', recoil: 6, speed: 16 },
    { level: 4, name: "Lv.4 脈衝步槍", damage: 3.4, bullets: 4, fireRate: 8, playerSpeed: 7, reloadAmmo: 40, magCapacity: 30, ammoBoxRefill: 30, color: '#f472b6', glow: '#db2777', recoil: 7, speed: 18 },
    { level: 5, name: "Lv.5 穿甲重砲", damage: 5.1, bullets: 1, fireRate: 6, playerSpeed: 8, reloadAmmo: 50, magCapacity: 30, ammoBoxRefill: 30, color: '#a78bfa', glow: '#7c3aed', recoil: 8, speed: 20, penetrate: true },
    { level: 6, name: "Lv.6 散射激光", damage: 7.6, bullets: 5, fireRate: 4, playerSpeed: 9, reloadAmmo: 50, magCapacity: 30, ammoBoxRefill: 30, color: '#fb923c', glow: '#ea580c', recoil: 10, speed: 22 },
    { level: 7, name: "Lv.7 電漿風暴", damage: 11.4, bullets: 3, fireRate: 3, playerSpeed: 10, reloadAmmo: 60, magCapacity: 30, ammoBoxRefill: 30, color: '#38bdf8', glow: '#0284c7', recoil: 12, speed: 25, penetrate: true },
    { level: 8, name: "Lv.8 終極殲滅射線", damage: 17.1, bullets: 7, fireRate: 2, playerSpeed: 10, reloadAmmo: 60, magCapacity: 30, ammoBoxRefill: 30, color: '#ffffff', glow: '#fef08a', recoil: 14, speed: 28, penetrate: true },
    { level: 9, name: "Lv.MAX 神話武器", damage: 25.6, bullets: 9, fireRate: 1, playerSpeed: 10, reloadAmmo: 100, magCapacity: 30, ammoBoxRefill: 30, color: '#ef4444', glow: '#b91c1c', recoil: 16, speed: 30, penetrate: true }
];

let player = {
    x: UI_BOUND + 100, y: 0, radius: 20, color: '#3b82f6', speed: 4, hp: 100, maxHp: 100,
    weaponLevel: -1, currentMagazine: 0, totalAmmo: 0,       
    isReloading: false, reloadTimer: 0, angle: 0, recoilOffset: 0, lastFireTime: 0, isMoving: false
};

let bullets = []; let enemies = []; let lootBoxes = []; let ammoBoxes = []; let particles = []; let floatingTexts = [];
let scoreSubmitted = false;

// --- 🚀 DOM 快取優化 (解決大量卡頓的核心) ---
const uiElements = {};
let uiReady = false;

function cacheUIElements() {
    uiElements.hpFill = document.getElementById('ui-hp-fill');
    uiElements.hpText = document.getElementById('ui-hp-text');
    uiElements.wepName = document.getElementById('ui-wep-name');
    uiElements.ammoText = document.getElementById('ui-ammo-text');
    uiElements.mathTimerBar = document.getElementById('math-timer-bar');
    uiElements.mCounts = [];
    for(let i=1; i<=5; i++) {
        uiElements.mCounts[i] = document.getElementById(`m-count-${i}`);
    }
    uiReady = true;
}

let lastHUDState = { hp: -1, weapon: -2, ammo: -1, total: -1, reloading: null, mCounts: [-1,-1,-1,-1,-1,-1] };

function updateHTMLHUD() {
    if (!uiReady) cacheUIElements();
    if (!uiElements.hpFill) return; // 確保元素已載入

    // 只有在數值發生變化時才去觸碰 DOM，節省 90% 性能
    if (lastHUDState.hp !== player.hp) {
        uiElements.hpFill.style.width = (Math.max(0, player.hp) / player.maxHp * 100) + '%';
        uiElements.hpText.textContent = `HP: ${Math.max(0, player.hp)}`;
        lastHUDState.hp = player.hp;
    }
    
    let ammoChanged = lastHUDState.ammo !== player.currentMagazine || lastHUDState.total !== player.totalAmmo || lastHUDState.reloading !== player.isReloading;
    let wepChanged = lastHUDState.weapon !== player.weaponLevel;

    if (wepChanged || ammoChanged) {
        if (player.weaponLevel >= 0) {
            if (wepChanged) {
                let currWep = WEAPONS[player.weaponLevel];
                if (currWep) uiElements.wepName.textContent = `武裝: ${currWep.name}`;
            }
            if (ammoChanged) {
                if (player.isReloading) uiElements.ammoText.textContent = `換彈中...`;
                else uiElements.ammoText.textContent = `彈藥: ${player.currentMagazine}/${player.totalAmmo}`;
            }
        } else {
            if (wepChanged) uiElements.wepName.textContent = `武裝: 尚未裝備`;
            if (ammoChanged) uiElements.ammoText.textContent = `彈藥: 0/0`;
        }
        lastHUDState.weapon = player.weaponLevel;
        lastHUDState.ammo = player.currentMagazine;
        lastHUDState.total = player.totalAmmo;
        lastHUDState.reloading = player.isReloading;
    }

    for(let i=1; i<=5; i++) {
        if (uiElements.mCounts[i] && lastHUDState.mCounts[i] !== monstersLeft[i]) {
            uiElements.mCounts[i].textContent = `x ${Math.max(0, monstersLeft[i])}`;
            lastHUDState.mCounts[i] = monstersLeft[i];
        }
    }
}

// --- 繪製側邊欄靜態圖示 ---
function drawHUDIcons() {
    let pC = document.getElementById('player-icon'); 
    if(!pC) return;
    let pCtx = pC.getContext('2d');
    pCtx.translate(22.5, 26); pCtx.scale(0.75, 0.75); 
    pCtx.fillStyle = '#dc2626'; pCtx.beginPath(); pCtx.moveTo(-9, -7); pCtx.lineTo(-15, 15); pCtx.lineTo(15, 15); pCtx.lineTo(9, -7); pCtx.fill();
    pCtx.fillStyle = '#1d4ed8'; pCtx.fillRect(-9, -11, 18, 22); 
    pCtx.fillStyle = '#94a3b8'; pCtx.fillRect(-10, -11, 20, 12); 
    pCtx.fillStyle = '#fcd34d'; pCtx.beginPath(); pCtx.arc(0, -18, 12, 0, Math.PI*2); pCtx.fill();
    pCtx.fillStyle = '#cbd5e1'; pCtx.beginPath(); pCtx.arc(0, -21, 13, Math.PI, 0); pCtx.fill(); pCtx.fillRect(-13, -21, 26, 4); 
    pCtx.fillStyle = '#b91c1c'; pCtx.fillRect(-2, -36, 4, 9);
    pCtx.fillStyle = '#1e293b'; pCtx.beginPath(); pCtx.arc(-4, -17, 2, 0, Math.PI*2); pCtx.fill(); pCtx.beginPath(); pCtx.arc(4, -17, 2, 0, Math.PI*2); pCtx.fill();

    let mTypes = [{ tier: 1, color: '#ef4444' }, { tier: 2, color: '#f97316' }, { tier: 3, color: '#eab308' }, { tier: 4, color: '#84cc16' }, { tier: 5, color: '#a855f7' }];
    for (let i=0; i<5; i++) {
        let mC = document.getElementById(`m-icon-${i+1}`); 
        if(!mC) continue;
        let mCtx = mC.getContext('2d');
        mCtx.translate(12, 14); mCtx.scale(0.8, 0.8); 
        let eSize = 14; 
        mCtx.fillStyle = mTypes[i].color; mCtx.beginPath(); mCtx.arc(0, -eSize*0.4, eSize*0.45, Math.PI, 0); mCtx.lineTo(eSize*0.45, eSize*0.1); mCtx.lineTo(-eSize*0.45, eSize*0.1); mCtx.fill();
        if (mTypes[i].tier === 5) {
            mCtx.fillStyle = '#334155'; mCtx.beginPath(); mCtx.moveTo(-eSize*0.2, -eSize*0.4); mCtx.lineTo(-eSize*0.5, -eSize*0.7); mCtx.lineTo(-eSize*0.3, -eSize*0.3); mCtx.fill(); mCtx.beginPath(); mCtx.moveTo(eSize*0.2, -eSize*0.4); mCtx.lineTo(eSize*0.5, -eSize*0.7); mCtx.lineTo(eSize*0.3, -eSize*0.3); mCtx.fill();
            mCtx.fillStyle = '#fbbf24'; mCtx.beginPath(); mCtx.moveTo(-8, -eSize*0.4); mCtx.lineTo(-10, -eSize*0.6); mCtx.lineTo(0, -eSize*0.5); mCtx.lineTo(10, -eSize*0.6); mCtx.lineTo(8, -eSize*0.4); mCtx.fill();
        } else { mCtx.fillStyle = '#fca5a5'; mCtx.beginPath(); mCtx.arc(0, -2, eSize*0.2, 0, Math.PI * 2); mCtx.fill(); }
        mCtx.fillStyle = mTypes[i].tier >= 3 ? '#ef4444' : 'white'; mCtx.beginPath(); mCtx.arc(-2.5, -eSize*0.3, 1.5, 0, Math.PI*2); mCtx.fill(); mCtx.beginPath(); mCtx.arc(2.5, -eSize*0.3, 1.5, 0, Math.PI*2); mCtx.fill();
        mCtx.fillStyle = 'black'; mCtx.beginPath(); mCtx.arc(-2.5, -eSize*0.3, 1, 0, Math.PI*2); mCtx.fill(); mCtx.beginPath(); mCtx.arc(2.5, -eSize*0.3, 1, 0, Math.PI*2); mCtx.fill();
    }
}
setTimeout(drawHUDIcons, 100);

function initMonsterQueue() {
    monsterQueue = []; TOTAL_MONSTERS = 0; monstersLeft = [0, 0, 0, 0, 0, 0];
    for (let m of MONSTER_BASE) {
        for(let i=0; i<m.count; i++) monsterQueue.push({...m});
        TOTAL_MONSTERS += m.count; monstersLeft[m.tier] += m.count; 
    }
}

// --- 排行榜邏輯 (緩存消除機制) ---
function fetchLeaderboard() {
    if (!GAS_LEADERBOARD_URL) return;
    const timestamp = new Date().getTime();
    fetch(`${GAS_LEADERBOARD_URL}?action=getLeaderboard&t=${timestamp}`)
        .then(res => res.json())
        .then(data => renderLeaderboard(data))
        .catch(e => console.log("LB 獲取失敗", e));
}

function renderLeaderboard(data) {
    const list = document.getElementById('leaderboard-list');
    if(!list) return;
    list.innerHTML = "";
    if (!data || data.length === 0) { list.innerHTML = "<li>暫無數據</li>"; return; }
    
    data.forEach(item => {
        let li = document.createElement('li');
        li.textContent = `${item.cls} ${item.name} - ${item.score}分 (${item.diff})`;
        if (item.isMe) { li.style.backgroundColor = "rgba(46, 204, 113, 0.4)"; li.style.borderRadius = "4px"; }
        list.appendChild(li);
    });
}

// --- 暴露給 HTML onClick 調用的全域函數 ---
window.submitScore = async function() {
    const cls = document.getElementById('lb-class').value.trim();
    const sid = document.getElementById('lb-sid').value.trim();
    const name = document.getElementById('lb-name').value.trim();
    if (!cls || !sid || !name) { alert("請填寫班別、學號及名字！"); return; }

    if (!GAS_LEADERBOARD_URL) return;

    scoreSubmitted = true;
    document.getElementById('submit-form').style.display = 'none';
    document.getElementById('leaderboard-list').innerHTML = "<li>上傳中並更新排行榜...</li>";

    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-HK');
    const timeStr = now.toLocaleTimeString('zh-HK');
    const diff = currentDifficulty; 
    const score = enemiesKilled;
    const timestamp = now.getTime();

    const addUrl = `${GAS_LEADERBOARD_URL}?action=addScore&date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(timeStr)}&diff=${encodeURIComponent(diff)}&cls=${encodeURIComponent(cls)}&sid=${encodeURIComponent(sid)}&name=${encodeURIComponent(name)}&score=${score}&t=${timestamp}`;
    fetch(addUrl).catch(e => console.log("LB 上傳延遲", e));

    try {
        let res = await fetch(`${GAS_LEADERBOARD_URL}?action=getLeaderboard&t=${timestamp}`);
        let data = await res.json();
        data.push({ diff: diff, cls: cls, name: name, score: score, isMe: true });
        data.sort((a, b) => b.score - a.score);
        renderLeaderboard(data);
    } catch(e) {
        renderLeaderboard([{ diff: diff, cls: cls, name: name, score: score, isMe: true }]);
    }
}

window.startGame = function(level) {
    currentDifficulty = level;
    let menu = document.getElementById('start-menu');
    if (menu) menu.style.display = 'none';
    resetGame();
}

function generateFallbackMCQ() {
    let maxVal = 10 + (Math.max(0, player.weaponLevel) * 10);
    let num1 = getRandomInt(5, maxVal); let num2 = getRandomInt(5, maxVal);
    let ans = num1 + num2;
    let opts = [
        { text: `\\( ${ans} \\)`, isCorrect: true },
        { text: `\\( ${ans + getRandomInt(1, 5)} \\)`, isCorrect: false },
        { text: `\\( ${ans - getRandomInt(1, 5)} \\)`, isCorrect: false },
        { text: `\\( ${ans + getRandomInt(6, 10)} \\)`, isCorrect: false }
    ];
    return { 
        question: `<div class="mb-4 text-base text-slate-300">請計算以下結果：</div><div class="text-2xl font-bold py-4">\\( \\displaystyle ${num1} + ${num2} = ? \\)</div>`, 
        options: shuffleArray(opts).map((o,i)=>({...o, id: String.fromCharCode(65+i)})) 
    };
}

function triggerMath(type) {
    currentMathType = type;
    gameState = 'MATH_TIME';
    isShooting = false; rightJoy.active = false; leftJoy.active = false;
    
    let headerEl = document.getElementById('math-header');
    let containerEl = document.getElementById('math-container');
    
    if (headerEl && containerEl) {
        if (type === 'UPGRADE') {
            headerEl.textContent = '⚡ 武器進化程序 ⚡'; headerEl.style.color = '#eab308';
            containerEl.style.borderColor = '#eab308';
        } else {
            headerEl.textContent = '🔵 彈藥補給程序 🔵'; headerEl.style.color = '#38bdf8';
            containerEl.style.borderColor = '#38bdf8';
        }
    }

    let lvlMap = { 'S1': '1', 'S2': '2', 'S3': '3' };
    let qLevel = lvlMap[currentDifficulty] || '1';
    let qData;

    if (typeof generateIndicesQuestions === 'function') {
        try {
            let qList = generateIndicesQuestions(1, qLevel);
            qData = (qList && qList.length > 0) ? qList[0] : generateFallbackMCQ();
        } catch(e) { 
            console.error("題庫生成錯誤，使用後備題目", e); 
            qData = generateFallbackMCQ(); 
        }
    } else {
        qData = generateFallbackMCQ();
    }

    let contentEl = document.getElementById('math-question-content');
    if (contentEl) contentEl.innerHTML = qData.question;
    
    const optsContainer = document.getElementById('math-options-container');
    if (optsContainer) {
        optsContainer.innerHTML = '';
        qData.options.forEach(opt => {
            let btn = document.createElement('div');
            btn.className = 'mcq-btn';
            btn.innerHTML = `<span class="mcq-label">${opt.id}.</span> <span>${opt.text}</span>`;
            btn.onclick = () => window.submitMCQ(opt.isCorrect);
            optsContainer.appendChild(btn);
        });
    }

    let overlay = document.getElementById('math-overlay');
    if (overlay) {
        if (typeof MathJax !== 'undefined') MathJax.typesetPromise([overlay]).catch(e => console.log(e));
        overlay.style.display = 'flex';
    }
    
    mathTimer = 600; // 10 秒
}

window.submitMCQ = function(isCorrect) {
    if (isCorrect) {
        if (currentMathType === 'UPGRADE') {
            if (player.weaponLevel === -1) {
                player.weaponLevel = 0; player.speed = WEAPONS[0].playerSpeed;
                player.currentMagazine = WEAPONS[0].magCapacity || 30; player.totalAmmo += WEAPONS[0].reloadAmmo || 30;
                addFloatingText(`解鎖: ${WEAPONS[0].name}!`, canvas.width/2, canvas.height/4, '#fbbf24', 35);
            } else if (player.weaponLevel < WEAPONS.length - 1) {
                player.weaponLevel++; player.speed = WEAPONS[player.weaponLevel].playerSpeed;
                let ammoToAdd = WEAPONS[player.weaponLevel].reloadAmmo || 30; player.totalAmmo += ammoToAdd;
                addFloatingText(`解鎖: ${WEAPONS[player.weaponLevel].name}!`, canvas.width/2, canvas.height/4, '#fbbf24', 35);
                addFloatingText(`+${ammoToAdd} 總彈藥`, canvas.width/2, canvas.height/4 + 40, '#000000', 25);
            } else {
                let ammoToAdd = WEAPONS[player.weaponLevel].reloadAmmo || 30; player.totalAmmo += ammoToAdd;
                addFloatingText(`等級上限！ +${ammoToAdd} 總彈藥`, canvas.width/2, canvas.height/4, '#fbbf24', 35);
            }
            player.hp = Math.min(player.maxHp, player.hp + 50); 
            createParticles(player.x, player.y, '#4ade80', 60, 10); 
        } else if (currentMathType === 'AMMO') {
            let ammoToAdd = (player.weaponLevel >= 0 && WEAPONS[player.weaponLevel].ammoBoxRefill) ? WEAPONS[player.weaponLevel].ammoBoxRefill : 30;
            player.totalAmmo += ammoToAdd;
            addFloatingText(`+${ammoToAdd} 總彈藥`, canvas.width/2, canvas.height/4 + 40, '#38bdf8', 25);
            createParticles(player.x, player.y, '#38bdf8', 50, 10); 
        }
        closeMathOverlay(true);
    } else {
        addFloatingText("❌ 答錯了！寶箱損毀", player.x, player.y - 40, '#ef4444');
        closeMathOverlay(false);
    }
}

function closeMathOverlay(success) {
    let overlay = document.getElementById('math-overlay');
    if (overlay) overlay.style.display = 'none';
    
    shakeTime = success ? 0 : 15;
    gameState = 'PLAYING'; 
    isShooting = false; leftJoy.active = false; rightJoy.active = false; keys.w = keys.a = keys.s = keys.d = false; 
    let sSfx = document.getElementById('shootSfx'); if (sSfx && !sSfx.paused) { sSfx.pause(); sSfx.currentTime = 0; }
}

// 事件處理綁定
canvas.addEventListener('touchstart', handleTouchStart, {passive: false});
canvas.addEventListener('touchmove', handleTouchMove, {passive: false});
canvas.addEventListener('touchend', handleTouchEnd, {passive: false});
canvas.addEventListener('touchcancel', handleTouchEnd, {passive: false});

function handleTouchStart(e) {
    if(e.target !== canvas) return; 
    e.preventDefault(); initAudio();
    const touches = e.changedTouches;

    for (let i = 0; i < touches.length; i++) {
        let t = touches[i];
        let tx = t.clientX; let ty = t.clientY;

        if (gameState === 'GAME_OVER' || gameState === 'VICTORY') { 
            if (scoreSubmitted || (document.getElementById('submit-form') && document.getElementById('submit-form').style.display === 'none')) resetGame(); 
            return; 
        }

        if (gameState === 'PLAYING') {
            if (tx > UI_BOUND && tx < canvas.width / 2 && !leftJoy.active) {
                leftJoy.active = true; leftJoy.id = t.identifier;
                updateFixedJoystick(leftJoy, tx, ty);
            } 
            else if (tx >= canvas.width / 2 && !rightJoy.active) {
                rightJoy.active = true; rightJoy.id = t.identifier;
                rightJoy.base = {x: t.clientX, y: t.clientY};
                rightJoy.stick = {x: t.clientX, y: t.clientY};
                player.angle = Math.atan2(ty - player.y, tx - player.x) || 0;
            }
        }
    }
}

function handleTouchMove(e) {
    e.preventDefault(); const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        let t = touches[i]; let tx = t.clientX; let ty = t.clientY;
        if (leftJoy.active && t.identifier === leftJoy.id) updateFixedJoystick(leftJoy, Math.max(UI_BOUND, tx), ty); 
        if (rightJoy.active && t.identifier === rightJoy.id) {
            let dx = tx - rightJoy.base.x; let dy = ty - rightJoy.base.y; let dist = Math.sqrt(dx*dx + dy*dy);
            rightJoy.angle = Math.atan2(dy, dx) || 0;
            if (dist > joyRadius) {
                rightJoy.stick.x = rightJoy.base.x + Math.cos(rightJoy.angle) * joyRadius; rightJoy.stick.y = rightJoy.base.y + Math.sin(rightJoy.angle) * joyRadius;
                rightJoy.dir.x = Math.cos(rightJoy.angle); rightJoy.dir.y = Math.sin(rightJoy.angle);
            } else {
                rightJoy.stick.x = tx; rightJoy.stick.y = ty; rightJoy.dir.x = dist > 0 ? dx / joyRadius : 0; rightJoy.dir.y = dist > 0 ? dy / joyRadius : 0;
            }
            player.angle = rightJoy.angle;
        }
    }
}

function handleTouchEnd(e) {
    e.preventDefault(); const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        let t = touches[i];
        if (leftJoy.active && t.identifier === leftJoy.id) { leftJoy.active = false; leftJoy.dir = {x:0, y:0}; leftJoy.stick = {x: leftJoyBase.x, y: leftJoyBase.y}; }
        if (rightJoy.active && t.identifier === rightJoy.id) { rightJoy.active = false; rightJoy.dir = {x:0, y:0}; }
    }
}

function updateFixedJoystick(joy, tx, ty) {
    let dx = tx - leftJoyBase.x; let dy = ty - leftJoyBase.y; let dist = Math.sqrt(dx*dx + dy*dy); let angle = Math.atan2(dy, dx) || 0;
    if (dist > joyRadius) {
        joy.stick.x = leftJoyBase.x + Math.cos(angle) * joyRadius; joy.stick.y = leftJoyBase.y + Math.sin(angle) * joyRadius; joy.dir.x = Math.cos(angle); joy.dir.y = Math.sin(angle);
    } else {
        joy.stick.x = tx; joy.stick.y = ty; joy.dir.x = dist > 0 ? dx / joyRadius : 0; joy.dir.y = dist > 0 ? dy / joyRadius : 0;
    }
}

window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
window.addEventListener('mousedown', (e) => {
    if(e.target !== canvas) return;
    initAudio();
    if (gameState === 'GAME_OVER' || gameState === 'VICTORY') {
        if (scoreSubmitted || (document.getElementById('submit-form') && document.getElementById('submit-form').style.display === 'none')) resetGame(); 
    } else if (gameState === 'PLAYING') isShooting = true;
});
window.addEventListener('mouseup', () => { isShooting = false; });
window.addEventListener('keydown', (e) => {
    initAudio();
    if (gameState === 'PLAYING') { let key = e.key.toLowerCase(); if (keys.hasOwnProperty(key)) keys[key] = true; } 
    else if (gameState === 'GAME_OVER' || gameState === 'VICTORY') { 
        if (e.key === 'Enter') { if (scoreSubmitted || (document.getElementById('submit-form') && document.getElementById('submit-form').style.display === 'none')) resetGame(); }
    }
});
window.addEventListener('keyup', (e) => { if (gameState === 'PLAYING') { let key = e.key.toLowerCase(); if (keys.hasOwnProperty(key)) keys[key] = false; }});

function fireBullet(angle, weapon, customSpeed) {
    bullets.push({
        x: player.x + Math.cos(player.angle || 0) * 30, y: player.y + Math.sin(player.angle || 0) * 30, 
        vx: Math.cos(angle || 0) * customSpeed, vy: Math.sin(angle || 0) * customSpeed,
        radius: weapon.size || 4, color: weapon.color, glow: weapon.glow, damage: weapon.damage, penetrate: weapon.penetrate, hitEnemies: []
    });
}

function spawnLootBox() {
    lootBoxes.push({
        x: Math.random() * (canvas.width - UI_BOUND - 100) + UI_BOUND + 50, y: Math.random() * (canvas.height - 200) + 100,
        size: 35, pulse: 0, spawnTime: globalTime 
    });
    addFloatingText("武器升級箱降落！", canvas.width/2, 150, '#eab308', 30);
}

function spawnAmmoBox() {
    if (ammoBoxes.length < 3) {
        ammoBoxes.push({
            x: Math.random() * (canvas.width - UI_BOUND - 100) + UI_BOUND + 50, y: Math.random() * (canvas.height - 200) + 100,
            size: 28, pulse: 0, spawnTime: globalTime 
        });
        addFloatingText("彈藥補給包降落！", canvas.width/2, 120, '#38bdf8', 26);
    }
}

function spawnEnemy() {
    if (gameState !== 'PLAYING' || monsterQueue.length === 0) return;
    let mData = monsterQueue.shift(); totalMonstersSpawned++;
    
    let x = Math.random() < 0.5 ? UI_BOUND + 10 : canvas.width + 50;
    let y = Math.random() * canvas.height;

    enemies.push({ 
        x: x, y: y, size: mData.size, color: mData.color, speed: mData.speed, 
        hp: mData.hp, maxHp: mData.hp, tier: mData.tier, name: mData.name, bobPhase: Math.random() * Math.PI * 2 
    });
    
    if (mData.tier === 5) {
        bossAlarmTimer = 120;
        addFloatingText("⚠️ 萬血首領來襲！ ⚠️", canvas.width/2, 100, '#ef4444', 50);
    }
}

function triggerGameOver(isVictory) {
    gameState = isVictory ? 'VICTORY' : 'GAME_OVER';
    let form = document.getElementById('submit-form');
    if (form) form.style.display = 'flex';
    scoreSubmitted = false;
}

function resetGame() {
    player.weaponLevel = -1;
    player.hp = player.maxHp; 
    player.speed = 4; 
    player.currentMagazine = 0; 
    player.totalAmmo = 0; 
    player.isReloading = false; player.reloadTimer = 0;
    player.angle = 0;
    
    enemiesKilled = 0; totalMonstersSpawned = 0;
    player.x = UI_BOUND + (canvas.width - UI_BOUND)/2; player.y = canvas.height / 2;
    bullets = []; enemies = []; lootBoxes = []; ammoBoxes = []; particles = []; floatingTexts = [];
    isShooting = false; keys.w = keys.a = keys.s = keys.d = false;
    leftJoy.active = false; rightJoy.active = false;
    player.lastFireTime = 0; globalTime = 0; bossAlarmTimer = 0; currentWave = 1;
    
    let form = document.getElementById('submit-form');
    if (form) form.style.display = 'none';
    
    initMonsterQueue(); fetchLeaderboard();
    gameState = 'PLAYING';
    
    spawnLootBox();
}

function checkCollision(obj1, obj2, dist) {
    let dx = obj1.x - obj2.x; let dy = obj1.y - obj2.y; return Math.sqrt(dx*dx + dy*dy) <= dist;
}

function startReload() {
    if (player.weaponLevel === -1) return;
    let cap = WEAPONS[player.weaponLevel].magCapacity || 30;
    if (player.totalAmmo > 0 && player.currentMagazine < cap && !player.isReloading) {
        player.isReloading = true;
        player.reloadTimer = 30; 
        let rSfx = document.getElementById('reloadSfx');
        if (rSfx) { rSfx.currentTime = 0; rSfx.play().catch(e=>{}); }
    }
}

// 主更新迴圈
function update() {
    globalTime++;
    updateHTMLHUD();

    if (gameState === 'START_MENU') return;

    if (gameState === 'MATH_TIME') {
        mathTimer--;
        let pct = Math.max(0, (mathTimer / 600) * 100);
        if (uiElements.mathTimerBar) {
            uiElements.mathTimerBar.style.width = pct + '%';
            uiElements.mathTimerBar.style.backgroundColor = mathTimer < 180 ? '#ef4444' : '#4ade80';
        }
        
        if (mathTimer <= 0) {
            closeMathOverlay(false);
            addFloatingText("⏳ 時間到！寶箱已損毀。", player.x, player.y - 40, '#ef4444');
        }
    }

    if (player.recoilOffset > 0) player.recoilOffset *= 0.8; 
    if (bossAlarmTimer > 0) bossAlarmTimer--;

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx; particles[i].y += particles[i].vy;
        particles[i].life -= particles[i].decay;
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].y += floatingTexts[i].dy; floatingTexts[i].life -= 0.02;
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }

    if (gameState !== 'PLAYING') return;

    if (player.isReloading && player.weaponLevel >= 0) {
        player.reloadTimer--;
        if (player.reloadTimer <= 0) {
            let cap = WEAPONS[player.weaponLevel].magCapacity || 30;
            let bulletsNeeded = cap - player.currentMagazine;
            let bulletsToReload = Math.min(bulletsNeeded, player.totalAmmo);
            player.currentMagazine += bulletsToReload;
            player.totalAmmo -= bulletsToReload;
            player.isReloading = false;
        }
    }

    if (player.weaponLevel >= 0 && globalTime % ammoBoxSpawnInterval === 0) spawnAmmoBox(); 
    if (globalTime % lootBoxSpawnInterval === 0) spawnLootBox(); 
    
    if (monsterQueue.length > 0) { 
        if (enemies.length < 4 || globalTime % 180 === 0) spawnEnemy(); 
    }

    let dx = 0, dy = 0; let safeSpeed = player.speed || 4; 
    
    if (leftJoy.active) { dx = leftJoy.dir.x * safeSpeed; dy = leftJoy.dir.y * safeSpeed; } 
    else {
        if (keys.w) dy -= safeSpeed; if (keys.s) dy += safeSpeed;
        if (keys.a) dx -= safeSpeed; if (keys.d) dx += safeSpeed;
    }
    
    player.isMoving = (dx !== 0 || dy !== 0);
    if (dx !== 0 && dy !== 0 && !leftJoy.active) { 
        let len = Math.sqrt(dx*dx + dy*dy); dx = (dx / len) * safeSpeed; dy = (dy / len) * safeSpeed; 
    }
    
    if (!isNaN(dx) && !isNaN(dy)) { player.x += dx; player.y += dy; }
    player.x = Math.max(UI_BOUND + player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

    if (rightJoy.active) { player.angle = rightJoy.angle || 0; } 
    else if (!('ontouchstart' in window)) { player.angle = Math.atan2(mouseY - player.y, mouseX - player.x) || 0; }

    if (isShooting || rightJoy.active) {
        if (player.weaponLevel === -1) {
            if (globalTime % 30 === 0) {
                addFloatingText("請先拾取升級箱獲取武器！", player.x, player.y - 40, '#ef4444');
                let emptySfx = document.getElementById('emptyAmmoSfx'); 
                if (emptySfx) { emptySfx.currentTime = 0; emptySfx.play().catch(e=>{}); }
            }
            let sSfx = document.getElementById('shootSfx'); if (sSfx && !sSfx.paused) { sSfx.pause(); sSfx.currentTime = 0; }
        } else {
            const weapon = WEAPONS[player.weaponLevel];
            if (globalTime - player.lastFireTime >= weapon.fireRate) {
                if (player.currentMagazine > 0 && !player.isReloading) {
                    let sSfx = document.getElementById('shootSfx');
                    if (sSfx) { sSfx.currentTime = 0; sSfx.play().catch(e=>{}); }

                    player.currentMagazine--; 

                    for(let k=0; k<weapon.bullets; k++) {
                        let speedOffset = weapon.speed - (k * 2.5); 
                        if (speedOffset < 8) speedOffset = 8;
                        let angleOffset = (player.angle || 0) + (Math.random() - 0.5) * 0.05; 
                        fireBullet(angleOffset, weapon, speedOffset);
                    }
                    
                    createParticles(player.x + Math.cos(player.angle || 0)*30, player.y + Math.sin(player.angle || 0)*30, weapon.color, weapon.level*2, weapon.level*1.5);
                    shakeTime = Math.max(shakeTime, 2);
                    player.recoilOffset = weapon.recoil; player.lastFireTime = globalTime;
                } else if (player.currentMagazine <= 0 && player.totalAmmo > 0 && !player.isReloading) {
                    startReload(); 
                    let sSfx = document.getElementById('shootSfx'); if (sSfx && !sSfx.paused) { sSfx.pause(); sSfx.currentTime = 0; }
                } else if (player.currentMagazine <= 0 && player.totalAmmo <= 0 && !player.isReloading) {
                    if (globalTime % 30 === 0) {
                        addFloatingText("彈藥耗盡！尋找補給箱！", player.x, player.y - 40, '#ef4444');
                        let emptySfx = document.getElementById('emptyAmmoSfx'); if (emptySfx) { emptySfx.currentTime = 0; emptySfx.play().catch(e=>{}); }
                    }
                    let sSfx = document.getElementById('shootSfx'); if (sSfx && !sSfx.paused) { sSfx.pause(); sSfx.currentTime = 0; }
                }
            }
        }
    } else {
        let sSfx = document.getElementById('shootSfx'); if (sSfx && !sSfx.paused) { sSfx.pause(); sSfx.currentTime = 0; }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; b.x += b.vx; b.y += b.vy;
        if (Math.random() < 0.3) createParticles(b.x, b.y, b.color, 1, 1);
        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) bullets.splice(i, 1);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];
        let angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x) || 0;
        enemy.angle = angleToPlayer;
        enemy.x += Math.cos(angleToPlayer) * enemy.speed; enemy.y += Math.sin(angleToPlayer) * enemy.speed;

        if (checkCollision(player, enemy, player.radius + enemy.size/2)) {
            let dmg = 10 + (enemy.tier * 5); 
            player.hp -= dmg; shakeTime = 15;
            createParticles(player.x, player.y, '#ef4444', 30, 8); 
            addFloatingText(`-${dmg}`, player.x, player.y - 50, '#ef4444', 24);
            enemy.x -= Math.cos(angleToPlayer) * 40; enemy.y -= Math.sin(angleToPlayer) * 40;
            if (player.hp <= 0) { createParticles(player.x, player.y, '#ef4444', 100, 15); triggerGameOver(false); }
            continue;
        }

        for (let j = bullets.length - 1; j >= 0; j--) {
            let b = bullets[j];
            if (b.penetrate && b.hitEnemies.includes(enemy)) continue;

            if (checkCollision(enemy, b, enemy.size/2 + b.radius)) {
                enemy.hp -= b.damage; 
                createParticles(enemy.x, enemy.y, b.color, 6, 5); 
                
                if (b.penetrate) b.hitEnemies.push(enemy); else bullets.splice(j, 1); 

                if (enemy.hp <= 0) {
                    createParticles(enemy.x, enemy.y, enemy.color, enemy.tier === 5 ? 100 : 40, 8); 
                    monstersLeft[enemy.tier]--; 
                    enemies.splice(i, 1); enemiesKilled++;
                    if (enemiesKilled >= TOTAL_MONSTERS) triggerGameOver(true);
                    break; 
                }
            }
        }
    }

    for (let i = lootBoxes.length - 1; i >= 0; i--) {
        if (globalTime - lootBoxes[i].spawnTime > 600) { createParticles(lootBoxes[i].x, lootBoxes[i].y, '#94a3b8', 25, 5); lootBoxes.splice(i, 1); continue; }
        lootBoxes[i].pulse += 0.1;
        if (checkCollision(player, lootBoxes[i], player.radius + lootBoxes[i].size/2)) {
            createParticles(lootBoxes[i].x, lootBoxes[i].y, '#eab308', 40, 8);
            lootBoxes.splice(i, 1); triggerMath('UPGRADE'); 
            break;
        }
    }

    for (let i = ammoBoxes.length - 1; i >= 0; i--) {
        if (globalTime - ammoBoxes[i].spawnTime > 600) { createParticles(ammoBoxes[i].x, ammoBoxes[i].y, '#94a3b8', 25, 5); ammoBoxes.splice(i, 1); continue; }
        ammoBoxes[i].pulse += 0.1;
        if (checkCollision(player, ammoBoxes[i], player.radius + ammoBoxes[i].size/2)) {
            createParticles(ammoBoxes[i].x, ammoBoxes[i].y, '#38bdf8', 40, 8);
            ammoBoxes.splice(i, 1); triggerMath('AMMO'); 
            break;
        }
    }
}

function draw() {
    if (gameState === 'START_MENU') {
        ctx.fillStyle = '#0f172a'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
    }

    ctx.fillStyle = '#d2b48c'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    if (shakeTime > 0) {
        let mag = (shakeTime / 10) * 8; 
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag); shakeTime--;
    }

    ctx.strokeStyle = 'rgba(139, 69, 19, 0.15)'; ctx.lineWidth = 2;
    for(let i=0; i<canvas.width; i+=80) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
    for(let i=0; i<canvas.height; i+=80) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }

    if (bossAlarmTimer > 0) {
        let alpha = Math.abs(Math.sin(bossAlarmTimer * 0.1)) * 0.4;
        ctx.fillStyle = `rgba(220, 38, 38, ${alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    let drawables = [];
    if (player.hp > 0) drawables.push({ type: 'player', y: player.y, obj: player });
    for (let e of enemies) drawables.push({ type: 'enemy', y: e.y, obj: e });
    for (let b of lootBoxes) drawables.push({ type: 'box', y: b.y, obj: b });
    for (let a of ammoBoxes) drawables.push({ type: 'ammoBox', y: a.y, obj: a });
    
    drawables.sort((a, b) => a.y - b.y);

    for (let item of drawables) {
        if (item.type === 'box') {
            let box = item.obj; let glow = Math.abs(Math.sin(box.pulse)) * 8; let timeLeft = 600 - (globalTime - box.spawnTime);
            if (timeLeft < 180 && globalTime % 20 < 10) ctx.globalAlpha = 0.4;
            ctx.save(); ctx.translate(box.x, box.y);
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 0, 24, 12, 0, 0, Math.PI*2); ctx.fill();
            let visualY = -15 - glow;
            ctx.fillStyle = '#78350f'; ctx.fillRect(-20, visualY - 15, 40, 30);
            ctx.fillStyle = '#f59e0b'; ctx.fillRect(-22, visualY - 23, 44, 15);
            ctx.fillStyle = '#fbbf24'; ctx.fillRect(-5, visualY - 10, 10, 10);
            ctx.fillStyle = 'white'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText('UP', 0, visualY - 30);
            ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, visualY - 50, 10, -Math.PI/2, -Math.PI/2 + (timeLeft/600) * Math.PI*2); ctx.stroke();
            ctx.restore(); ctx.globalAlpha = 1.0;
        } 
        else if (item.type === 'ammoBox') {
            let box = item.obj; let glow = Math.abs(Math.sin(box.pulse)) * 8; let timeLeft = 600 - (globalTime - box.spawnTime);
            if (timeLeft < 180 && globalTime % 20 < 10) ctx.globalAlpha = 0.4;
            ctx.save(); ctx.translate(box.x, box.y);
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI*2); ctx.fill();
            let visualY = -15 - glow;
            ctx.fillStyle = '#1d4ed8'; ctx.fillRect(-18, visualY - 12, 36, 24); 
            ctx.fillStyle = '#3b82f6'; ctx.fillRect(-20, visualY - 20, 40, 12);
            ctx.fillStyle = '#60a5fa'; ctx.fillRect(-5, visualY - 8, 10, 8);
            ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillText('AMMO', 0, visualY - 25);
            ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, visualY - 40, 8, -Math.PI/2, -Math.PI/2 + (timeLeft/600) * Math.PI*2); ctx.stroke();
            ctx.restore(); ctx.globalAlpha = 1.0;
        }
        else if (item.type === 'enemy') {
            let e = item.obj; let isFacingRight = player.x > e.x; let bob = Math.abs(Math.sin(globalTime * 0.1 * e.speed + (e.x*0.01))) * (e.size * 0.15);
            ctx.save(); ctx.translate(e.x, e.y); 
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, e.size*0.5, e.size*0.2, 0, 0, Math.PI*2); ctx.fill();
            let visualY = -10 - bob;
            ctx.fillStyle = e.color; ctx.beginPath();
            ctx.arc(0, visualY - e.size*0.4, e.size*0.45, Math.PI, 0); 
            ctx.lineTo(e.size*0.45, visualY + e.size*0.1); ctx.lineTo(-e.size*0.45, visualY + e.size*0.1); ctx.fill();
            if (e.tier === 1 || e.tier === 2) {
                ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(-e.size*0.4, visualY - e.size*0.1); ctx.lineTo(e.size*0.4, visualY); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-e.size*0.4, visualY - e.size*0.3); ctx.lineTo(e.size*0.4, visualY - e.size*0.2); ctx.stroke();
            } else if (e.tier === 4) {
                ctx.fillStyle = '#bef264'; ctx.beginPath(); ctx.arc(-e.size*0.2, visualY - e.size*0.1, e.size*0.1, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(e.size*0.25, visualY - e.size*0.3, e.size*0.08, 0, Math.PI*2); ctx.fill();
            } else if (e.tier === 5) {
                ctx.fillStyle = '#334155';
                ctx.beginPath(); ctx.moveTo(-e.size*0.2, visualY - e.size*0.4); ctx.lineTo(-e.size*0.5, visualY - e.size*0.7); ctx.lineTo(-e.size*0.3, visualY - e.size*0.3); ctx.fill();
                ctx.beginPath(); ctx.moveTo(e.size*0.2, visualY - e.size*0.4); ctx.lineTo(e.size*0.5, visualY - e.size*0.7); ctx.lineTo(e.size*0.3, visualY - e.size*0.3); ctx.fill();
                ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.moveTo(-20, visualY - e.size*0.4); ctx.lineTo(-25, visualY - e.size*0.6); ctx.lineTo(0, visualY - e.size*0.5); ctx.lineTo(25, visualY - e.size*0.6); ctx.lineTo(20, visualY - e.size*0.4); ctx.fill();
            }
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
            let eyeOffsetX = isFacingRight ? e.size*0.15 : -e.size*0.15;
            ctx.fillStyle = e.tier >= 3 ? '#ef4444' : 'white';
            ctx.beginPath(); ctx.arc(eyeOffsetX - e.size*0.15, visualY - e.size*0.3, e.size*0.08, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(eyeOffsetX + e.size*0.15, visualY - e.size*0.3, e.size*0.08, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'black'; 
            ctx.beginPath(); ctx.arc(eyeOffsetX - e.size*0.15 + (isFacingRight?1:-1), visualY - e.size*0.3, e.size*0.04, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(eyeOffsetX + e.size*0.15 + (isFacingRight?1:-1), visualY - e.size*0.3, e.size*0.04, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'white'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText(`Lv.${e.tier}`, 0, visualY - e.size*0.9 - 10);
            let hpBarWidth = e.tier === 5 ? 100 : 50; ctx.fillStyle = '#334155'; ctx.fillRect(-hpBarWidth/2, visualY - e.size*0.7 - 15, hpBarWidth, 8);
            ctx.fillStyle = '#ef4444'; ctx.fillRect(-hpBarWidth/2, visualY - e.size*0.7 - 15, hpBarWidth * (e.hp / e.maxHp), 8);
            ctx.restore();
        }
        else if (item.type === 'player') {
            let p = item.obj; let isFacingRight = (rightJoy.active) ? (Math.abs(rightJoy.angle) < Math.PI/2) : (mouseX > p.x); let bob = p.isMoving ? Math.sin(globalTime * 0.5) * 4 : 0;
            ctx.save(); ctx.translate(p.x, p.y);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, p.radius*1.2, p.radius*0.5, 0, 0, Math.PI*2); ctx.fill();
            let visualY = -10 + bob; 
            
            let gunDrawLogic = () => {
                if (player.weaponLevel === -1) return;
                let wepColor = WEAPONS[player.weaponLevel] ? WEAPONS[player.weaponLevel].color : '#fff';
                ctx.save(); ctx.translate(0, visualY - 5); ctx.rotate(p.angle || 0);
                if (Math.abs(p.angle) > Math.PI/2) ctx.scale(1, -1);
                ctx.fillStyle = '#1e293b'; ctx.fillRect(0 - p.recoilOffset, -4, 25, 8); 
                ctx.fillStyle = '#475569'; ctx.fillRect(10 - p.recoilOffset, -2, 15, 4); 
                ctx.fillStyle = wepColor; ctx.fillRect(25 - p.recoilOffset, -3, 6, 6); ctx.restore();
            };
            
            let aimUp = Math.sin(p.angle || 0) < 0; if (aimUp) gunDrawLogic();
            ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.moveTo(-12, visualY - 10); ctx.lineTo(-20, visualY + 20); ctx.lineTo(20, visualY + 20); ctx.lineTo(12, visualY - 10); ctx.fill();
            let legSwing = p.isMoving ? Math.sin(globalTime * 0.8) * 8 : 0;
            ctx.fillStyle = '#475569'; ctx.fillRect(-8, visualY + 15 - legSwing, 6, 12); ctx.fillRect(2, visualY + 15 + legSwing, 6, 12);
            ctx.fillStyle = '#1d4ed8'; ctx.fillRect(-12, visualY - 15, 24, 30); 
            ctx.fillStyle = '#94a3b8'; ctx.fillRect(-14, visualY - 15, 28, 16); 
            ctx.fillStyle = '#fcd34d'; ctx.beginPath(); ctx.arc(0, visualY - 25, 16, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.arc(0, visualY - 28, 17, Math.PI, 0); ctx.fill(); ctx.fillRect(-18, visualY - 28, 36, 6); 
            ctx.fillStyle = '#b91c1c'; ctx.fillRect(-3, visualY - 48, 6, 12);
            let eyeX = Math.cos(p.angle || 0) * 3; let eyeY = Math.sin(p.angle || 0) * 3;
            ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.arc(-5 + eyeX, visualY - 23 + eyeY, 3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(5 + eyeX, visualY - 23 + eyeY, 3, 0, Math.PI*2); ctx.fill();
            
            if (player.weaponLevel >= 0) {
                ctx.fillStyle = '#fcd34d'; ctx.beginPath(); ctx.arc(Math.cos(p.angle || 0)*10 - p.recoilOffset, visualY - 5 + Math.sin(p.angle || 0)*10, 5, 0, Math.PI*2); ctx.fill();
            }
            
            if (!aimUp) gunDrawLogic(); 
            ctx.restore();
        }
    }

    for (let b of bullets) {
        ctx.shadowBlur = 15; ctx.shadowColor = b.glow; ctx.fillStyle = b.color; 
        ctx.save(); ctx.translate(b.x, b.y - 15); ctx.rotate(Math.atan2(b.vy, b.vx)); 
        ctx.beginPath(); ctx.roundRect(-10, -b.radius/2, 20 + b.radius*2, b.radius, 5); ctx.fill();
        ctx.restore(); ctx.shadowBlur = 0;
    }
    for (let p of particles) { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let text of floatingTexts) {
        ctx.globalAlpha = text.life; ctx.fillStyle = text.color; ctx.font = `bold ${text.size}px Arial`;
        ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.strokeText(text.text, text.x, text.y); ctx.fillText(text.text, text.x, text.y);
    }
    ctx.globalAlpha = 1.0; ctx.restore(); 

    if (gameState === 'PLAYING' && ('ontouchstart' in window)) {
        const drawJoy = (joy, base) => {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.beginPath(); ctx.arc(base.x, base.y, joyRadius, 0, Math.PI*2); ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.stroke();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.beginPath(); ctx.arc(joy.stick.x, joy.stick.y, joyRadius/2.5, 0, Math.PI*2); ctx.fill();
        };
        drawJoy(leftJoy, leftJoyBase); 
        if (rightJoy.active) drawJoy(rightJoy, rightJoy.base);
    }

    let gameCenterX = UI_BOUND + (canvas.width - UI_BOUND) / 2;

    if (gameState === 'GAME_OVER' || gameState === 'VICTORY') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        if (gameState === 'VICTORY') {
            ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 60px Arial'; ctx.shadowBlur = 30; ctx.shadowColor = '#eab308';
            ctx.fillText('MISSION ACCOMPLISHED!', gameCenterX, canvas.height/2 - 80);
            ctx.fillStyle = 'white'; ctx.font = 'bold 24px Arial'; ctx.shadowBlur = 0;
            let finalWepName = player.weaponLevel >= 0 ? WEAPONS[player.weaponLevel].name : '無';
            ctx.fillText(`成功擊殺終極 Boss！ 最終武器: ${finalWepName}`, gameCenterX, canvas.height/2 - 10);
        } else {
            ctx.fillStyle = '#ef4444'; ctx.font = 'bold 80px Arial'; ctx.shadowBlur = 30; ctx.shadowColor = '#dc2626';
            ctx.fillText('YOU DIED', gameCenterX, canvas.height/2 - 80);
            ctx.fillStyle = 'white'; ctx.font = 'bold 28px Arial'; ctx.shadowBlur = 0;
            ctx.fillText(`擊殺數: ${enemiesKilled} / ${TOTAL_MONSTERS}`, gameCenterX, canvas.height/2 - 10);
        }
        
        ctx.globalAlpha = (globalTime % 60 < 30) ? 1 : 0.5; ctx.fillStyle = '#94a3b8'; ctx.font = '24px Arial';
        ctx.fillText('<< 請在左下方輸入資料上傳排行榜 >>', gameCenterX, canvas.height/2 + 60); 
        ctx.fillText('或按 [Enter] 重新挑戰', gameCenterX, canvas.height/2 + 100); ctx.globalAlpha = 1.0;
    }
}

async function loadGameData() {
    const timestamp = new Date().getTime();
    if (GAS_WEB_APP_URL) {
        try {
            let res = await fetch(`${GAS_WEB_APP_URL}?t=${timestamp}`); 
            let data = await res.json();
            if (data.weapons && data.weapons.length > 1) {
                let rows = data.weapons;
                if (rows[1].length > 9 && rows[1][9]) { let val = parseFloat(rows[1][9]); if (!isNaN(val) && val > 0) lootBoxSpawnInterval = Math.floor(val * 60); }
                if (rows[1].length > 10 && rows[1][10]) { let val = parseFloat(rows[1][10]); if (!isNaN(val) && val > 0) ammoBoxSpawnInterval = Math.floor(val * 60); }
                for(let i=1; i<rows.length; i++) {
                    if (rows[i].length >= 7 && WEAPONS[i-1]) {
                        WEAPONS[i-1].name = String(rows[i][1]).trim() || WEAPONS[i-1].name; WEAPONS[i-1].damage = parseFloat(rows[i][2]) || WEAPONS[i-1].damage; WEAPONS[i-1].bullets = parseInt(rows[i][3]) || WEAPONS[i-1].bullets;
                        WEAPONS[i-1].fireRate = parseInt(rows[i][4]) || WEAPONS[i-1].fireRate; WEAPONS[i-1].playerSpeed = parseFloat(rows[i][5]) || WEAPONS[i-1].playerSpeed; WEAPONS[i-1].reloadAmmo = parseInt(rows[i][6]) || WEAPONS[i-1].reloadAmmo;
                        WEAPONS[i-1].magCapacity = parseInt(rows[i][7]) || WEAPONS[i-1].magCapacity; WEAPONS[i-1].ammoBoxRefill = parseInt(rows[i][8]) || WEAPONS[i-1].ammoBoxRefill;
                    }
                }
            }
            if (data.monsters && data.monsters.length > 1) {
                let rows = data.monsters;
                for(let i=1; i<rows.length; i++) {
                    if (rows[i].length >= 5 && MONSTER_BASE[i-1]) {
                        MONSTER_BASE[i-1].name = String(rows[i][1]).trim() || MONSTER_BASE[i-1].name; MONSTER_BASE[i-1].count = parseInt(rows[i][2]) || MONSTER_BASE[i-1].count;
                        MONSTER_BASE[i-1].hp = parseFloat(rows[i][3]) || MONSTER_BASE[i-1].hp; MONSTER_BASE[i-1].speed = parseFloat(rows[i][4]) || MONSTER_BASE[i-1].speed;
                    }
                }
            }
        } catch(e) { console.error("載入數據失敗，使用本地預設值:", e); }
    }
    document.getElementById('loading-screen').style.display = 'none';
    
    // 進入選單畫面
    let menu = document.getElementById('start-menu');
    if (menu) menu.style.display = 'flex';
    gameState = 'START_MENU';
    gameLoop(); 
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
loadGameData();
