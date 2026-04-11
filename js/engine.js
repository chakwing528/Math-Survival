// ... existing code ...
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
// ... existing code ...
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
// ... existing code ...
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
// ... existing code ...
