import { expect, test } from '@playwright/test';

async function isolateExternalServices(page) {
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
        body: action === 'getLeaderboard' ? '[]' : '{}'
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
  await expect(page.locator('#version-tag')).toHaveText('Math Survival FPS V3.3');

  await page.locator('#login-class').fill('TEST');
  await page.locator('#login-sid').fill('00');
  await page.locator('#btn-next').click();

  await expect(page.locator('#login-selection')).toBeHidden();
  await expect(page.locator('#diff-selection')).toBeVisible();
  await expect(page.locator('.diff-btn[data-level]')).toHaveCount(5);
  expect(observed.gasActions).toContain('getGameData');
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
