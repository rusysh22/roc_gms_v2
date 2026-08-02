import { defineConfig, devices } from '@playwright/test'

// AUDIT_UI_UX_CSS P0 roadmap: "Tambah smoke screenshots untuk homepage, login,
// wizard, public event, dan workspace" - assumes the Docker dev stack is
// already running at localhost:3000 (no webServer block: Payload's Local API
// and Postgres/Redis/Mailpit sidecars aren't things Playwright can boot itself).
export default defineConfig({
  testDir: './e2e',
  // Tests hit a single shared Next.js *dev* server (not a production build), whose on-demand
  // per-route compilation serializes anyway - running workers in parallel just makes every test
  // queue behind the same recompiles and time out. One worker is slower but actually reliable.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
