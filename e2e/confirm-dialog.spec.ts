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

// Regression test for a real bug: AlertDialogAction's own close-on-click raced against the
// browser's default submit action for a type="submit" form={id} button portalled outside the
// form's DOM subtree - closing (unmounting) could win the race and silently drop the submission.
// This actually clicks Confirm (unlike the test above) because that race is exactly what needs
// covering; shuffling seed order is reversible (re-shuffling fixes it), unlike the destructive
// actions ConfirmDialog is normally used for.
test('destructive action Confirm actually submits the form', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })

  await page.goto(`/workspaces/event-admin/new-event?eventId=${EVENT_ID}&step=draw`)

  await page.getByRole('button', { name: 'Shuffle Seeds' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.request().method() === 'POST'),
    dialog.getByRole('button', { name: 'Shuffle Seeds' }).click(),
  ])
  expect(response.status()).toBeLessThan(400)
  await expect(dialog).toBeHidden()
})
