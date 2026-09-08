import type { Payload } from 'payload'

import { getBerlangganConfig } from './config'
import { validate, type ValidateResult } from './client'
import { effectiveStatusBucket, type StoredLicenseStatus } from './effectiveStatus'

// Lazy/on-demand revalidation window: a license's cached effective_status is trusted as-is for
// this long before the next gated request bothers calling Berlanggan's /v1/validate again. This
// repo has zero scheduling infrastructure (see src/scripts/*.ts - all manual, no cron), so
// re-validation piggybacks on real user traffic instead of a background job. 6h is a starting
// point, not a hard product requirement - tune freely.
const REVALIDATE_AFTER_MS = 6 * 60 * 60 * 1000

export type SubscriptionState =
  | { ok: true; grace: boolean }
  | { ok: false; reason: 'no_license' | 'blocked' }

const isStale = (lastValidatedAt: string | null | undefined) => {
  if (!lastValidatedAt) return true
  return Date.now() - new Date(lastValidatedAt).getTime() > REVALIDATE_AFTER_MS
}

// Narrows a /v1/validate response down to just the fields worth persisting back onto the
// Licenses row. Deliberately ValidateResult-only, not shared with /v1/activate's result type:
// activate's failure statuses ("invalid", "seat_full", ...) aren't valid `effective_status`
// values on the Licenses collection, so mixing the two types here would risk writing one of those
// straight into a select field that doesn't have those options - activateLicenseAction.ts handles
// its own (unambiguous - success there is always literally status "active") field extraction
// separately instead.
const toPersistedFields = (result: ValidateResult) => {
  if (result.status === 'unreachable') return null
  return {
    effective_status: result.status,
    token: result.token,
    token_expires_at: result.token_expires_at,
    license_expires_at: result.license_expires_at,
    entitlements: result.entitlements,
  }
}

/** The one function requireWorkspaceAccess/assertWorkspaceActionAccess call to decide whether a
 * signed-in user may proceed. Returns `{ok: true}` whenever gating should NOT block the request -
 * including the "Berlanggan isn't configured yet" case (see getBerlangganConfig's own docs on why
 * that's deliberate: gating must be inert, not fail-closed, until the operator finishes their own
 * Berlanggan setup). */
export const checkSubscription = async (
  payload: Payload,
  userId: string | number,
): Promise<SubscriptionState> => {
  const config = getBerlangganConfig()
  if (!config) {
    return { ok: true, grace: false }
  }

  const found = await payload.find({
    collection: 'licenses',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { user_id: { equals: userId } },
  })
  const license = found.docs[0]
  if (!license) {
    return { ok: false, reason: 'no_license' }
  }

  let status: StoredLicenseStatus = license.effective_status

  if (isStale(license.last_validated_at) && license.token) {
    const result = await validate(config, license.license_key, license.fingerprint, license.token)
    const persisted = toPersistedFields(result)
    if (persisted) {
      status = persisted.effective_status
      await payload.update({
        collection: 'licenses',
        id: license.id,
        overrideAccess: true,
        data: { ...persisted, last_validated_at: new Date().toISOString() },
      })
    }
    // else: Berlanggan was unreachable - keep trusting the cached status rather than blocking a
    // paying customer because of a transient outage on their end. last_validated_at is left
    // untouched so the very next gated request retries instead of waiting out the full window.
  }

  const bucket = effectiveStatusBucket(status)
  if (bucket === 'blocked') {
    return { ok: false, reason: 'blocked' }
  }
  return { ok: true, grace: bucket === 'grace' }
}
