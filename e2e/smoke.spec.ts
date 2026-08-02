import { expect, test } from '@playwright/test'

// AUDIT_UI_UX_CSS P0 roadmap item: basic smoke coverage for homepage, login,
// wizard, and a public event page. These are load-bearing/render checks, not
// full flow tests - they exist to catch "the page 500s" or "the layout is
// broken", not to exercise every interaction.

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@roc-gms.local'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!'
const PUBLIC_EVENT_SLUG = process.env.E2E_PUBLIC_EVENT_SLUG || 'nusantara-grand-games-2026'

test.describe('smoke', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/InTourney/)
  })

  test('login page loads and rejects bad credentials', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /sign in|log in/i })).toBeVisible()

    await page.getByLabel('Email').fill('nobody@example.com')
    await page.getByLabel('Password').fill('wrong-password')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Server returns Payload's own message ("...is incorrect"), not the
    // client-side fallback ("Invalid email or password.") - match both.
    await expect(page.getByText(/email or password/i)).toBeVisible()
  })

  test('login succeeds with seeded admin and reaches workspace', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    // router.push/router.refresh() is a client-side transition, not a full
    // navigation, so it never fires a 'load' event - waitForURL's default
    // waitUntil would hang. Poll the URL directly instead.
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
  })

  test('new-event wizard Setup Assistant loads when authenticated', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })

    await page.goto('/workspaces/event-admin/new-event')
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('public event page loads', async ({ page }) => {
    const response = await page.goto(`/events/${PUBLIC_EVENT_SLUG}`)
    expect(response?.ok()).toBeTruthy()
    await expect(page.locator('body')).not.toContainText('Application error')
  })
})
