import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BerlangganConfig } from './config'

// activate() is the only network call under processWebhookEvent - stub it per test.
const activateMock = vi.fn()
vi.mock('./client', () => ({ activate: (...args: unknown[]) => activateMock(...args) }))

const { processWebhookEvent } = await import('./processWebhookEvent')
const { parseWebhookEvent } = await import('./webhook')

const config: BerlangganConfig = {
  baseUrl: 'https://berlanggan.web.id',
  productSlug: 'intourney',
  activationSecret: 'secret',
  pepper: 'pepper',
}

// ── Minimal in-memory Payload double ─────────────────────────────────────────
type Doc = Record<string, unknown> & { id: number }

const makeFakePayload = (seed: Partial<Record<string, Doc[]>> = {}) => {
  const store: Record<string, Doc[]> = {
    users: [],
    licenses: [],
    'pending-licenses': [],
    ...seed,
  }
  let nextId = 100

  const matches = (doc: Doc, where: Record<string, { equals: unknown }> | undefined) =>
    !where || Object.entries(where).every(([field, cond]) => doc[field] === cond.equals)

  return {
    store,
    find: async ({ collection, where }: { collection: string; where?: Record<string, { equals: unknown }> }) => ({
      docs: (store[collection] ?? []).filter((d) => matches(d, where)),
    }),
    findByID: async ({ collection, id }: { collection: string; id: number }) =>
      (store[collection] ?? []).find((d) => d.id === id) ?? null,
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      const doc = { id: nextId++, ...data } as Doc
      store[collection] = [...(store[collection] ?? []), doc]
      return doc
    },
    update: async ({ collection, id, data }: { collection: string; id: number; data: Record<string, unknown> }) => {
      const list = store[collection] ?? []
      const idx = list.findIndex((d) => d.id === id)
      list[idx] = { ...list[idx], ...data }
      return list[idx]
    },
    delete: async ({
      collection,
      id,
      where,
    }: {
      collection: string
      id?: number
      where?: Record<string, { equals: unknown }>
    }) => {
      const before = store[collection] ?? []
      store[collection] = before.filter((d) => (id != null ? d.id !== id : !matches(d, where)))
      return { docs: [], errors: [] }
    },
  }
}

const parsed = (raw: unknown) => {
  const p = parseWebhookEvent(raw)
  if (!p.ok) throw new Error(`bad fixture: ${p.reason}`)
  return p.event
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (payload: any, raw: unknown) => processWebhookEvent(payload, config, parsed(raw))

beforeEach(() => {
  activateMock.mockReset()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('processWebhookEvent — license.issued', () => {
  const issued = {
    event: 'license.issued',
    customer_email: 'buyer@example.com',
    license_key: 'AAAA-BBBB-CCCC',
    license_expires_at: '2027-06-01T00:00:00Z',
    entitlements: { MAX_EVENTS: 5 },
  }

  it('activates the matching user and writes a Licenses row', async () => {
    activateMock.mockResolvedValue({
      status: 'active',
      token: 'tok',
      token_expires_at: '2026-09-17T00:00:00Z',
      license_expires_at: '2027-06-01T00:00:00Z',
      entitlements: { MAX_EVENTS: 5 },
    })
    const payload = makeFakePayload({ users: [{ id: 1, email: 'buyer@example.com' }] })

    const result = await run(payload, issued)

    expect(result).toEqual({ outcome: 'activated', deferred: false })
    const row = payload.store.licenses[0]
    expect(row).toMatchObject({
      user_id: 1,
      license_key: 'AAAA-BBBB-CCCC',
      token: 'tok',
      effective_status: 'active',
      license_expires_at: '2027-06-01T00:00:00Z',
    })
  })

  it('parks the license as pending when no user has that email yet', async () => {
    const payload = makeFakePayload({ users: [{ id: 1, email: 'someone-else@example.com' }] })

    const result = await run(payload, issued)

    expect(result).toEqual({ outcome: 'pending' })
    expect(activateMock).not.toHaveBeenCalled()
    expect(payload.store['pending-licenses'][0]).toMatchObject({
      email: 'buyer@example.com',
      license_key: 'AAAA-BBBB-CCCC',
      license_expires_at: '2027-06-01T00:00:00Z',
      last_event: 'license.issued',
    })
  })

  it('still writes a (deferred) active row when Berlanggan /v1/activate is unreachable', async () => {
    activateMock.mockResolvedValue({ status: 'unreachable' })
    const payload = makeFakePayload({ users: [{ id: 1, email: 'buyer@example.com' }] })

    const result = await run(payload, issued)

    expect(result).toEqual({ outcome: 'activated', deferred: true })
    expect(payload.store.licenses[0]).toMatchObject({
      effective_status: 'active',
      token: null,
      license_expires_at: '2027-06-01T00:00:00Z',
    })
  })

  it('clears a stale pending row for the same email once the account is activated', async () => {
    activateMock.mockResolvedValue({ status: 'active', token: 't', token_expires_at: 'x' })
    const payload = makeFakePayload({
      users: [{ id: 1, email: 'buyer@example.com' }],
      'pending-licenses': [{ id: 9, email: 'buyer@example.com', license_key: 'OLD1-OLD1-OLD1' }],
    })

    await run(payload, issued)

    expect(payload.store['pending-licenses']).toHaveLength(0)
  })

  it('records a rejection (no seat) without throwing', async () => {
    activateMock.mockResolvedValue({ status: 'seat_full', message: 'no seats' })
    const payload = makeFakePayload({ users: [{ id: 1, email: 'buyer@example.com' }] })

    const result = await run(payload, issued)

    expect(result).toEqual({ outcome: 'rejected', reason: 'seat_full' })
    expect(payload.store.licenses[0]).toMatchObject({
      effective_status: 'not_activated',
      last_error: 'no seats',
    })
  })
})

describe('processWebhookEvent — subscription/license state', () => {
  const withLicense = () =>
    makeFakePayload({
      licenses: [
        {
          id: 5,
          user_id: 1,
          license_key: 'AAAA-BBBB-CCCC',
          fingerprint: 'fp',
          token: 'tok',
          effective_status: 'active',
          license_expires_at: '2026-06-01T00:00:00Z',
        },
      ],
    })

  it('extends the valid-until date on subscription.renewed', async () => {
    const payload = withLicense()
    const result = await run(payload, {
      event: 'subscription.renewed',
      license_key: 'AAAA-BBBB-CCCC',
      license_expires_at: '2027-06-01T00:00:00Z',
    })
    expect(result).toEqual({ outcome: 'status_updated' })
    expect(payload.store.licenses[0]).toMatchObject({
      effective_status: 'active',
      license_expires_at: '2027-06-01T00:00:00Z',
      last_error: null,
    })
  })

  it('blocks access on subscription.suspended and subscription.cancelled', async () => {
    for (const event of ['subscription.suspended', 'subscription.cancelled']) {
      const payload = withLicense()
      await run(payload, { event, license_key: 'AAAA-BBBB-CCCC' })
      expect(payload.store.licenses[0].effective_status).toBe('suspended')
    }
  })

  it('marks the row revoked on license.revoked', async () => {
    const payload = withLicense()
    await run(payload, { event: 'license.revoked', license_key: 'AAAA-BBBB-CCCC' })
    expect(payload.store.licenses[0].effective_status).toBe('revoked')
  })

  it('ignores a state event for a license nothing here knows about', async () => {
    const payload = makeFakePayload()
    const result = await run(payload, { event: 'subscription.suspended', license_key: 'ZZZZ-ZZZZ-ZZZZ' })
    expect(result).toEqual({ outcome: 'ignored' })
  })

  it('keeps a pending row current when renewal lands before the account exists', async () => {
    const payload = makeFakePayload({
      'pending-licenses': [
        { id: 9, email: 'buyer@example.com', license_key: 'AAAA-BBBB-CCCC', license_expires_at: '2026-06-01T00:00:00Z' },
      ],
    })
    await run(payload, {
      event: 'subscription.renewed',
      license_key: 'AAAA-BBBB-CCCC',
      customer_email: 'buyer@example.com',
      license_expires_at: '2027-06-01T00:00:00Z',
    })
    expect(payload.store['pending-licenses'][0].license_expires_at).toBe('2027-06-01T00:00:00Z')
  })
})
