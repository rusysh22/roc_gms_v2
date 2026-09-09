import { createHmac, timingSafeEqual } from 'crypto'

// Berlanggan (berlanggan.web.id) pushes a signed webhook to InTourney whenever a purchase is paid
// or a subscription's billing state changes, so a customer's Event Management access turns on (and
// its "valid until" date extends on renewal, and off on suspend/revoke) WITHOUT the customer ever
// pasting a license key - the /subscribe key form stays only as a manual fallback. This module is
// the pure half: verifying the HMAC signature and parsing the payload. The effectful half (finding
// the InTourney user, calling /v1/activate, writing the Licenses row) lives in
// src/app/(frontend)/api/berlanggan/webhook/route.ts + src/lib/berlanggan/licenseStore.ts.
//
// Signature scheme mirrors Berlanggan's own inbound-webhook verification (Duitku / Sumopod /
// kirim.chat in that platform's repo): HMAC-SHA256 of the raw request body, hex-encoded, sent as
// `X-Berlanggan-Signature: sha256=<hex>`.

export const WEBHOOK_SIGNATURE_HEADER = 'x-berlanggan-signature'

/** Constant-time check of `X-Berlanggan-Signature` against HMAC-SHA256(rawBody, secret). The
 * `sha256=` prefix is optional on the header value. Returns false (never throws) for any missing/
 * malformed input so the caller can treat every falsy result the same way - a 401. */
export const verifyWebhookSignature = (
  rawBody: string,
  headerValue: string | null | undefined,
  secret: string,
): boolean => {
  if (!secret || !headerValue) return false
  const provided = headerValue.trim().replace(/^sha256=/i, '')
  if (!/^[0-9a-f]+$/i.test(provided)) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const providedBuf = Buffer.from(provided, 'hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  if (providedBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(providedBuf, expectedBuf)
}

// The five events InTourney acts on. Anything else (or a future event type) is accepted with a 200
// and ignored - never a retry-triggering error - see the route handler.
export type BerlangganWebhookEventType =
  | 'license.issued'
  | 'subscription.renewed'
  | 'subscription.suspended'
  | 'subscription.cancelled'
  | 'license.revoked'

type BaseEvent = {
  event: BerlangganWebhookEventType
  license_key: string
  order_public_id?: string
  plan?: string
  license_expires_at?: string | null
  entitlements?: Record<string, unknown>
  seat_limit?: number
}

/** `license.issued` additionally carries the buyer's email - the only link back to an InTourney
 * account (Berlanggan has no InTourney user id). The other events match on `license_key` alone
 * against an already-stored Licenses row, so they don't need it. */
export type LicenseIssuedEvent = BaseEvent & {
  event: 'license.issued'
  customer_email: string
}

export type SubscriptionStateEvent = BaseEvent & {
  event: 'subscription.renewed' | 'subscription.suspended' | 'subscription.cancelled' | 'license.revoked'
  customer_email?: string
}

export type BerlangganWebhookEvent = LicenseIssuedEvent | SubscriptionStateEvent

const KNOWN_EVENTS: BerlangganWebhookEventType[] = [
  'license.issued',
  'subscription.renewed',
  'subscription.suspended',
  'subscription.cancelled',
  'license.revoked',
]

const asString = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

const asPlainObject = (v: unknown): Record<string, unknown> | undefined =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined

export type ParsedWebhook =
  | { ok: true; event: BerlangganWebhookEvent }
  | { ok: false; reason: 'malformed' }
  | { ok: false; reason: 'unknown_event'; event: string }

/** Validates the decoded JSON body into a typed event. `unknown_event` is split out from
 * `malformed` because the route answers the two differently: an unrecognized `event` is a 200
 * (Berlanggan should stop resending), a structurally broken payload is a 400. */
export const parseWebhookEvent = (raw: unknown): ParsedWebhook => {
  const body = asPlainObject(raw)
  if (!body) return { ok: false, reason: 'malformed' }

  const eventName = asString(body.event)
  if (!eventName) return { ok: false, reason: 'malformed' }
  if (!KNOWN_EVENTS.includes(eventName as BerlangganWebhookEventType)) {
    return { ok: false, reason: 'unknown_event', event: eventName }
  }

  const licenseKey = asString(body.license_key)
  if (!licenseKey) return { ok: false, reason: 'malformed' }

  const base: BaseEvent = {
    event: eventName as BerlangganWebhookEventType,
    license_key: licenseKey.toUpperCase(),
    order_public_id: asString(body.order_public_id),
    plan: asString(body.plan),
    // license_expires_at is explicitly nullable: a perpetual (one-time) license reports null and
    // that must overwrite any stale date, so we keep null distinct from "absent".
    license_expires_at:
      body.license_expires_at === null ? null : asString(body.license_expires_at) ?? undefined,
    entitlements: asPlainObject(body.entitlements),
    seat_limit: typeof body.seat_limit === 'number' && body.seat_limit > 0 ? body.seat_limit : undefined,
  }

  if (base.event === 'license.issued') {
    const email = asString(body.customer_email)?.toLowerCase()
    if (!email) return { ok: false, reason: 'malformed' }
    return { ok: true, event: { ...base, event: 'license.issued', customer_email: email } }
  }

  return {
    ok: true,
    event: { ...base, event: base.event, customer_email: asString(body.customer_email)?.toLowerCase() },
  }
}

/** How a Berlanggan billing-state event maps onto the Licenses collection's `effective_status`.
 * `subscription.cancelled` deliberately lands on `suspended`, not a dedicated state: per that
 * platform's own model (docs/26 §A3) a cancel cascades to suspended and keeps the row for audit,
 * and effectiveStatusBucket treats suspended as blocked either way. */
export const eventToEffectiveStatus = (
  event: SubscriptionStateEvent['event'],
): 'active' | 'suspended' | 'revoked' => {
  switch (event) {
    case 'subscription.renewed':
      return 'active'
    case 'license.revoked':
      return 'revoked'
    default:
      return 'suspended'
  }
}
