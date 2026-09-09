import type { Payload } from 'payload'

import { activate, type ActivateResult } from './client'
import type { BerlangganConfig } from './config'
import { deriveFingerprint } from './fingerprint'

// The shared "call POST /v1/activate, then write the Licenses row" step. Three call sites need the
// exact same behaviour and it must not drift between them:
//   - activateLicenseAction.ts  - the manual "paste your key" fallback form on /subscribe
//   - api/berlanggan/webhook    - Berlanggan's signed `license.issued` push (the primary path)
//   - claimPendingLicense.ts    - a `license.issued` that arrived before the user had signed up,
//                                 replayed on their first gated request
//
// One InTourney account == one Berlanggan seat; the fingerprint is derived from the account id
// (see fingerprint.ts), not a real device.

export type ActivateAndStoreResult =
  | { ok: true; deferred: false }
  // deferred: Berlanggan's /v1/activate was unreachable, but the caller supplied trusted (signed-
  // webhook) license facts, so the row was written as active from those and the seat registration
  // will be retried on the next gated request (see backfillSeatRegistration).
  | { ok: true; deferred: true }
  | { ok: false; reason: 'invalid' | 'expired' | 'seat_full' | 'revoked' | 'suspended' | 'unreachable' }

type TrustedLicenseFacts = {
  license_expires_at?: string | null
  entitlements?: Record<string, unknown>
}

// The subset of Licenses fields the write paths here ever set. The status trio (license_key /
// fingerprint / effective_status) is always present so a create is valid; the rest are optional so
// an update can touch just a few.
type LicenseRowData = {
  license_key: string
  fingerprint: string
  effective_status: 'active' | 'grace' | 'expired' | 'revoked' | 'suspended' | 'not_activated'
  token?: string | null
  token_expires_at?: string | null
  license_expires_at?: string | null
  entitlements?: Record<string, unknown>
  last_validated_at?: string | null
  last_error?: string | null
}

const findLicenseRow = async (payload: Payload, userId: string | number) => {
  const found = await payload.find({
    collection: 'licenses',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { user_id: { equals: userId } },
  })
  return found.docs[0]
}

/** Upsert the single Licenses row for a user (unique on user_id). */
export const upsertLicenseRow = async (
  payload: Payload,
  userId: string | number,
  data: LicenseRowData,
) => {
  const existing = await findLicenseRow(payload, userId)
  if (existing) {
    await payload.update({ collection: 'licenses', id: existing.id, overrideAccess: true, data })
  } else {
    await payload.create({
      collection: 'licenses',
      overrideAccess: true,
      // user_id widened to string|number for callers (checkSubscription) that carry it that way;
      // the DB column is the users PK either way.
      data: { user_id: userId as number, ...data },
    })
  }
}

const recordRejection = async (
  payload: Payload,
  userId: string | number,
  licenseKey: string,
  fingerprint: string,
  result: Exclude<ActivateResult, { status: 'active' } | { status: 'unreachable' }>,
) => {
  // Persist the rejection so a "my key doesn't work" support conversation can see what Berlanggan
  // actually said, and so the /subscribe status card shows the real state rather than a blank.
  // "invalid" and "seat_full" aren't valid effective_status values (and aren't a lasting property
  // of the license anyway) - they collapse to not_activated, with the specifics kept in last_error.
  const status =
    result.status === 'expired' || result.status === 'revoked' || result.status === 'suspended'
      ? result.status
      : ('not_activated' as const)
  await upsertLicenseRow(payload, userId, {
    license_key: licenseKey,
    fingerprint,
    effective_status: status,
    last_error: result.message || result.status,
  })
}

/**
 * Register the account's seat with Berlanggan and store the resulting license state.
 *
 * `trusted` is supplied only by the webhook path: when it's present and /v1/activate can't be
 * reached, the row is still written as active from those signed facts (returns `deferred: true`)
 * instead of failing - a paid customer must not be gated out by a transient outage on Berlanggan's
 * side. Without `trusted` (the manual form), an unreachable activate is a plain failure the user
 * retries.
 */
export const activateAndStoreLicense = async (
  payload: Payload,
  args: {
    config: BerlangganConfig
    userId: string | number
    licenseKey: string
    trusted?: TrustedLicenseFacts
  },
): Promise<ActivateAndStoreResult> => {
  const { config, userId, licenseKey, trusted } = args
  const fingerprint = deriveFingerprint(userId, config.pepper)
  const result = await activate(config, licenseKey, fingerprint)

  if (result.status === 'active') {
    await upsertLicenseRow(payload, userId, {
      license_key: licenseKey,
      fingerprint,
      token: result.token,
      token_expires_at: result.token_expires_at,
      license_expires_at: result.license_expires_at ?? trusted?.license_expires_at ?? null,
      effective_status: 'active',
      entitlements: result.entitlements ?? trusted?.entitlements ?? {},
      last_validated_at: new Date().toISOString(),
      last_error: null,
    })
    return { ok: true, deferred: false }
  }

  if (result.status === 'unreachable') {
    if (!trusted) return { ok: false, reason: 'unreachable' }
    await upsertLicenseRow(payload, userId, {
      license_key: licenseKey,
      fingerprint,
      token: null,
      license_expires_at: trusted.license_expires_at ?? null,
      effective_status: 'active',
      entitlements: trusted.entitlements ?? {},
      last_validated_at: null,
      last_error: 'seat registration deferred: Berlanggan unreachable when the webhook arrived',
    })
    return { ok: true, deferred: true }
  }

  await recordRejection(payload, userId, licenseKey, fingerprint, result)
  return { ok: false, reason: result.status }
}

/** Best-effort retry of the seat registration for a row that was written `deferred` (activate was
 * unreachable at webhook time, so it has no token). Called from checkSubscription. Silent on
 * failure - the row stays trusted-active until Berlanggan says otherwise. */
export const backfillSeatRegistration = async (
  payload: Payload,
  config: BerlangganConfig,
  license: { id: string | number; user_id: string | number | { id: string | number }; license_key: string },
): Promise<void> => {
  const userId = typeof license.user_id === 'object' ? license.user_id.id : license.user_id
  const fingerprint = deriveFingerprint(userId, config.pepper)
  const result = await activate(config, license.license_key, fingerprint)
  if (result.status !== 'active') {
    // Stamp last_validated_at even on failure so checkSubscription's staleness guard throttles the
    // next retry instead of hammering activate() on every request during an outage.
    await payload.update({
      collection: 'licenses',
      id: license.id,
      overrideAccess: true,
      data: { last_validated_at: new Date().toISOString() },
    })
    return
  }
  await payload.update({
    collection: 'licenses',
    id: license.id,
    overrideAccess: true,
    data: {
      fingerprint,
      token: result.token,
      token_expires_at: result.token_expires_at,
      license_expires_at: result.license_expires_at ?? undefined,
      entitlements: result.entitlements ?? undefined,
      last_validated_at: new Date().toISOString(),
      last_error: null,
    },
  })
}
