import { expect, test } from '@playwright/test'

// AUDIT_UI_UX_CSS P1 item 9 / section 16 "Snapshot wajib": no visual regression coverage existed
// - a global CSS change could silently break any page's layout with nothing catching it before a
// human eyeballed it. These are intentionally coarse (full-page, generous diff threshold) - the
// goal is catching "the layout broke" (missing styles, a component rendering raw/unstyled,
// unexpected horizontal overflow), not pixel-perfect design QA.
const PUBLIC_EVENT_SLUG = process.env.E2E_PUBLIC_EVENT_SLUG || 'nusantara-grand-games-2026'

test.describe('visual snapshots', () => {
  test('homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveScreenshot('homepage.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  })

  test('login', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveScreenshot('login.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  })

  test('public event page', async ({ page }) => {
    await page.goto(`/events/${PUBLIC_EVENT_SLUG}`)
    await expect(page).toHaveScreenshot('public-event.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  })
})
