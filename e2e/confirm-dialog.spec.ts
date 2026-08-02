import { expect, test } from '@playwright/test'

// AUDIT_UI_UX_CSS ADM-13: regression coverage for ConfirmSubmitButton's rewrite from
// window.confirm() to a real ConfirmDialog. Only exercises Cancel (never Confirm) - Confirm would
// actually run the destructive action (shuffling seed order) against shared seed data that other
// tests/manual QA rely on staying stable.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@roc-gms.local'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!'
const EVENT_ID = process.env.E2E_EVENT_ID || '9'

test('destructive action opens a real alertdialog and Cancel closes it without submitting', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })

  await page.goto(`/workspaces/event-admin/new-event?eventId=${EVENT_ID}&step=draw`)

  const trigger = page.getByRole('button', { name: 'Shuffle Seeds' })
  await expect(trigger).toBeVisible()
  await trigger.click()

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Shuffle seed order')

  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  // Still on the same page - Cancel didn't submit the form.
  await expect(page.getByRole('button', { name: 'Shuffle Seeds' })).toBeVisible()
})
