// ==============================================================================
// 音效管理：BGM 自動播放處理 / 音效播放 / 音量控制 / 分頁切換自動暫停
// ==============================================================================

let audioInitialized = false;
let sfxVolume = 1.0;

const SFX_IDS = ['shootSfx', 'reloadSfx', 'emptyAmmoSfx'];

export function initAudio() {
    if (audioInitialized) return;

    let bgm = document.getElementById('bgm');
    if (bgm) {
        bgm.volume = 0.4;
        bgm.loop = true;
        let playPromise = bgm.play();
        if (playPromise !== undefined) {
            playPromise.then(() => { audioInitialized = true; })
                .catch(() => { audioInitialized = false; });
        } else {
            audioInitialized = true;
        }
    }

    SFX_IDS.forEach(id => {
        let el = document.getElementById(id);
        if (el) { el.volume = sfxVolume; el.load(); }
    });
}

export function playSfx(id) {
    let el = document.getElementById(id);
    if (el) {
        el.volume = sfxVolume;
        el.currentTime = 0;
        el.play().catch(() => {});
    }
}

export function stopSfx(id) {
    let el = document.getElementById(id);
    if (el && !el.paused) { el.pause(); el.currentTime = 0; }
}

export function setBgmVolume(v) {
    let bgm = document.getElementById('bgm');
    if (bgm) bgm.volume = v;
}

export function setSfxVolume(v) {
    sfxVolume = v;
    SFX_IDS.forEach(id => {
        let el = document.getElementById(id);
        if (el) el.volume = v;
    });
}

// ==============================================================================
// WebAudio 合成音效 (喪屍叫聲 / 答題提示 / 心跳 / 勝利，零音檔)
// ==============================================================================

let actx = null;
function ctx() {
    if (!actx) {
        try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
}

// 基本音符：freq 起始頻率，slideTo 滑向頻率，type 波形
function tone({ freq = 440, slideTo = null, type = 'sine', dur = 0.15, vol = 0.1, delay = 0 }) {
    const c = ctx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol * sfxVolume, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
}

// 噪音爆發 (攻擊 / 撕咬聲)
function noiseBurst({ dur = 0.2, vol = 0.12, delay = 0, lowpass = 800 }) {
    const c = ctx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol * sfxVolume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t0);
}

// 喪屍低吼 (音量隨距離；vol01 = 0-1)
export function sfxZombieGrowl(vol01) {
    const v = Math.max(0.02, Math.min(1, vol01)) * 0.14;
    const base = 70 + Math.random() * 50;
    tone({ freq: base, slideTo: base * 0.7, type: 'sawtooth', dur: 0.5 + Math.random() * 0.4, vol: v });
    tone({ freq: base * 1.5, slideTo: base, type: 'triangle', dur: 0.4, vol: v * 0.5, delay: 0.08 });
}

// 喪屍攻擊 (撕咬)
export function sfxZombieAttack() {
    noiseBurst({ dur: 0.18, vol: 0.16, lowpass: 1200 });
    tone({ freq: 160, slideTo: 90, type: 'sawtooth', dur: 0.22, vol: 0.12 });
}

// 喪屍死亡 (下滑呻吟)
export function sfxZombieDeath() {
    tone({ freq: 140, slideTo: 45, type: 'sawtooth', dur: 0.7, vol: 0.13 });
    noiseBurst({ dur: 0.3, vol: 0.06, lowpass: 500, delay: 0.1 });
}

// 喪屍王出場咆哮
export function sfxBossRoar() {
    tone({ freq: 60, slideTo: 110, type: 'sawtooth', dur: 0.9, vol: 0.22 });
    tone({ freq: 90, slideTo: 50, type: 'square', dur: 1.1, vol: 0.1, delay: 0.15 });
    noiseBurst({ dur: 0.8, vol: 0.1, lowpass: 400, delay: 0.1 });
}

// 答啱 (上升雙音)
export function sfxCorrect() {
    tone({ freq: 660, type: 'sine', dur: 0.12, vol: 0.14 });
    tone({ freq: 880, type: 'sine', dur: 0.2, vol: 0.14, delay: 0.11 });
}

// 答錯 (低沉嗡聲)
export function sfxWrong() {
    tone({ freq: 220, slideTo: 130, type: 'square', dur: 0.35, vol: 0.1 });
}

// 武器升級 (上升琶音)
export function sfxLevelUp() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.14, vol: 0.13, delay: i * 0.08 }));
}

// 平底鑊揮擊 (空揮風聲)
export function sfxPanSwing() {
    noiseBurst({ dur: 0.12, vol: 0.06, lowpass: 2500 });
}

// 平底鑊命中 (金屬「鏘」聲，PUBG 經典)
export function sfxPanClang() {
    tone({ freq: 1250, slideTo: 900, type: 'square', dur: 0.18, vol: 0.14 });
    tone({ freq: 2200, slideTo: 1600, type: 'triangle', dur: 0.25, vol: 0.08 });
    noiseBurst({ dur: 0.08, vol: 0.08, lowpass: 4000 });
}

// 低血心跳
export function sfxHeartbeat() {
    tone({ freq: 55, slideTo: 40, type: 'sine', dur: 0.12, vol: 0.25 });
    tone({ freq: 50, slideTo: 38, type: 'sine', dur: 0.1, vol: 0.18, delay: 0.16 });
}

// 勝利小調
export function sfxVictory() {
    const notes = [523, 523, 523, 659, 784, 659, 784, 1047];
    notes.forEach((f, i) => tone({ freq: f, type: 'triangle', dur: i === notes.length - 1 ? 0.5 : 0.16, vol: 0.14, delay: i * 0.14 }));
}

// 切換分頁時自動暫停所有音訊
document.addEventListener("visibilitychange", () => {
    let audios = ['bgm', ...SFX_IDS];
    if (document.hidden) {
        audios.forEach(id => {
            let el = document.getElementById(id);
            if (el) el.pause();
        });
    } else if (audioInitialized) {
        let bgm = document.getElementById('bgm');
        if (bgm) { bgm.loop = true; bgm.play().catch(() => {}); }
    }
});
