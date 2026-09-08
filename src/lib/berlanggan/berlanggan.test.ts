import { afterEach, describe, expect, it, vi } from 'vitest'

import { activate, deactivate, fetchPlans, validate } from './client'
import { effectiveStatusBucket, mostRestrictiveStatus, type BerlangganStatus } from './effectiveStatus'
import { deriveFingerprint } from './fingerprint'

const pricingConfig = { baseUrl: 'https://berlanggan.web.id', productSlug: 'intourney' }
const fullConfig = { ...pricingConfig, activationSecret: 'secret', pepper: 'pepper' }

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, json: async () => body }) as Response

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('deriveFingerprint', () => {
  it('is deterministic for the same user id and pepper', () => {
    expect(deriveFingerprint(42, 'pepper')).toBe(deriveFingerprint(42, 'pepper'))
  })

  it('differs across users and peppers', () => {
    expect(deriveFingerprint(42, 'pepper')).not.toBe(deriveFingerprint(43, 'pepper'))
    expect(deriveFingerprint(42, 'pepper')).not.toBe(deriveFingerprint(42, 'other-pepper'))
  })
})

describe('effectiveStatusBucket', () => {
  it.each([
    ['active', 'active'],
    ['grace', 'grace'],
    ['expired', 'blocked'],
    ['revoked', 'blocked'],
    ['suspended', 'blocked'],
    ['not_activated', 'blocked'],
  ] as const)('maps %s to %s', (status, bucket) => {
    expect(effectiveStatusBucket(status)).toBe(bucket)
  })
})

describe('mostRestrictiveStatus', () => {
  it('picks the most restrictive status out of a mixed set', () => {
    expect(mostRestrictiveStatus(['active', 'grace', 'suspended'])).toBe('suspended')
    expect(mostRestrictiveStatus(['active', 'grace'])).toBe('grace')
    expect(mostRestrictiveStatus(['active'])).toBe('active')
  })

  it('returns null for an empty list', () => {
    expect(mostRestrictiveStatus([])).toBeNull()
  })

  it('revoked always wins over everything else', () => {
    const all: BerlangganStatus[] = ['active', 'grace', 'expired', 'revoked', 'suspended']
    expect(mostRestrictiveStatus(all)).toBe('revoked')
  })
})

describe('fetchPlans', () => {
  it('returns plans on a successful response', async () => {
    const plans = [
      {
        id: 1,
        name: 'Pro',
        price: 99000,
        interval: 'monthly' as const,
        seat_limit: 1,
        sort_order: 0,
        entitlements: {},
        checkout_url: '/checkout/1/',
      },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(plans)))
    const result = await fetchPlans(pricingConfig)
    expect(result).toEqual({ ok: true, plans })
    expect(fetch).toHaveBeenCalledWith(
      'https://berlanggan.web.id/v1/catalog/products/intourney/plans',
      undefined,
    )
  })

  it('reports unreachable on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false)))
    const result = await fetchPlans(pricingConfig)
    expect(result).toEqual({ ok: false, error: 'unreachable' })
  })

  it('reports unreachable on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const result = await fetchPlans(pricingConfig)
    expect(result).toEqual({ ok: false, error: 'unreachable' })
  })
})

describe('activate', () => {
  it('sends the license key + fingerprint with the secret header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'active', token: 't', token_expires_at: 'x' }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await activate(fullConfig, 'XXXX-XXXX-XXXX', 'fp')
    expect(result).toEqual({ status: 'active', token: 't', token_expires_at: 'x' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://berlanggan.web.id/v1/activate')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'X-Berlanggan-Secret': 'secret' })
    expect(JSON.parse(init.body)).toEqual({ license_key: 'XXXX-XXXX-XXXX', fingerprint: 'fp' })
  })

  it('surfaces a failure status from the response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'seat_full', message: 'no seats' })))
    const result = await activate(fullConfig, 'XXXX-XXXX-XXXX', 'fp')
    expect(result).toEqual({ status: 'seat_full', message: 'no seats' })
  })

  it('reports unreachable on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
    const result = await activate(fullConfig, 'XXXX-XXXX-XXXX', 'fp')
    expect(result).toEqual({ status: 'unreachable' })
  })
})

describe('validate', () => {
  it('returns the heartbeat status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'grace', token: 't2' })))
    const result = await validate(fullConfig, 'XXXX-XXXX-XXXX', 'fp', 'old-token')
    expect(result).toEqual({ status: 'grace', token: 't2' })
  })
})

describe('deactivate', () => {
  it('returns deactivated on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'deactivated' })))
    const result = await deactivate(fullConfig, 'XXXX-XXXX-XXXX', 'fp')
    expect(result).toEqual({ status: 'deactivated' })
  })
})
