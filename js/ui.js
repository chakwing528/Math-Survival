// ==============================================================================
// 📁 FILE 2: ui.js (介面控制、排行榜、觸控與事件監聽)
// ==============================================================================

function cacheUIElements() {
    uiElements.hpFill = document.getElementById('ui-hp-fill');
    uiElements.hpText = document.getElementById('ui-hp-text');
    uiElements.wepName = document.getElementById('ui-wep-name');
    uiElements.ammoText = document.getElementById('ui-ammo-text');
    uiElements.mathTimerBar = document.getElementById('math-timer-bar');
    uiElements.mCounts = [];
    for(let i=1; i<=5; i++) uiElements.mCounts[i] = document.getElementById(`m-count-${i}`);
    uiReady = true;
}

let lastHUDState = { hp: -1, weapon: -2, ammo: -1, total: -1, reloading: null, mCounts: [-1,-1,-1,-1,-1,-1] };

function updateHTMLHUD() {
    if (!uiReady) cacheUIElements();
    if (!uiElements.hpFill) return; 

    // 只有在數值發生變化時才去觸碰 DOM，節省 90% 效能，解決卡頓
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
        lastHUDState.weapon = player.weaponLevel; lastHUDState.ammo = player.currentMagazine;
        lastHUDState.total = player.totalAmmo; lastHUDState.reloading = player.isReloading;
    }

    for(let i=1; i<=5; i++) {
        if (uiElements.mCounts[i] && lastHUDState.mCounts[i] !== monstersLeft[i]) {
            uiElements.mCounts[i].textContent = `x ${Math.max(0, monstersLeft[i])}`;
            lastHUDState.mCounts[i] = monstersLeft[i];
        }
    }
}

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
        // 限制名字長度，防止排版跑位
        let safeName = item.name.length > 6 ? item.name.substring(0, 6) + '..' : item.name;
        li.textContent = `${item.cls} ${safeName} - ${item.score}分 (${item.diff})`;
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

// --- 新增：返回主選單函數 ---
window.showStartMenu = function() {
    let form = document.getElementById('submit-form');
    if (form) form.style.display = 'none';
    let menu = document.getElementById('start-menu');
    if (menu) menu.style.display = 'flex';
    gameState = 'START_MENU';
    
    // 清空輸入框
    if(document.getElementById('lb-class')) document.getElementById('lb-class').value = '';
    if(document.getElementById('lb-sid')) document.getElementById('lb-sid').value = '';
    if(document.getElementById('lb-name')) document.getElementById('lb-name').value = '';
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
        question: `<div style="font-size:16px;color:#cbd5e1;margin-bottom:10px;">請計算以下結果：</div><div style="font-size:28px;font-weight:bold;">\\( \\displaystyle ${num1} + ${num2} = ? \\)</div>`, 
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

    // 接駁 indices.js 題庫
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
    
    mathTimer = 600; // 10 秒倒數
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

function closeMathOverlay(success, msg) {
    let overlay = document.getElementById('math-overlay');
    if (overlay) overlay.style.display = 'none';
    
    shakeTime = success ? 0 : 15;
    gameState = 'PLAYING'; 
    isShooting = false; leftJoy.active = false; rightJoy.active = false; keys.w = keys.a = keys.s = keys.d = false; 
    let sSfx = document.getElementById('shootSfx'); if (sSfx && !sSfx.paused) { sSfx.pause(); sSfx.currentTime = 0; }
}

// ==========================================
// 🕹️ 事件處理綁定 (觸控、滑鼠、鍵盤)
// ==========================================
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
            if (scoreSubmitted || (document.getElementById('submit-form') && document.getElementById('submit-form').style.display === 'none')) window.showStartMenu(); 
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
        if (scoreSubmitted || (document.getElementById('submit-form') && document.getElementById('submit-form').style.display === 'none')) window.showStartMenu(); 
    } else if (gameState === 'PLAYING') isShooting = true;
});
window.addEventListener('mouseup', () => { isShooting = false; });
window.addEventListener('keydown', (e) => {
    initAudio();
    if (gameState === 'PLAYING') { let key = e.key.toLowerCase(); if (keys.hasOwnProperty(key)) keys[key] = true; } 
    else if (gameState === 'GAME_OVER' || gameState === 'VICTORY') { 
        if (e.key === 'Enter') { 
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return; // 防止輸入資料時誤觸重啟
            if (scoreSubmitted || (document.getElementById('submit-form') && document.getElementById('submit-form').style.display === 'none')) window.showStartMenu(); 
        }
    }
});
window.addEventListener('keyup', (e) => { if (gameState === 'PLAYING') { let key = e.key.toLowerCase(); if (keys.hasOwnProperty(key)) keys[key] = false; }});
