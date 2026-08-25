import { expect, test } from '@playwright/test';

const stagingUrl = String(process.env.SUPABASE_URL ?? '');
const stagingKey = String(process.env.SUPABASE_PUBLISHABLE_KEY ?? '');
const stagingHost = stagingUrl ? new URL(stagingUrl).hostname : '';
const hasStagingConfig = stagingHost.endsWith('.supabase.co') && stagingKey.startsWith('sb_publishable_');

test.skip(!hasStagingConfig, 'Hosted staging credentials were not supplied');

async function isolateStaging(page) {
  const observed = { gasRequests: [], supabasePaths: [], blockedHosts: new Set(), pageErrors: [] };
  page.on('pageerror', error => observed.pageErrors.push(error.message));

  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'script.google.com') {
      observed.gasRequests.push(url.pathname);
      await route.abort('blockedbyclient');
      return;
    }
    if (url.hostname === stagingHost) {
      observed.supabasePaths.push(url.pathname);
      await route.continue();
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

for (const client of [
  { name: '3D', path: '/', list: '#menu-lb-list' },
  { name: '2D', path: '/classic-2d.html', list: '#leaderboard-list' }
]) {
  test(`${client.name} client reads hosted Supabase staging without GAS fallback`, async ({ page }) => {
    const observed = await isolateStaging(page);
    await page.goto(client.path);
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 10_000 });
    await expect.poll(() => observed.supabasePaths.some(path => path.includes('/game_config_versions'))).toBe(true);

    if (client.name === '2D') await page.evaluate(() => globalThis.fetchLeaderboard());
    await expect.poll(() => observed.supabasePaths.some(path => path.includes('/get_leaderboard_v1'))).toBe(true);
    await expect(page.locator(client.list)).toContainText('測同學');

    expect(await page.evaluate(() => globalThis.MathSurvivalCloud.PROVIDER)).toBe('supabase');
    expect(observed.gasRequests).toEqual([]);
    expect(observed.pageErrors).toEqual([]);
  });
}
