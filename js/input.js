// ==============================================================================
// 共用輸入狀態及遊戲 lifecycle。DOM 事件只更新狀態；Game 決定動作效果。
// ==============================================================================

export const GAME_STATES = Object.freeze({
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    MATH: 'MATH',
    RESUME_WAIT: 'RESUME_WAIT',
    OVER: 'OVER'
});

const ALLOWED_TRANSITIONS = Object.freeze({
    [GAME_STATES.RESUME_WAIT]: new Set([GAME_STATES.PLAYING, GAME_STATES.PAUSED, GAME_STATES.OVER]),
    [GAME_STATES.PLAYING]: new Set([GAME_STATES.PAUSED, GAME_STATES.MATH, GAME_STATES.OVER]),
    [GAME_STATES.PAUSED]: new Set([GAME_STATES.PLAYING, GAME_STATES.OVER]),
    [GAME_STATES.MATH]: new Set([GAME_STATES.RESUME_WAIT, GAME_STATES.OVER]),
    [GAME_STATES.OVER]: new Set()
});

export class GameStateMachine {
    constructor(initialState = GAME_STATES.RESUME_WAIT) {
        if (!ALLOWED_TRANSITIONS[initialState]) throw new Error(`Unknown game state: ${initialState}`);
        this.state = initialState;
    }

    canTransition(nextState) {
        return this.state === nextState || ALLOWED_TRANSITIONS[this.state].has(nextState);
    }

    transition(nextState) {
        if (!this.canTransition(nextState)) {
            throw new Error(`Invalid game state transition: ${this.state} -> ${nextState}`);
        }
        this.state = nextState;
        return this.state;
    }
}

// Pointer Lock 唔係 touch gameplay 的必要條件。iPhone Safari 沒有
// document.exitPointerLock()；只可在確實 locked 時嘗試解鎖，而且失敗
// 不得阻止數學題 UI 顯示。
export function releasePointerLockSafely(controls) {
    if (!controls || !controls.isLocked || typeof controls.unlock !== 'function') return false;
    try {
        controls.unlock();
        return true;
    } catch (error) {
        return false;
    }
}

// 數學題進場次序是 lifecycle invariant：先停止輸入、同步顯示題目，
// 最後才處理可選的 desktop Pointer Lock。題目建立失敗時回到可恢復狀態。
export function beginMathChallenge({ lifecycle, resetInput, showQuestion, controls }) {
    lifecycle.transition(GAME_STATES.MATH);
    if (typeof resetInput === 'function') resetInput();
    try {
        showQuestion();
    } catch (error) {
        lifecycle.transition(GAME_STATES.RESUME_WAIT);
        throw error;
    }
    releasePointerLockSafely(controls);
    return true;
}

const KEY_CONTROLS = Object.freeze({
    w: 'forward', arrowup: 'forward',
    s: 'backward', arrowdown: 'backward',
    a: 'left', arrowleft: 'left',
    d: 'right', arrowright: 'right',
    shift: 'sprint'
});

const KEY_ACTIONS = Object.freeze({ r: 'reload', v: 'toggle-view', escape: 'pause' });

export function getJoystickState(dx, dy, radius = 60) {
    const safeRadius = Math.max(1, Number(radius) || 1);
    const distance = Math.hypot(dx, dy);
    const magnitude = Math.min(1, distance / safeRadius);
    const scale = distance > safeRadius ? safeRadius / distance : 1;
    const x = dx * scale;
    const y = dy * scale;
    const threshold = 0.18;
    const nx = x / safeRadius;
    const ny = y / safeRadius;
    return {
        x, y, magnitude,
        forward: ny < -threshold,
        backward: ny > threshold,
        left: nx < -threshold,
        right: nx > threshold,
        sprint: magnitude > 0.86 && ny < -0.35
    };
}

export class InputController {
    constructor({ target = document, pointerTarget = target, onAction = () => {} } = {}) {
        this.target = target;
        this.pointerTarget = pointerTarget;
        this.onAction = onAction;
        this.movement = { w: false, a: false, s: false, d: false };
        this.sprint = false;
        this.fire = false;
        this.aim = false;
        this.look = { x: 0, y: 0 };
        this.bound = false;

        this._onKeyDown = event => this.handleKey(event, true);
        this._onKeyUp = event => this.handleKey(event, false);
        this._onPointerDown = event => this.handlePointer(event, true);
        this._onPointerUp = event => this.handlePointer(event, false);
        this._onPointerCancel = () => this.resetTransient();
        this._onBlur = () => this.reset();
    }

    handleKey(event, pressed) {
        const key = String(event.key || '').toLowerCase();
        const control = KEY_CONTROLS[key];
        if (control) {
            this.setControl(control, pressed);
            return;
        }
        const action = KEY_ACTIONS[key];
        if (pressed && !event.repeat && action) this.onAction(action, event);
    }

    handlePointer(event, pressed) {
        if (event.pointerType === 'touch') return;
        if (event.button === 0) this.fire = pressed;
        if (event.button === 2) this.aim = pressed;
    }

    setControl(control, active) {
        const value = Boolean(active);
        if (control === 'forward') this.movement.w = value;
        else if (control === 'backward') this.movement.s = value;
        else if (control === 'left') this.movement.a = value;
        else if (control === 'right') this.movement.d = value;
        else if (control === 'sprint') this.sprint = value;
        else if (control === 'fire') this.fire = value;
        else if (control === 'aim') this.aim = value;
        else throw new Error(`Unknown input control: ${control}`);
    }

    addLookDelta(x, y) {
        this.look.x += Number.isFinite(x) ? x : 0;
        this.look.y += Number.isFinite(y) ? y : 0;
    }

    consumeLookDelta() {
        const delta = { ...this.look };
        this.look.x = 0;
        this.look.y = 0;
        return delta;
    }

    resetTransient() {
        this.fire = false;
        this.aim = false;
    }

    reset() {
        Object.keys(this.movement).forEach(key => { this.movement[key] = false; });
        this.sprint = false;
        this.resetTransient();
        this.consumeLookDelta();
    }

    bind() {
        if (this.bound) return;
        this.bound = true;
        this.target.addEventListener('keydown', this._onKeyDown);
        this.target.addEventListener('keyup', this._onKeyUp);
        this.pointerTarget.addEventListener('pointerdown', this._onPointerDown);
        this.pointerTarget.addEventListener('pointerup', this._onPointerUp);
        this.pointerTarget.addEventListener('pointercancel', this._onPointerCancel);
        globalThis.addEventListener?.('blur', this._onBlur);
    }

    dispose() {
        if (!this.bound) return;
        this.bound = false;
        this.target.removeEventListener('keydown', this._onKeyDown);
        this.target.removeEventListener('keyup', this._onKeyUp);
        this.pointerTarget.removeEventListener('pointerdown', this._onPointerDown);
        this.pointerTarget.removeEventListener('pointerup', this._onPointerUp);
        this.pointerTarget.removeEventListener('pointercancel', this._onPointerCancel);
        globalThis.removeEventListener?.('blur', this._onBlur);
        this.reset();
    }
}

export class TouchControlSurface {
    constructor({ root = document, input, onAction = () => {} } = {}) {
        if (!input) throw new Error('TouchControlSurface requires an InputController');
        this.root = root;
        this.input = input;
        this.onAction = onAction;
        this.bound = false;
        this.movePointer = null;
        this.lookPointer = null;
        this.firePointer = null;
        this.aimLatched = false;
        this.listeners = [];

        const get = id => root.querySelector(`#${id}`);
        this.moveZone = get('touch-move-zone');
        this.moveBase = get('touch-move-base');
        this.moveKnob = get('touch-move-knob');
        this.lookZone = get('touch-look-zone');
        this.fireButton = get('btn-touch-fire');
        this.aimButton = get('btn-touch-aim');
        this.reloadButton = get('btn-touch-reload');
        this.meleeButton = get('btn-touch-melee');
        if (![this.moveZone, this.moveBase, this.moveKnob, this.lookZone, this.fireButton,
            this.aimButton, this.reloadButton, this.meleeButton].every(Boolean)) {
            throw new Error('Touch control DOM is incomplete');
        }

        this._onMoveDown = event => this._startMove(event);
        this._onMove = event => this._move(event);
        this._onMoveEnd = event => this._endMove(event);
        this._onLookDown = event => this._startLook(event);
        this._onLookMove = event => this._look(event);
        this._onLookEnd = event => this._endLook(event);
        this._onFireDown = event => this._startFire(event);
        this._onFireEnd = event => this._endFire(event);
        this._onAim = event => {
            event.preventDefault();
            this.aimLatched = !this.aimLatched;
            this.input.setControl('aim', this.aimLatched);
            this.aimButton.classList.toggle('active', this.aimLatched);
            this.aimButton.setAttribute('aria-pressed', String(this.aimLatched));
        };
        this._onReload = event => { event.preventDefault(); this.onAction('reload', event); };
        this._onMelee = event => { event.preventDefault(); this.onAction('melee', event); };
    }

    _listen(target, type, handler) {
        target.addEventListener(type, handler, { passive: false });
        this.listeners.push([target, type, handler]);
    }

    bind() {
        if (this.bound) return;
        this.bound = true;
        this._listen(this.moveZone, 'pointerdown', this._onMoveDown);
        this._listen(this.moveZone, 'pointermove', this._onMove);
        this._listen(this.moveZone, 'pointerup', this._onMoveEnd);
        this._listen(this.moveZone, 'pointercancel', this._onMoveEnd);
        this._listen(this.lookZone, 'pointerdown', this._onLookDown);
        this._listen(this.lookZone, 'pointermove', this._onLookMove);
        this._listen(this.lookZone, 'pointerup', this._onLookEnd);
        this._listen(this.lookZone, 'pointercancel', this._onLookEnd);
        this._listen(this.fireButton, 'pointerdown', this._onFireDown);
        this._listen(this.fireButton, 'pointerup', this._onFireEnd);
        this._listen(this.fireButton, 'pointercancel', this._onFireEnd);
        this._listen(this.aimButton, 'pointerdown', this._onAim);
        this._listen(this.reloadButton, 'pointerdown', this._onReload);
        this._listen(this.meleeButton, 'pointerdown', this._onMelee);
    }

    _capture(target, pointerId) {
        try { target.setPointerCapture(pointerId); } catch (error) {}
    }

    _startMove(event) {
        if (this.movePointer !== null) return;
        event.preventDefault();
        this.movePointer = event.pointerId;
        this._capture(this.moveZone, event.pointerId);
        this._applyMove(event);
    }

    _move(event) {
        if (event.pointerId !== this.movePointer) return;
        event.preventDefault();
        this._applyMove(event);
    }

    _applyMove(event) {
        const rect = this.moveBase.getBoundingClientRect();
        const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
        const state = getJoystickState(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2), radius);
        this.moveKnob.style.transform = `translate(${state.x}px, ${state.y}px)`;
        this.input.setControl('forward', state.forward);
        this.input.setControl('backward', state.backward);
        this.input.setControl('left', state.left);
        this.input.setControl('right', state.right);
        this.input.setControl('sprint', state.sprint);
    }

    _endMove(event) {
        if (event.pointerId !== this.movePointer) return;
        event.preventDefault();
        this.movePointer = null;
        this._resetMovement();
    }

    _resetMovement() {
        this.moveKnob.style.transform = 'translate(0px, 0px)';
        for (const control of ['forward', 'backward', 'left', 'right', 'sprint']) {
            this.input.setControl(control, false);
        }
    }

    _startLook(event) {
        if (this.lookPointer !== null) return;
        event.preventDefault();
        this.lookPointer = event.pointerId;
        this.lastLook = { x: event.clientX, y: event.clientY };
        this._capture(this.lookZone, event.pointerId);
    }

    _look(event) {
        if (event.pointerId !== this.lookPointer) return;
        event.preventDefault();
        const dx = event.clientX - this.lastLook.x;
        const dy = event.clientY - this.lastLook.y;
        this.lastLook = { x: event.clientX, y: event.clientY };
        this.input.addLookDelta(dx, dy);
    }

    _endLook(event) {
        if (event.pointerId !== this.lookPointer) return;
        event.preventDefault();
        this.lookPointer = null;
        this.lastLook = null;
    }

    _startFire(event) {
        if (this.firePointer !== null) return;
        event.preventDefault();
        this.firePointer = event.pointerId;
        this._capture(this.fireButton, event.pointerId);
        this.input.setControl('fire', true);
        this.fireButton.classList.add('active');
    }

    _endFire(event) {
        if (event.pointerId !== this.firePointer) return;
        event.preventDefault();
        this.firePointer = null;
        this.input.setControl('fire', false);
        this.fireButton.classList.remove('active');
    }

    reset() {
        this.movePointer = null;
        this.lookPointer = null;
        this.firePointer = null;
        this.lastLook = null;
        this.aimLatched = false;
        this._resetMovement();
        this.input.setControl('fire', false);
        this.input.setControl('aim', false);
        this.fireButton.classList.remove('active');
        this.aimButton.classList.remove('active');
        this.aimButton.setAttribute('aria-pressed', 'false');
    }

    dispose() {
        if (!this.bound) return;
        this.bound = false;
        for (const [target, type, handler] of this.listeners) target.removeEventListener(type, handler);
        this.listeners = [];
        this.reset();
    }
}
