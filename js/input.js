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

const KEY_CONTROLS = Object.freeze({
    w: 'forward', arrowup: 'forward',
    s: 'backward', arrowdown: 'backward',
    a: 'left', arrowleft: 'left',
    d: 'right', arrowright: 'right',
    shift: 'sprint'
});

const KEY_ACTIONS = Object.freeze({ r: 'reload', v: 'toggle-view', escape: 'pause' });

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
