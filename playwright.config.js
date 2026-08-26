import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // 每個裝置 case 會載入約 19 MB 3D assets；本機同時開 4 個 WebKit/Chromium
  // 容易令 boundingBox 等純 UI 操作因資源競爭 timeout。兩個 worker 保留並行而且穩定。
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /device-gate\.spec\.js/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'iphone-safari',
      testMatch: /device-gate\.spec\.js/,
      use: { ...devices['iPhone 13'] }
    },
    {
      name: 'android-chrome',
      testMatch: /device-gate\.spec\.js/,
      use: { ...devices['Pixel 7'] }
    },
    {
      name: 'ipad-safari',
      testMatch: /device-gate\.spec\.js/,
      use: { ...devices['iPad (gen 7)'] }
    }
  ],
  webServer: {
    command: 'node scripts/serve.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  }
});
