import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// AUDIT_UI_UX_CSS P1 item 9 / A11Y-18: no automated accessibility check existed anywhere -
// regressions (a missing label, a button losing its accessible name) only surfaced from manual
// audit passes like the one that produced AUDIT_UI_UX_CSS_ROC_GMS_V2.md. These assert zero
// serious/critical violations on the app's critical-journey pages; moderate/minor findings are
// logged but don't fail the run, since clearing every one of those is the audit's own longer P1/P2
// backlog, not something a single CI gate should block on.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@roc-gms.local'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!'
const PUBLIC_EVENT_SLUG = process.env.E2E_PUBLIC_EVENT_SLUG || 'nusantara-grand-games-2026'

async function assertNoSeriousViolations(page: import('@playwright/test').Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  if (results.violations.length > 0) {
    console.log(
      `[axe:${label}] ${results.violations.length} violation(s), ${serious.length} serious/critical:`,
      results.violations.map((v) => `${v.id} (${v.impact})`).join(', '),
    )
  }
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
}

test('homepage has no serious a11y violations', async ({ page }) => {
  await page.goto('/')
  await assertNoSeriousViolations(page, 'homepage')
})

test('login page has no serious a11y violations', async ({ page }) => {
  await page.goto('/login')
  await assertNoSeriousViolations(page, 'login')
})

test('public event page has no serious a11y violations', async ({ page }) => {
  await page.goto(`/events/${PUBLIC_EVENT_SLUG}`)
  await assertNoSeriousViolations(page, 'public-event')
})

test('new-event wizard has no serious a11y violations', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })

  await page.goto('/workspaces/event-admin/new-event')
  await assertNoSeriousViolations(page, 'new-event-wizard')
})

test('schedule page (My Schedule favorites) has no serious a11y violations', async ({ page }) => {
  await page.goto(`/events/${PUBLIC_EVENT_SLUG}/schedule`)
  await assertNoSeriousViolations(page, 'schedule')
})

test('venue display page has no serious a11y violations', async ({ page }) => {
  await page.goto(`/events/${PUBLIC_EVENT_SLUG}/display`)
  await assertNoSeriousViolations(page, 'venue-display')
})

test('event details page (readiness checklist) has no serious a11y violations', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })

  await page.goto('/workspaces/event-admin/details')
  await assertNoSeriousViolations(page, 'event-details')
})

test('sponsors admin page has no serious a11y violations', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })

  await page.goto('/workspaces/event-admin/sponsors')
  await assertNoSeriousViolations(page, 'sponsors-admin')
})

test('clubs admin page (copy participants dialog) has no serious a11y violations', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })

  await page.goto('/workspaces/event-admin/clubs')
  await assertNoSeriousViolations(page, 'clubs-admin')
})

test('command center has no serious a11y violations', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })

  await page.goto('/workspaces/command-center')
  await assertNoSeriousViolations(page, 'command-center')
})

test('matches review queue page has no serious a11y violations', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })

  await page.goto('/workspaces/matches')
  await assertNoSeriousViolations(page, 'matches-list')
})
