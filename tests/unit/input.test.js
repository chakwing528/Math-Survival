import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GAME_STATES,
  GameStateMachine,
  InputController,
  TouchControlSurface,
  beginMathChallenge,
  getJoystickState
} from '../../js/input.js';

test('game lifecycle accepts pause, math and resume paths without Pointer Lock knowledge', () => {
  const lifecycle = new GameStateMachine();
  assert.equal(lifecycle.state, GAME_STATES.RESUME_WAIT);

  lifecycle.transition(GAME_STATES.PLAYING);
  lifecycle.transition(GAME_STATES.PAUSED);
  lifecycle.transition(GAME_STATES.PLAYING);
  lifecycle.transition(GAME_STATES.MATH);
  lifecycle.transition(GAME_STATES.RESUME_WAIT);
  lifecycle.transition(GAME_STATES.PLAYING);
  lifecycle.transition(GAME_STATES.OVER);

  assert.equal(lifecycle.state, GAME_STATES.OVER);
});

test('game lifecycle rejects transitions that skip required states', () => {
  const lifecycle = new GameStateMachine();
  assert.throws(
    () => lifecycle.transition(GAME_STATES.MATH),
    /RESUME_WAIT -> MATH/
  );
});

test('math challenge displays before optional Pointer Lock release on iPhone-like controls', () => {
  const lifecycle = new GameStateMachine(GAME_STATES.PLAYING);
  const order = [];
  const controls = {
    isLocked: false,
    unlock() {
      order.push('unlock');
      throw new TypeError('document.exitPointerLock is not a function');
    }
  };

  assert.equal(beginMathChallenge({
    lifecycle,
    controls,
    resetInput: () => order.push('reset'),
    showQuestion: () => order.push('show')
  }), true);
  assert.equal(lifecycle.state, GAME_STATES.MATH);
  assert.deepEqual(order, ['reset', 'show']);
});

test('math challenge ignores a locked Pointer Lock release failure after showing the question', () => {
  const lifecycle = new GameStateMachine(GAME_STATES.PLAYING);
  const order = [];
  const controls = {
    isLocked: true,
    unlock() {
      order.push('unlock');
      throw new TypeError('document.exitPointerLock is not a function');
    }
  };

  assert.doesNotThrow(() => beginMathChallenge({
    lifecycle,
    controls,
    resetInput: () => order.push('reset'),
    showQuestion: () => order.push('show')
  }));
  assert.equal(lifecycle.state, GAME_STATES.MATH);
  assert.deepEqual(order, ['reset', 'show', 'unlock']);
});

test('math challenge rolls back to resume wait when question construction fails', () => {
  const lifecycle = new GameStateMachine(GAME_STATES.PLAYING);
  assert.throws(() => beginMathChallenge({
    lifecycle,
    resetInput: () => {},
    showQuestion: () => { throw new Error('question DOM unavailable'); }
  }), /question DOM unavailable/);
  assert.equal(lifecycle.state, GAME_STATES.RESUME_WAIT);
});

test('input controller maps keyboard and pointer state and resets stuck controls', () => {
  const target = new EventTarget();
  const pointerTarget = new EventTarget();
  const actions = [];
  const input = new InputController({ target, pointerTarget, onAction: action => actions.push(action) });

  input.handleKey({ key: 'w' }, true);
  input.handleKey({ key: 'Shift' }, true);
  input.handleKey({ key: 'r', repeat: false }, true);
  input.handlePointer({ button: 0, pointerType: 'mouse' }, true);
  input.setControl('aim', true); // future touch HUD uses the same public control API
  input.addLookDelta(8, -3);

  assert.deepEqual(input.movement, { w: true, a: false, s: false, d: false });
  assert.equal(input.sprint, true);
  assert.equal(input.fire, true);
  assert.equal(input.aim, true);
  assert.deepEqual(input.consumeLookDelta(), { x: 8, y: -3 });
  assert.deepEqual(actions, ['reload']);

  input.reset();
  assert.deepEqual(input.movement, { w: false, a: false, s: false, d: false });
  assert.equal(input.sprint, false);
  assert.equal(input.fire, false);
  assert.equal(input.aim, false);
});

test('touch pointer gestures do not become accidental fire events', () => {
  const target = new EventTarget();
  const input = new InputController({ target, pointerTarget: target });
  input.handlePointer({ button: 0, pointerType: 'touch' }, true);
  assert.equal(input.fire, false);
});

test('binding is idempotent and dispose removes input listeners', () => {
  const target = new EventTarget();
  const actions = [];
  const input = new InputController({ target, pointerTarget: target, onAction: action => actions.push(action) });
  const reloadEvent = new Event('keydown');
  Object.defineProperties(reloadEvent, {
    key: { value: 'r' },
    repeat: { value: false }
  });

  input.bind();
  input.bind();
  target.dispatchEvent(reloadEvent);
  assert.deepEqual(actions, ['reload']);

  input.dispose();
  target.dispatchEvent(reloadEvent);
  assert.deepEqual(actions, ['reload']);
});

test('virtual joystick clamps displacement and enables forward sprint only near its edge', () => {
  assert.deepEqual(
    getJoystickState(0, -100, 50),
    { x: 0, y: -50, magnitude: 1, forward: true, backward: false, left: false, right: false, sprint: true }
  );
  const diagonal = getJoystickState(40, -40, 60);
  assert.equal(diagonal.forward, true);
  assert.equal(diagonal.right, true);
  assert.equal(diagonal.sprint, true);
  assert.ok(diagonal.magnitude < 1);
  assert.deepEqual(getJoystickState(2, 2, 60), {
    x: 2, y: 2, magnitude: Math.hypot(2, 2) / 60,
    forward: false, backward: false, left: false, right: false, sprint: false
  });
});

class FakeTouchElement extends EventTarget {
  constructor(rect = { left: 40, top: 40, width: 120, height: 120 }) {
    super();
    this.rect = rect;
    this.style = {};
    this.attributes = new Map();
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
      toggle: (value, active) => active ? classes.add(value) : classes.delete(value),
      contains: value => classes.has(value)
    };
  }

  getBoundingClientRect() { return this.rect; }
  setPointerCapture() {}
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
}

function pointerEvent(type, { pointerId, clientX = 0, clientY = 0 }) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY }
  });
  return event;
}

test('touch surface supports simultaneous move, look, fire and independent action buttons', () => {
  const ids = [
    'touch-move-zone', 'touch-move-base', 'touch-move-knob', 'touch-look-zone',
    'btn-touch-fire', 'btn-touch-aim', 'btn-touch-reload', 'btn-touch-melee'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeTouchElement()]));
  const root = { querySelector: selector => elements[selector.slice(1)] };
  const actions = [];
  const input = new InputController({ target: new EventTarget(), pointerTarget: new EventTarget() });
  const surface = new TouchControlSurface({ root, input, onAction: action => actions.push(action) });
  surface.bind();

  elements['touch-move-zone'].dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 40 }));
  elements['touch-look-zone'].dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, clientX: 300, clientY: 200 }));
  elements['touch-look-zone'].dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 330, clientY: 180 }));
  elements['btn-touch-fire'].dispatchEvent(pointerEvent('pointerdown', { pointerId: 3 }));
  elements['btn-touch-aim'].dispatchEvent(pointerEvent('pointerdown', { pointerId: 4 }));
  elements['btn-touch-reload'].dispatchEvent(pointerEvent('pointerdown', { pointerId: 5 }));
  elements['btn-touch-melee'].dispatchEvent(pointerEvent('pointerdown', { pointerId: 6 }));

  assert.equal(input.movement.w, true);
  assert.equal(input.sprint, true);
  assert.equal(input.fire, true);
  assert.equal(input.aim, true);
  assert.deepEqual(input.consumeLookDelta(), { x: 30, y: -20 });
  assert.deepEqual(actions, ['reload', 'melee']);

  elements['touch-move-zone'].dispatchEvent(pointerEvent('pointerup', { pointerId: 1 }));
  assert.deepEqual(input.movement, { w: false, a: false, s: false, d: false });
  assert.equal(input.fire, true);
  elements['btn-touch-fire'].dispatchEvent(pointerEvent('pointerup', { pointerId: 3 }));
  assert.equal(input.fire, false);

  surface.reset();
  assert.equal(input.aim, false);
  assert.equal(elements['btn-touch-aim'].getAttribute('aria-pressed'), 'false');
  surface.dispose();
  elements['btn-touch-reload'].dispatchEvent(pointerEvent('pointerdown', { pointerId: 7 }));
  assert.deepEqual(actions, ['reload', 'melee']);
});
