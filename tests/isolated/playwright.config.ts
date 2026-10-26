import { defineConfig } from '/work/node_modules/@playwright/test/index.mjs'
const reports = process.env.PLAYWRIGHT_REPORT_DIR || '/reports/manual'
export default defineConfig({
  testDir: '/checks/e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: reports + '/test-results',
  reporter: [['list'], ['html', { outputFolder: reports + '/html', open: 'never' }], ['junit', { outputFile: reports + '/junit.xml' }]],
  use: { baseURL: process.env.BASE_URL || 'http://frontend-app:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure', browserName: 'chromium' },
})
