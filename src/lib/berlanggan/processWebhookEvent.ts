import type { Payload } from 'payload'

import type { BerlangganConfig } from './config'
import { activateAndStoreLicense } from './licenseStore'
import { eventToEffectiveStatus, type BerlangganWebhookEvent } from './webhook'

// The effectful half of the Berlanggan webhook: turn one verified, parsed event into Licenses /
// PendingLicenses writes. Pure-ish - takes an explicit Payload + config, no request/env access -
// so the route handler stays a thin HTTP shell and this is what a test or a replay tool calls.
//
// Every branch is idempotent: Berlanggan retries a webhook until it gets a 2xx, and all writes
// here are upserts keyed by user_id / email / license_key, or plain status sets. Replaying the
// same event changes nothing.

export type ProcessResult =
  | { outcome: 'activated'; deferred: boolean }
  | { outcome: 'pending' } // stored for a not-yet-registered account
  | { outcome: 'status_updated' }
  | { outcome: 'rejected'; reason: string }
  | { outcome: 'ignored' } // nothing on our side matched - safe to ack

const findUserByEmail = async (payload: Payload, email: string) => {
  // Emails are lowercased on every account-creation path (SSO in googleSsoSession.ts, registration
  // in registrationActions.ts). The webhook lowercases customer_email in parseWebhookEvent, so an
  // exact match is correct here.
  const found = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { email: { equals: email } },
  })
  return found.docs[0]
}

const findLicenseByKey = async (payload: Payload, licenseKey: string) => {
  const found = await payload.find({
    collection: 'licenses',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { license_key: { equals: licenseKey } },
  })
  return found.docs[0]
}

const findPendingByEmail = async (payload: Payload, email: string) => {
  const found = await payload.find({
    collection: 'pending-licenses',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { email: { equals: email } },
  })
  return found.docs[0]
}

const upsertPending = async (payload: Payload, email: string, event: BerlangganWebhookEvent) => {
  const data = {
    license_key: event.license_key,
    license_expires_at: event.license_expires_at ?? null,
    entitlements: event.entitlements ?? {},
    seat_limit: event.seat_limit ?? null,
    plan: event.plan ?? null,
    order_public_id: event.order_public_id ?? null,
    last_event: event.event,
  }
  const existing = await findPendingByEmail(payload, email)
  if (existing) {
    await payload.update({ collection: 'pending-licenses', id: existing.id, overrideAccess: true, data })
  } else {
    await payload.create({ collection: 'pending-licenses', overrideAccess: true, data: { email, ...data } })
  }
}

const deletePendingByEmail = async (payload: Payload, email: string) => {
  await payload.delete({
    collection: 'pending-licenses',
    overrideAccess: true,
    where: { email: { equals: email } },
  })
}

export const processWebhookEvent = async (
  payload: Payload,
  config: BerlangganConfig,
  event: BerlangganWebhookEvent,
): Promise<ProcessResult> => {
  if (event.event === 'license.issued') {
    const user = await findUserByEmail(payload, event.customer_email)
    if (!user) {
      await upsertPending(payload, event.customer_email, event)
      return { outcome: 'pending' }
    }

    const result = await activateAndStoreLicense(payload, {
      config,
      userId: user.id,
      licenseKey: event.license_key,
      trusted: { license_expires_at: event.license_expires_at, entitlements: event.entitlements },
    })
    // The account now owns this license (or Berlanggan explicitly rejected it) - either way a
    // pending row for this email is stale.
    await deletePendingByEmail(payload, event.customer_email)

    if (result.ok) return { outcome: 'activated', deferred: result.deferred }
    return { outcome: 'rejected', reason: result.reason }
  }

  // subscription.renewed | subscription.suspended | subscription.cancelled | license.revoked
  const status = eventToEffectiveStatus(event.event)
  const license = await findLicenseByKey(payload, event.license_key)

  if (license) {
    const data: Record<string, unknown> = { effective_status: status }
    if (event.event === 'subscription.renewed') {
      if (event.license_expires_at !== undefined) data.license_expires_at = event.license_expires_at
      if (event.entitlements) data.entitlements = event.entitlements
      data.last_error = null
    }
    await payload.update({ collection: 'licenses', id: license.id, overrideAccess: true, data })
    return { outcome: 'status_updated' }
  }

  // No activated row yet - if the buyer still hasn't signed up, keep the pending row's facts
  // current so the eventual claim activates with the right expiry, not a stale one.
  if (event.customer_email) {
    const pending = await findPendingByEmail(payload, event.customer_email)
    if (pending && pending.license_key === event.license_key) {
      if (event.event === 'subscription.renewed') {
        await upsertPending(payload, event.customer_email, event)
        return { outcome: 'status_updated' }
      }
      // Suspended/cancelled/revoked before the account ever existed: drop the pending grant.
      await deletePendingByEmail(payload, event.customer_email)
      return { outcome: 'status_updated' }
    }
  }

  return { outcome: 'ignored' }
}
