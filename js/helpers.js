// ==============================================================================
// 全域工具函數 (供 js/topics/*.js 題庫模組使用，必須最先載入)
// ==============================================================================

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
