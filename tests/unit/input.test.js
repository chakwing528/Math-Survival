import assert from 'node:assert/strict';
import test from 'node:test';

import { GAME_STATES, GameStateMachine, InputController } from '../../js/input.js';

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
