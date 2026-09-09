import type { Payload } from 'payload'

import type { BerlangganConfig } from './config'
import { activateAndStoreLicense } from './licenseStore'

// Drains a PendingLicenses row onto the now-known account. A Berlanggan `license.issued` webhook is
// keyed by checkout email; when that email had no InTourney user yet, processWebhookEvent parked
// the license in pending-licenses. This runs from checkSubscription on the user's next gated
// request - by which point they've signed up / signed in - and turns that parked grant into a real
// activated Licenses row.

/** Returns true if, after this call, the user should have a usable Licenses row (activated, or a
 * recorded rejection to show on /subscribe). False means "nothing to claim" or "try again later"
 * (Berlanggan was unreachable) - the caller then falls through to its normal no-license handling. */
export const claimPendingLicense = async (
  payload: Payload,
  config: BerlangganConfig,
  user: { id: string | number; email?: string | null },
): Promise<boolean> => {
  const email = user.email?.toLowerCase().trim()
  if (!email) return false

  const found = await payload.find({
    collection: 'pending-licenses',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { email: { equals: email } },
  })
  const pending = found.docs[0]
  if (!pending) return false

  const result = await activateAndStoreLicense(payload, {
    config,
    userId: user.id,
    licenseKey: pending.license_key,
    trusted: {
      license_expires_at: pending.license_expires_at ?? null,
      entitlements:
        pending.entitlements && typeof pending.entitlements === 'object' && !Array.isArray(pending.entitlements)
          ? (pending.entitlements as Record<string, unknown>)
          : undefined,
    },
  })

  // Unreachable with a trusted payload still writes a (deferred) active row, so result.ok is true
  // there too - only a hard, non-transient failure path leaves result.ok false, and that only
  // happens when `trusted` is absent, which it isn't here. Keep the guard anyway for clarity.
  if (!result.ok) return false

  await payload.delete({
    collection: 'pending-licenses',
    id: pending.id,
    overrideAccess: true,
  })
  return true
}
