import { createHmac } from 'crypto'

import { describe, expect, it } from 'vitest'

import {
  eventToEffectiveStatus,
  parseWebhookEvent,
  verifyWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from './webhook'

const SECRET = 'whsec_test'
const sign = (body: string, secret = SECRET) =>
  `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`

describe('verifyWebhookSignature', () => {
  const body = JSON.stringify({ event: 'license.issued', license_key: 'AAAA-BBBB-CCCC' })

  it('accepts a correct signature, with or without the sha256= prefix', () => {
    const hex = createHmac('sha256', SECRET).update(body, 'utf8').digest('hex')
    expect(verifyWebhookSignature(body, `sha256=${hex}`, SECRET)).toBe(true)
    expect(verifyWebhookSignature(body, hex, SECRET)).toBe(true)
    expect(verifyWebhookSignature(body, `SHA256=${hex}`, SECRET)).toBe(true)
  })

  it('rejects a wrong secret, tampered body, or tampered signature', () => {
    expect(verifyWebhookSignature(body, sign(body, 'other'), SECRET)).toBe(false)
    expect(verifyWebhookSignature(body + ' ', sign(body), SECRET)).toBe(false)
    expect(verifyWebhookSignature(body, sign(body).slice(0, -2) + 'ff', SECRET)).toBe(false)
  })

  it('rejects missing / malformed / non-hex header values without throwing', () => {
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false)
    expect(verifyWebhookSignature(body, '', SECRET)).toBe(false)
    expect(verifyWebhookSignature(body, 'sha256=not-hex-zzz', SECRET)).toBe(false)
    expect(verifyWebhookSignature(body, sign(body), '')).toBe(false)
  })

  it('rejects a hex string of the wrong length even if it is valid hex', () => {
    expect(verifyWebhookSignature(body, 'sha256=abcd', SECRET)).toBe(false)
  })

  it('exposes the header name it reads', () => {
    expect(WEBHOOK_SIGNATURE_HEADER).toBe('x-berlanggan-signature')
  })
})

describe('parseWebhookEvent', () => {
  it('parses a full license.issued event and normalizes key + email', () => {
    const parsed = parseWebhookEvent({
      event: 'license.issued',
      order_public_id: 'ord_123',
      customer_email: 'Buyer@Example.com',
      license_key: 'aaaa-bbbb-cccc',
      plan: 'InTourney Pro',
      license_expires_at: '2027-06-01T00:00:00Z',
      entitlements: { MAX_EVENTS: 10 },
      seat_limit: 1,
    })
    expect(parsed).toEqual({
      ok: true,
      event: {
        event: 'license.issued',
        license_key: 'AAAA-BBBB-CCCC',
        customer_email: 'buyer@example.com',
        order_public_id: 'ord_123',
        plan: 'InTourney Pro',
        license_expires_at: '2027-06-01T00:00:00Z',
        entitlements: { MAX_EVENTS: 10 },
        seat_limit: 1,
      },
    })
  })

  it('keeps an explicit null license_expires_at distinct from an absent one', () => {
    const withNull = parseWebhookEvent({
      event: 'subscription.renewed',
      license_key: 'AAAA-BBBB-CCCC',
      license_expires_at: null,
    })
    const without = parseWebhookEvent({ event: 'subscription.renewed', license_key: 'AAAA-BBBB-CCCC' })
    expect(withNull.ok && withNull.event.license_expires_at).toBeNull()
    expect(without.ok && without.event.license_expires_at).toBeUndefined()
  })

  it('requires customer_email only for license.issued', () => {
    expect(parseWebhookEvent({ event: 'license.issued', license_key: 'AAAA-BBBB-CCCC' })).toEqual({
      ok: false,
      reason: 'malformed',
    })
    expect(
      parseWebhookEvent({ event: 'subscription.suspended', license_key: 'AAAA-BBBB-CCCC' }).ok,
    ).toBe(true)
  })

  it('flags an unknown event type separately from a malformed body', () => {
    expect(parseWebhookEvent({ event: 'invoice.paid', license_key: 'AAAA-BBBB-CCCC' })).toEqual({
      ok: false,
      reason: 'unknown_event',
      event: 'invoice.paid',
    })
    expect(parseWebhookEvent({ license_key: 'AAAA-BBBB-CCCC' })).toEqual({ ok: false, reason: 'malformed' })
    expect(parseWebhookEvent('nope')).toEqual({ ok: false, reason: 'malformed' })
    expect(parseWebhookEvent({ event: 'subscription.renewed' })).toEqual({ ok: false, reason: 'malformed' })
  })

  it('drops a non-positive seat_limit rather than storing it', () => {
    const parsed = parseWebhookEvent({
      event: 'license.issued',
      customer_email: 'a@b.com',
      license_key: 'AAAA-BBBB-CCCC',
      seat_limit: 0,
    })
    expect(parsed.ok && parsed.event.seat_limit).toBeUndefined()
  })
})

describe('eventToEffectiveStatus', () => {
  it.each([
    ['subscription.renewed', 'active'],
    ['subscription.suspended', 'suspended'],
    ['subscription.cancelled', 'suspended'],
    ['license.revoked', 'revoked'],
  ] as const)('maps %s to %s', (event, status) => {
    expect(eventToEffectiveStatus(event)).toBe(status)
  })
})
