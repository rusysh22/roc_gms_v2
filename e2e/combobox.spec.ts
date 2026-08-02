import { expect, test } from '@playwright/test'

// AUDIT_UI_UX_CSS FORM-10/11/12: regression coverage for the SearchableSelect rewrite - it must
// expose real combobox/listbox semantics and be fully operable by keyboard (no mouse).
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@roc-gms.local'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!'
const EVENT_ID = process.env.E2E_EVENT_ID || '9'

test('SearchableSelect is keyboard-operable and exposes combobox semantics', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })

  await page.goto(`/workspaces/event-admin/new-event?eventId=${EVENT_ID}&step=draw`)
  await page.waitForLoadState('networkidle')

  const combobox = page.getByRole('combobox').first()
  await expect(combobox).toBeVisible()
  await expect(combobox).toHaveAttribute('aria-expanded', 'false')

  await combobox.click()
  await expect(combobox).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('listbox').first()).toBeVisible()

  await combobox.press('ArrowDown')
  const activeDescendant = await combobox.getAttribute('aria-activedescendant')
  expect(activeDescendant).toBeTruthy()
  await expect(page.locator(`#${activeDescendant}`)).toHaveAttribute('role', 'option')

  await combobox.press('Enter')
  await expect(combobox).toHaveAttribute('aria-expanded', 'false')
  await expect(combobox).not.toHaveValue('')

  await combobox.press('Escape')
  await combobox.press('ArrowDown')
  await combobox.press('ArrowDown')
  const secondActive = await combobox.getAttribute('aria-activedescendant')
  expect(secondActive).toBeTruthy()
})
