import { expect, test } from '@playwright/test';

async function isolateExternalServices(page) {
  const observed = { pageErrors: [], badLocalResponses: [], blockedMutations: 0 };

  page.on('pageerror', error => observed.pageErrors.push(error.message));
  page.on('response', response => {
    const url = new URL(response.url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname) && response.status() >= 400) {
      observed.badLocalResponses.push(`${response.status()} ${url.pathname}`);
    }
  });

  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'script.google.com') {
      const action = url.searchParams.get('action');
      if (action === 'addScore') {
        observed.blockedMutations += 1;
        await route.abort('blockedbyclient');
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(action === 'getLeaderboard' ? [] : {})
      });
      return;
    }
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });

  return observed;
}

function expectSafeRun(observed) {
  expect(observed.blockedMutations).toBe(0);
  expect(observed.pageErrors).toEqual([]);
  expect(observed.badLocalResponses).toEqual([]);
}

function boxesOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

test('portrait guard and landscape touch HUD fit the emulated device viewport', async ({ page }) => {
  const observed = await isolateExternalServices(page);
  await page.goto('/?mode=touch');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('body')).toHaveClass(/mode-touch/);
  await expect(page.locator('#rotate-block')).toBeVisible();

  const portrait = page.viewportSize();
  expect(portrait).not.toBeNull();
  await page.setViewportSize({ width: portrait.height, height: portrait.width });
  await expect(page.locator('#rotate-block')).toBeHidden({ timeout: 2_000 });

  await expect(page.locator('#start-menu > .desktop-only')).toHaveCount(2);
  await expect(page.locator('#start-menu > .desktop-only').first()).toBeHidden();
  const menuViewport = page.viewportSize();
  const menuBoxes = await Promise.all(
    ['.game-title', '#login-class', '#login-sid', '#btn-next']
      .map(selector => page.locator(selector).first().boundingBox())
  );
  expect(menuBoxes.every(Boolean)).toBe(true);
  for (const box of menuBoxes) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(menuViewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(menuViewport.height);
  }
  expect(await page.locator('#start-menu').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

  await page.evaluate(() => {
    document.querySelector('#hud').style.display = 'block';
  });

  const viewport = page.viewportSize();
  await expect(page.locator('#btn-touch-aim, #btn-touch-reload, #btn-touch-melee')).toHaveCount(0);
  await expect(page.locator('#hud-bottom-right')).toBeHidden();
  const selectors = ['#touch-move-base', '#btn-touch-pause', '#btn-touch-fire'];
  const boxes = await Promise.all(selectors.map(selector => page.locator(selector).boundingBox()));
  expect(boxes.every(Boolean)).toBe(true);

  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
  for (let i = 1; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) expect(boxesOverlap(boxes[i], boxes[j])).toBe(false);
  }
  expect(boxesOverlap(boxes[0], boxes[1])).toBe(false);
  if (viewport.height <= 500) {
    const hudBoxes = await Promise.all(
      ['#hud-top-right', '#hud-health-wrap']
        .map(selector => page.locator(selector).boundingBox())
    );
    expect(hudBoxes.every(Boolean)).toBe(true);
    for (const actionBox of boxes.slice(1)) {
      for (const hudBox of hudBoxes) expect(boxesOverlap(actionBox, hudBox)).toBe(false);
    }
    expect(boxesOverlap(boxes[0], hudBoxes[1])).toBe(false);
  }
  expectSafeRun(observed);
});

test('touch medium quality preserves readable render scale with a safe adaptive floor', async ({ page }) => {
  const observed = await isolateExternalServices(page);
  await page.goto('/?mode=touch&quality=medium');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 10_000 });
  const quality = await page.evaluate(async () => {
    const device = await import('/js/device.js?quality-gate');
    return device.getQuality();
  });
  expect(quality.pixelRatio).toBe(1.25);
  expect(quality.minPixelRatio).toBe(1.0);
  expect(quality.antialias).toBe(false);
  expect(quality.grass).toBeLessThanOrEqual(120);
  expect(quality.outerTrees).toBeLessThanOrEqual(8);
  expect(quality.maxActiveEnemies).toBe(4);
  expect(quality.renderFps).toBe(45);
  expectSafeRun(observed);
});

test('touch upgrade question displays and resumes without a Pointer Lock API', async ({ page }) => {
  const observed = await isolateExternalServices(page);
  await page.goto('/?mode=touch');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 10_000 });
  const portrait = page.viewportSize();
  await page.setViewportSize({ width: portrait.height, height: portrait.width });
  await expect(page.locator('#rotate-block')).toBeHidden({ timeout: 2_000 });

  await page.evaluate(async () => {
    const [{ showMathQuestion }, { beginMathChallenge, GAME_STATES, GameStateMachine }] = await Promise.all([
      import('/js/math.js?iphone-math-gate'),
      import('/js/input.js?iphone-math-gate')
    ]);
    const lifecycle = new GameStateMachine(GAME_STATES.PLAYING);
    globalThis.__mathGate = { lifecycle, result: null, unlockCalls: 0 };
    beginMathChallenge({
      lifecycle,
      resetInput: () => {},
      controls: {
        isLocked: false,
        unlock() {
          globalThis.__mathGate.unlockCalls += 1;
          throw new TypeError('document.exitPointerLock is not a function');
        }
      },
      showQuestion: () => showMathQuestion({
        type: 'UPGRADE', difficulty: '1', questionsSolved: 0, weaponLevel: -1,
        timeLimitSeconds: 60,
        onResolve: (correct, topic) => {
          lifecycle.transition(GAME_STATES.RESUME_WAIT);
          lifecycle.transition(GAME_STATES.PLAYING);
          globalThis.__mathGate.result = { correct, topic, state: lifecycle.state };
        }
      })
    });
  });

  await expect(page.locator('#math-overlay')).toBeVisible();
  await expect(page.locator('#math-header')).toHaveText('⚡ 武器進化程序 ⚡');
  await expect(page.locator('#math-num-display')).toBeVisible();
  await expect(page.locator('.math-key-btn')).toHaveCount(12);
  expect(await page.evaluate(() => globalThis.__mathGate.unlockCalls)).toBe(0);

  const overlay = await page.locator('#math-overlay').boundingBox();
  const container = await page.locator('#math-container').boundingBox();
  const viewport = page.viewportSize();
  expect(overlay).not.toBeNull();
  expect(container).not.toBeNull();
  expect(container.x).toBeGreaterThanOrEqual(0);
  expect(container.y).toBeGreaterThanOrEqual(0);
  expect(container.x + container.width).toBeLessThanOrEqual(viewport.width);
  expect(container.y + container.height).toBeLessThanOrEqual(viewport.height);
  if (viewport.height <= 500) {
    const questionPane = await page.locator('.math-question-pane').boundingBox();
    const answerPane = await page.locator('.math-answer-pane').boundingBox();
    expect(questionPane).not.toBeNull();
    expect(answerPane).not.toBeNull();
    expect(questionPane.x + questionPane.width).toBeLessThanOrEqual(answerPane.x);
    expect(Math.abs(questionPane.y - answerPane.y)).toBeLessThanOrEqual(1);
  }

  await page.getByRole('button', { name: '-', exact: true }).click();
  await page.getByRole('button', { name: '確定', exact: true }).click();
  await expect(page.getByRole('button', { name: '明白了，繼續戰鬥 ▶', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '明白了，繼續戰鬥 ▶', exact: true }).click();
  await expect(page.locator('#math-overlay')).toBeHidden();
  expect(await page.evaluate(() => globalThis.__mathGate.result)).toEqual({
    correct: false, topic: 'arithmetic', state: 'PLAYING'
  });
  expectSafeRun(observed);
});

test('multi-pointer controls reset cleanly and autoplay rejection remains retryable', async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__mediaGate = { playCalls: 0, pauseCalls: 0 };
    HTMLMediaElement.prototype.play = function play() {
      globalThis.__mediaGate.playCalls += 1;
      return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
    };
    HTMLMediaElement.prototype.pause = function pause() {
      globalThis.__mediaGate.pauseCalls += 1;
    };
  });
  const observed = await isolateExternalServices(page);
  await page.goto('/?mode=touch');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 10_000 });
  const portrait = page.viewportSize();
  await page.setViewportSize({ width: portrait.height, height: portrait.width });
  await expect(page.locator('#rotate-block')).toBeHidden({ timeout: 2_000 });

  await page.locator('#login-class').fill('TEST');
  await page.locator('#login-sid').fill('00');
  await page.locator('#btn-next').click();
  await expect(page.locator('#diff-selection')).toBeVisible();
  await expect.poll(() => page.evaluate(() => globalThis.__mediaGate.playCalls)).toBe(1);

  await page.locator('#btn-back-login').click();
  await page.locator('#btn-next').click();
  await expect.poll(() => page.evaluate(() => globalThis.__mediaGate.playCalls)).toBe(2);

  await page.evaluate(async () => {
    document.querySelector('#hud').style.display = 'block';
    const { InputController, TouchControlSurface } = await import('/js/input.js?device-gate');
    const actions = [];
    const input = new InputController({ target: document, pointerTarget: document.querySelector('#game-container') });
    const surface = new TouchControlSurface({ root: document, input, onAction: action => actions.push(action) });
    surface.bind();
    globalThis.__deviceGate = { input, surface, actions };
  });

  const base = await page.locator('#touch-move-base').boundingBox();
  const centerX = base.x + base.width / 2;
  const centerY = base.y + base.height / 2;
  await page.locator('#touch-move-zone').dispatchEvent('pointerdown', {
    pointerId: 31, clientX: centerX, clientY: centerY - base.height / 2
  });
  await page.locator('#touch-look-zone').dispatchEvent('pointerdown', { pointerId: 32, clientX: 300, clientY: 180 });
  await page.locator('#touch-look-zone').dispatchEvent('pointermove', { pointerId: 32, clientX: 326, clientY: 164 });
  await page.locator('#btn-touch-fire').dispatchEvent('pointerdown', { pointerId: 33 });

  expect(await page.evaluate(() => ({
    movement: globalThis.__deviceGate.input.movement,
    sprint: globalThis.__deviceGate.input.sprint,
    fire: globalThis.__deviceGate.input.fire,
    aim: globalThis.__deviceGate.input.aim,
    look: globalThis.__deviceGate.input.consumeLookDelta()
  }))).toEqual({
    movement: { w: true, a: false, s: false, d: false },
    sprint: true,
    fire: true,
    aim: false,
    look: { x: 26, y: -16 }
  });

  const resetState = await page.evaluate(() => {
    globalThis.__deviceGate.surface.reset();
    return {
      movement: globalThis.__deviceGate.input.movement,
      sprint: globalThis.__deviceGate.input.sprint,
      fire: globalThis.__deviceGate.input.fire,
      aim: globalThis.__deviceGate.input.aim,
      look: globalThis.__deviceGate.input.consumeLookDelta(),
      removedActions: document.querySelectorAll('#btn-touch-aim, #btn-touch-reload, #btn-touch-melee').length
    };
  });
  expect(resetState).toEqual({
    movement: { w: false, a: false, s: false, d: false },
    sprint: false,
    fire: false,
    aim: false,
    look: { x: 0, y: 0 },
    removedActions: 0
  });

  await page.evaluate(() => globalThis.__deviceGate.surface.dispose());
  expectSafeRun(observed);
});

test('touch game over settlement survives an unavailable Pointer Lock API', async ({ page }) => {
  const observed = await isolateExternalServices(page);
  await page.goto('/?mode=touch');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 10_000 });
  const portrait = page.viewportSize();
  await page.setViewportSize({ width: portrait.height, height: portrait.width });

  await page.evaluate(async () => {
    const { finishGameSessionSafely } = await import('/js/input.js?iphone-settlement-gate');
    globalThis.__settlementGate = { unlockCalls: 0, completeCalls: 0 };
    finishGameSessionSafely({
      controls: {
        isLocked: true,
        unlock() {
          globalThis.__settlementGate.unlockCalls += 1;
          throw new TypeError('document.exitPointerLock is not a function');
        }
      },
      onComplete: () => {
        globalThis.__settlementGate.completeCalls += 1;
        document.querySelector('#hud').style.display = 'none';
        document.querySelector('#go-title').textContent = '你已陣亡';
        document.querySelector('#go-detail').textContent = '擊殺數: 0 / 5　總得分: 0 分';
        document.querySelector('#gameover-overlay').style.display = 'flex';
      }
    });
  });

  await expect(page.locator('#gameover-overlay')).toBeVisible();
  await expect(page.locator('#go-title')).toHaveText('你已陣亡');
  await expect(page.locator('#btn-submit-score')).toBeVisible();
  await expect(page.locator('#btn-play-again')).toBeVisible();
  await expect(page.locator('#btn-go-menu')).toBeVisible();
  expect(await page.evaluate(() => globalThis.__settlementGate)).toEqual({ unlockCalls: 1, completeCalls: 1 });
  expectSafeRun(observed);
});
