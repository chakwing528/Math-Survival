// ==============================================================================
// 📁 FILE 3: engine.js (遊戲核心引擎與渲染)
// ==============================================================================

function initMonsterQueue() {
    monsterQueue = []; 
    TOTAL_MONSTERS = 0; 
    monstersLeft = [0, 0, 0, 0, 0, 0];
    for (let m of MONSTER_BASE) {
        for(let i=0; i<m.count; i++) monsterQueue.push({...m});
        TOTAL_MONSTERS += m.count; 
        monstersLeft[m.tier] += m.count; 
    }
}

function fireBullet(angle, weapon, customSpeed) {
    bullets.push({
        x: player.x + Math.cos(player.angle || 0) * 30, 
        y: player.y + Math.sin(player.angle || 0) * 30, 
        vx: Math.cos(angle || 0) * customSpeed, 
        vy: Math.sin(angle || 0) * customSpeed,
        radius: weapon.size || 4, 
        color: weapon.color, 
        glow: weapon.glow, 
        damage: weapon.damage, 
        penetrate: weapon.penetrate, 
        hitEnemies: []
    });
}

function createParticles(x, y, color, count, speedStr = 5, z = 0, decay = null) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x, y: y, z: z,
            vx: (Math.random() - 0.5) * speedStr, 
            vy: (Math.random() - 0.5) * speedStr, 
            vz: Math.random() * speedStr,
            life: 1.0, 
            decay: decay || (0.02 + Math.random() * 0.04), 
            color: color, 
            size: 2 + Math.random() * 4
        });
    }
}

function addFloatingText(text, x, y, color, size = 20) {
    floatingTexts.push({ text, x, y, color, size, life: 1.0, dy: -1.5 });
}

function spawnLootBox() {
    lootBoxes.push({
        x: Math.random() * (canvas.width - UI_BOUND - 100) + UI_BOUND + 50, 
        y: Math.random() * (canvas.height - 200) + 100,
        size: 35, pulse: 0, spawnTime: globalTime 
    });
    addFloatingText("武器升級箱降落！", canvas.width/2, 150, '#eab308', 30);
}

function spawnAmmoBox() {
    if (ammoBoxes.length < 3) {
        ammoBoxes.push({
            x: Math.random() * (canvas.width - UI_BOUND - 100) + UI_BOUND + 50, 
            y: Math.random() * (canvas.height - 200) + 100,
            size: 28, pulse: 0, spawnTime: globalTime 
        });
        addFloatingText("彈藥補給包降落！", canvas.width/2, 120, '#38bdf8', 26);
    }
}

function spawnEnemy() {
    if (gameState !== 'PLAYING' || monsterQueue.length === 0) return;
    let mData = monsterQueue.shift(); 
    totalMonstersSpawned++;
    
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

window.triggerGameOver = function(isVictory) {
    gameState = isVictory ? 'VICTORY' : 'GAME_OVER';
    let form = document.getElementById('submit-form');
    if (form) form.style.display = 'flex';
    scoreSubmitted = false;
}

window.resetGame = function() {
    player.weaponLevel = -1;
    player.hp = player.maxHp; 
    player.speed = 4; 
    player.currentMagazine = 0; 
    player.totalAmmo = 0; 
    player.isReloading = false; 
    player.reloadTimer = 0;
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
    let dx = obj1.x - obj2.x; 
    let dy = obj1.y - obj2.y; 
    return Math.sqrt(dx*dx + dy*dy) <= dist;
}

window.startReload = function() {
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
    if (typeof updateHTMLHUD === 'function') updateHTMLHUD();

    if (gameState === 'START_MENU') return;

    if (gameState === 'MATH_TIME') {
        mathTimer--;
        let pct = Math.max(0, (mathTimer / 600) * 100);
        if (uiElements && uiElements.mathTimerBar) {
            uiElements.mathTimerBar.style.width = pct + '%';
            uiElements.mathTimerBar.style.backgroundColor = mathTimer < 180 ? '#ef4444' : '#4ade80';
        }
        
        if (mathTimer <= 0) {
            if (typeof closeMathOverlay === 'function') closeMathOverlay(false);
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
            lootBoxes.splice(i, 1); 
            if (typeof triggerMath === 'function') triggerMath('UPGRADE'); 
            break;
        }
    }

    for (let i = ammoBoxes.length - 1; i >= 0; i--) {
        if (globalTime - ammoBoxes[i].spawnTime > 600) { createParticles(ammoBoxes[i].x, ammoBoxes[i].y, '#94a3b8', 25, 5); ammoBoxes.splice(i, 1); continue; }
        ammoBoxes[i].pulse += 0.1;
        if (checkCollision(player, ammoBoxes[i], player.radius + ammoBoxes[i].size/2)) {
            createParticles(ammoBoxes[i].x, ammoBoxes[i].y, '#38bdf8', 40, 8);
            ammoBoxes.splice(i, 1); 
            if (typeof triggerMath === 'function') triggerMath('AMMO'); 
            break;
        }
    }
}

// 🚀 畫布效能極限優化：徹底移除耗能的 shadowBlur，改用透明圖層做發光效果
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
            
            // 優化: Fake Glow
            ctx.fillStyle = 'rgba(234, 179, 8, 0.2)'; ctx.beginPath(); ctx.arc(0, -15, 30 + glow, 0, Math.PI*2); ctx.fill();

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

            // 優化: Fake Glow
            ctx.fillStyle = 'rgba(56, 189, 248, 0.2)'; ctx.beginPath(); ctx.arc(0, -15, 30 + glow, 0, Math.PI*2); ctx.fill();

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
            
            // Fake shadow text for performance
            ctx.fillStyle = 'black'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText(`Lv.${e.tier}`, 2, visualY - e.size*0.9 - 8);
            ctx.fillStyle = 'white'; ctx.fillText(`Lv.${e.tier}`, 0, visualY - e.size*0.9 - 10);
            
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
        ctx.save(); ctx.translate(b.x, b.y - 15); ctx.rotate(Math.atan2(b.vy, b.vx)); 
        // 優化: Fake Glow 代替 shadowBlur
        ctx.globalAlpha = 0.4; ctx.fillStyle = b.glow; ctx.beginPath(); ctx.roundRect(-10, -b.radius, 20 + b.radius*4, b.radius*2, 5); ctx.fill();
        ctx.globalAlpha = 1.0; ctx.fillStyle = b.color; ctx.beginPath(); ctx.roundRect(-10, -b.radius/2, 20 + b.radius*2, b.radius, 5); ctx.fill();
        ctx.restore();
    }
    
    for (let p of particles) { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1.0;
    
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let text of floatingTexts) {
        ctx.globalAlpha = text.life; ctx.font = `bold ${text.size}px Arial`;
        // 優化: 移除 shadowBlur，改用繪製兩次文字模擬邊框
        ctx.fillStyle = 'black'; ctx.fillText(text.text, text.x + 2, text.y + 2);
        ctx.fillStyle = text.color; ctx.fillText(text.text, text.x, text.y);
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
            ctx.fillStyle = 'black'; ctx.font = 'bold 60px Arial'; ctx.fillText('MISSION ACCOMPLISHED!', gameCenterX + 3, canvas.height/2 - 77); 
            ctx.fillStyle = '#fbbf24'; ctx.fillText('MISSION ACCOMPLISHED!', gameCenterX, canvas.height/2 - 80);
            ctx.fillStyle = 'white'; ctx.font = 'bold 24px Arial'; 
            let finalWepName = player.weaponLevel >= 0 ? WEAPONS[player.weaponLevel].name : '無';
            ctx.fillText(`成功擊殺終極 Boss！ 最終武器: ${finalWepName}`, gameCenterX, canvas.height/2 - 10);
        } else {
            ctx.fillStyle = 'black'; ctx.font = 'bold 80px Arial'; ctx.fillText('YOU DIED', gameCenterX + 4, canvas.height/2 - 76);
            ctx.fillStyle = '#ef4444'; ctx.fillText('YOU DIED', gameCenterX, canvas.height/2 - 80);
            ctx.fillStyle = 'white'; ctx.font = 'bold 28px Arial';
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
    let loadingScreen = document.getElementById('loading-screen');
    if(loadingScreen) loadingScreen.style.display = 'none';
    
    let menu = document.getElementById('start-menu');
    if (menu) menu.style.display = 'flex';
    gameState = 'START_MENU';
    gameLoop(); 
}

function gameLoop() { 
    if (typeof update === 'function') update(); 
    if (typeof draw === 'function') draw(); 
    requestAnimationFrame(gameLoop); 
}

// 遊戲入口
if (document.getElementById('start-menu')) {
    loadGameData();
}
