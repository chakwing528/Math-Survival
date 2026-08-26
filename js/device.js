// ==============================================================================
// 裝置偵測 / 沉浸模式 / 畫質分級                                    (P0 手機版開路)
//
//   輸入模式 (desktop | touch)：
//     初始用 media query 猜，之後跟住「真正用緊乜」即時切換。
//     iPad + 妙控鍵盤、Surface、觸控螢幕手提電腦一律靠呢個動態切換救返。
//     可用網址參數覆寫：?mode=touch / ?mode=desktop
//
//   畫質分級：桌面 high；手機按核心數/記憶體分 medium / low。
//     可用網址參數覆寫：?quality=high|medium|low
// ==============================================================================

const LS_MODE = 'ms_input_mode';
const LS_QUALITY = 'ms_quality';

function qs(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
}

// ------------------------------------------------------------------ 輸入模式
let inputMode = 'desktop';
let modeForced = false;              // ?mode= 覆寫：執行時偵測唔准推翻
let lastTouchAt = 0;                 // 用嚟過濾觸控合成出嚟嘅假滑鼠事件
const modeListeners = [];

function guessInputMode() {
    const forced = qs('mode');
    if (forced === 'touch' || forced === 'desktop') return forced;
    try {
        const saved = localStorage.getItem(LS_MODE);
        if (saved === 'touch' || saved === 'desktop') return saved;
    } catch (e) {}

    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    if (coarse && !fine) return 'touch';
    // 兩樣都有 (混合裝置)：細螢幕當手機，大螢幕當電腦，之後靠動態切換修正
    if (coarse && fine) return Math.min(screen.width, screen.height) < 900 ? 'touch' : 'desktop';
    return 'desktop';
}

export function getInputMode() { return inputMode; }
export function isTouchMode() { return inputMode === 'touch'; }

// auto = true 代表由執行時偵測觸發，會被 ?mode= 覆寫壓住
export function setInputMode(mode, remember = true, auto = false) {
    if (mode !== 'touch' && mode !== 'desktop') return;
    if (auto && modeForced) return;
    if (mode === inputMode) return;
    inputMode = mode;
    _applyModeClass();
    if (remember) { try { localStorage.setItem(LS_MODE, mode); } catch (e) {} }
    modeListeners.forEach(fn => { try { fn(mode); } catch (e) {} });
}

export function onInputModeChange(fn) { modeListeners.push(fn); }

function _applyModeClass() {
    document.body.classList.toggle('mode-touch', inputMode === 'touch');
    document.body.classList.toggle('mode-desktop', inputMode === 'desktop');
}

export function initInputMode() {
    const forced = qs('mode');
    modeForced = (forced === 'touch' || forced === 'desktop');
    inputMode = guessInputMode();
    _applyModeClass();

    window.addEventListener('touchstart', () => {
        lastTouchAt = performance.now();
        setInputMode('touch', true, true);
    }, { passive: true, capture: true });

    // 真滑鼠先會有 movementX/Y；而且觸控後 800ms 內嘅滑鼠事件多數係合成出嚟
    window.addEventListener('mousemove', (e) => {
        if (performance.now() - lastTouchAt < 800) return;
        if (e.movementX || e.movementY) setInputMode('desktop', true, true);
    }, { passive: true });

    // 實體鍵盤 = 電腦。但要避開「手機屏幕鍵盤打班別/學號」誤判
    window.addEventListener('keydown', (e) => {
        const tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (performance.now() - lastTouchAt < 800) return;
        setInputMode('desktop', true, true);
    });

    return inputMode;
}

// ------------------------------------------------------------------ 沉浸模式
// 必須喺 user gesture (click/touch handler) 入面同步呼叫，否則瀏覽器會拒絕
export function enterImmersive() {
    if (inputMode !== 'touch') return;
    const el = document.documentElement;
    try {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            const req = el.requestFullscreen || el.webkitRequestFullscreen;
            if (req) {
                const r = req.call(el, { navigationUI: 'hide' });
                if (r && r.catch) r.catch(() => {});
            }
        }
    } catch (e) {}
    try {
        if (screen.orientation && screen.orientation.lock) {
            const r = screen.orientation.lock('landscape');
            if (r && r.catch) r.catch(() => {});   // iOS Safari 唔支援，靠遮罩兜底
        }
    } catch (e) {}
}

export function exitImmersive() {
    try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) {
                const r = exit.call(document);
                if (r && r.catch) r.catch(() => {});
            }
        }
    } catch (e) {}
}

// ------------------------------------------------------------------ 直屏遮罩
export function initOrientationGuard() {
    const el = document.getElementById('rotate-block');
    if (!el) return;
    const update = () => {
        const portrait = window.innerHeight > window.innerWidth;
        el.style.display = (inputMode === 'touch' && portrait) ? 'flex' : 'none';
    };
    // iOS Safari 轉屏時 resize 可能喺尺寸未更新前就發，所以連續補幾次
    const updateSoon = () => { update(); [80, 250, 600].forEach(ms => setTimeout(update, ms)); };

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', updateSoon);
    try {
        const mq = window.matchMedia('(orientation: portrait)');
        if (mq.addEventListener) mq.addEventListener('change', updateSoon);
        else if (mq.addListener) mq.addListener(updateSoon);   // 舊 Safari
    } catch (e) {}
    onInputModeChange(update);
    update();
}

// ------------------------------------------------------------------ 畫質分級
// high = 現有桌面設定，數值必須同改造前一模一樣，確保電腦版零變化
const QUALITY_PRESETS = {
    high:   { pixelRatio: 1.5,  minPixelRatio: 1.0,  antialias: true,  grass: 700, outerTrees: 40, shardsNormal: 150, shardsBoss: 500, fogNear: 60, fogFar: 150, maxActiveEnemies: 999, renderFps: 0  },
    medium: { pixelRatio: 1.25, minPixelRatio: 1.0,  antialias: false, grass: 120, outerTrees: 8,  shardsNormal: 30,  shardsBoss: 80,  fogNear: 40, fogFar: 88,  maxActiveEnemies: 4,   renderFps: 45 },
    low:    { pixelRatio: 1.0,  minPixelRatio: 0.85, antialias: false, grass: 60,  outerTrees: 4,  shardsNormal: 15,  shardsBoss: 40,  fogNear: 35, fogFar: 72,  maxActiveEnemies: 3,   renderFps: 30 },
};
const TIER_ORDER = ['high', 'medium', 'low'];

let qualityTier = null;

function guessQualityTier() {
    const forced = qs('quality');
    if (QUALITY_PRESETS[forced]) return forced;
    try {
        const saved = localStorage.getItem(LS_QUALITY);
        if (QUALITY_PRESETS[saved]) return saved;
    } catch (e) {}
    if (inputMode !== 'touch') return 'high';
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;      // Safari 冇呢個 API，預設 4
    return (cores >= 6 && mem >= 4) ? 'medium' : 'low';
}

export function getQualityTier() {
    if (!qualityTier) qualityTier = guessQualityTier();
    return qualityTier;
}

export function getQuality() { return QUALITY_PRESETS[getQualityTier()]; }

export function setQualityTier(tier, remember = true) {
    if (!QUALITY_PRESETS[tier]) return;
    qualityTier = tier;
    if (remember) { try { localStorage.setItem(LS_QUALITY, tier); } catch (e) {} }
}

// 實測跌幀時降一級，下一局生效 (即時換場景太傷，只即時調 pixelRatio)
// 刻意唔寫入 localStorage：偶發卡頓 (其他 App 搶 GPU) 唔應該永久調低畫質，
// 每次重開頁面都重新實測。玩家手動揀嘅畫質先會記住。
export function downgradeQuality() {
    const i = TIER_ORDER.indexOf(getQualityTier());
    if (i < 0 || i >= TIER_ORDER.length - 1) return false;
    setQualityTier(TIER_ORDER[i + 1], false);
    return true;
}
