// ==============================================================================
// 📁 FILE 1: config.js (全域變數、設定與輔助函數)
// ==============================================================================

// --- 題庫輔助函數 (供備用題庫使用) ---
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

// --- 視窗與 UI 邊界設定 ---
const UI_BOUND = 200; 

// --- 控制系統變數 ---
let leftJoyBase = { x: UI_BOUND + 60, y: 120 }; 
let leftJoy = { active: false, id: null, stick: {x:0, y:0}, dir: {x:0, y:0} };
let rightJoy = { active: false, id: null, base: {x:0,y:0}, stick: {x:0,y:0}, dir: {x:0,y:0}, angle: 0 };
const joyRadius = 50;

const keys = { w: false, a: false, s: false, d: false };
let mouseX = canvas.width / 2; let mouseY = canvas.height / 2;
let isShooting = false;

// 視窗縮放機制
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    leftJoyBase = { x: UI_BOUND + 60, y: canvas.height - 100 };
    leftJoy.stick = { x: leftJoyBase.x, y: leftJoyBase.y };
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- 全域遊戲狀態 ---
let gameState = 'START_MENU'; 
let globalTime = 0; let shakeTime = 0; let bossAlarmTimer = 0;
let currentDifficulty = 'S1';
let questionBank = [];
let currentMathType = ''; 
let mathTimer = 0;
let scoreSubmitted = false;

// 進度與實體計數
let enemiesKilled = 0; let totalMonstersSpawned = 0; let TOTAL_MONSTERS = 19; 
let monstersLeft = [0, 0, 0, 0, 0, 0]; 
let currentWave = 1;
let lootBoxSpawnInterval = 480; let ammoBoxSpawnInterval = 180; 

// --- 實體屬性設定 ---
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

// 🚀 DOM 快取優化 (提升效能用)
const uiElements = {};
let uiReady = false;
