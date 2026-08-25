import { expect, test } from '@playwright/test';

async function isolateExternalServices(page, gasResponses = {}) {
  const observed = { gasActions: [], blockedHosts: new Set(), pageErrors: [], badLocalResponses: [] };

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
      const action = url.searchParams.get('action') || 'unknown';
      observed.gasActions.push(action);
      if (action === 'addScore') {
        await route.abort('blockedbyclient');
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(gasResponses[action] ?? (action === 'getLeaderboard' ? [] : {}))
      });
      return;
    }

    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      observed.blockedHosts.add(url.hostname);
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });

  return observed;
}

function expectSafeRun(observed) {
  expect(observed.gasActions).not.toContain('addScore');
  expect(observed.pageErrors).toEqual([]);
  expect(observed.badLocalResponses).toEqual([]);
}

test('3D client boots and reaches difficulty selection without production services', async ({ page }) => {
  const observed = await isolateExternalServices(page);

  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('#start-menu')).toBeVisible();
  await expect(page.locator('#version-tag')).toHaveText('Math Survival FPS V3.7');

  await page.locator('#login-class').fill('TEST');
  await page.locator('#login-sid').fill('00');
  await page.locator('#btn-next').click();

  await expect(page.locator('#login-selection')).toBeHidden();
  await expect(page.locator('#diff-selection')).toBeVisible();
  await expect(page.locator('.diff-btn[data-level]')).toHaveCount(5);
  expect(observed.gasActions).toContain('getGameData');
  expectSafeRun(observed);
});

test('3D forced-touch HUD maps simultaneous joystick, look and combat pointers', async ({ page }) => {
  const observed = await isolateExternalServices(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/?mode=touch');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('body')).toHaveClass(/mode-touch/);

  await page.evaluate(async () => {
    document.querySelector('#hud').style.display = 'block';
    const { InputController, TouchControlSurface } = await import('/js/input.js?smoke-touch');
    const actions = [];
    const input = new InputController({ target: document, pointerTarget: document.querySelector('#game-container') });
    const surface = new TouchControlSurface({ root: document, input, onAction: action => actions.push(action) });
    surface.bind();
    globalThis.__touchSmoke = { input, surface, actions };
  });

  await expect(page.locator('#touch-controls')).toBeVisible();
  await expect(page.locator('#btn-touch-fire')).toBeVisible();
  const actionBoxes = await Promise.all(
    ['#btn-touch-aim', '#btn-touch-reload', '#btn-touch-fire', '#btn-touch-melee']
      .map(selector => page.locator(selector).boundingBox())
  );
  expect(actionBoxes.every(Boolean)).toBe(true);
  for (let i = 0; i < actionBoxes.length; i++) {
    const a = actionBoxes[i];
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.x + a.width).toBeLessThanOrEqual(844);
    expect(a.y + a.height).toBeLessThanOrEqual(390);
    for (let j = i + 1; j < actionBoxes.length; j++) {
      const b = actionBoxes[j];
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x
        && a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlaps).toBe(false);
    }
  }
  const base = await page.locator('#touch-move-base').boundingBox();
  expect(base).not.toBeNull();
  const centerX = base.x + base.width / 2;
  const centerY = base.y + base.height / 2;

  await page.locator('#touch-move-zone').dispatchEvent('pointerdown', { pointerId: 11, clientX: centerX, clientY: centerY - base.height / 2 });
  await page.locator('#touch-look-zone').dispatchEvent('pointerdown', { pointerId: 12, clientX: 500, clientY: 220 });
  await page.locator('#touch-look-zone').dispatchEvent('pointermove', { pointerId: 12, clientX: 535, clientY: 195 });
  await page.locator('#btn-touch-fire').dispatchEvent('pointerdown', { pointerId: 13 });
  await page.locator('#btn-touch-aim').dispatchEvent('pointerdown', { pointerId: 14 });
  await page.locator('#btn-touch-reload').dispatchEvent('pointerdown', { pointerId: 15 });
  await page.locator('#btn-touch-melee').dispatchEvent('pointerdown', { pointerId: 16 });

  const state = await page.evaluate(() => ({
    movement: globalThis.__touchSmoke.input.movement,
    sprint: globalThis.__touchSmoke.input.sprint,
    fire: globalThis.__touchSmoke.input.fire,
    aim: globalThis.__touchSmoke.input.aim,
    look: globalThis.__touchSmoke.input.consumeLookDelta(),
    actions: globalThis.__touchSmoke.actions
  }));
  expect(state).toEqual({
    movement: { w: true, a: false, s: false, d: false },
    sprint: true,
    fire: true,
    aim: true,
    look: { x: 35, y: -25 },
    actions: ['reload', 'melee']
  });

  await page.locator('#touch-move-zone').dispatchEvent('pointerup', { pointerId: 11, clientX: centerX, clientY: centerY });
  await page.locator('#btn-touch-fire').dispatchEvent('pointerup', { pointerId: 13 });
  await page.evaluate(() => globalThis.__touchSmoke.surface.dispose());
  expectSafeRun(observed);
});

test('2D client boots and enters canvas gameplay without production services', async ({ page }) => {
  const observed = await isolateExternalServices(page);

  await page.goto('/classic-2d.html');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('#start-menu')).toBeVisible();

  await page.locator('#login-class').fill('TEST');
  await page.locator('#login-sid').fill('00');
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.locator('#diff-selection')).toBeVisible();

  await page.locator('#diff-selection .diff-btn').first().click();
  await expect(page.locator('#start-menu')).toBeHidden();
  await expect(page.locator('#gameCanvas')).toBeVisible();
  await expect(page.locator('#ui-container')).toBeVisible();
  expect(observed.gasActions).toContain('getGameData');
  expectSafeRun(observed);
});

for (const client of [
  { name: '3D', path: '/', list: '#menu-lb-list' },
  { name: '2D', path: '/classic-2d.html', list: '#leaderboard-list' }
]) {
  test(`${client.name} leaderboard renders malicious remote fields as inert text`, async ({ page }) => {
    const payload = '<img id="xss-proof" src=x onerror="window.__xss=1">';
    const observed = await isolateExternalServices(page, {
      getLeaderboard: [{ cls: payload, sid: '01', name: payload, score: 12, diff: '程度 1' }]
    });

    await page.goto(client.path);
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 10_000 });
    if (client.name === '2D') await page.evaluate(() => globalThis.fetchLeaderboard());
    await expect(page.locator(client.list)).toContainText('<IMG');
    await expect(page.locator('#xss-proof')).toHaveCount(0);
    expect(await page.evaluate(() => globalThis.__xss)).toBeUndefined();
    expectSafeRun(observed);
  });
}

test('2D score submission coalesces duplicate clicks and remains production-isolated', async ({ page }) => {
  const observed = await isolateExternalServices(page);
  await page.goto('/classic-2d.html');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 10_000 });
  await page.locator('#login-class').fill('TEST');
  await page.locator('#login-sid').fill('00');

  await page.evaluate(() => Promise.all([globalThis.submitScore(), globalThis.submitScore()]));
  expect(observed.gasActions.filter(action => action === 'addScore')).toHaveLength(1);
  expectSafeRun({ ...observed, gasActions: observed.gasActions.filter(action => action !== 'addScore') });
});
