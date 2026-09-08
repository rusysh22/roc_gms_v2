import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import type { Payload } from 'payload'

import { applyMenuImport, parseMenuWorkbook, planMenuImport } from './engine'
import { MENU_IO_SPECS } from './specs'

// --- Minimal in-memory Payload double -------------------------------------
// Supports just what the engine touches: find (event_id + `and` equals filters), findByID, create,
// update, plus the audit-logs create + logger that recordAuditLog needs.
type Doc = Record<string, unknown> & { id: number }

const matches = (doc: Doc, where: unknown): boolean => {
  if (!where || typeof where !== 'object') return true
  const w = where as Record<string, unknown>
  if (Array.isArray(w.and)) return w.and.every((clause) => matches(doc, clause))
  if (Array.isArray(w.or)) return w.or.some((clause) => matches(doc, clause))
  return Object.entries(w).every(([field, cond]) => {
    const c = cond as { equals?: unknown; contains?: unknown }
    if (c && 'equals' in c) return String(doc[field] ?? '') === String(c.equals)
    if (c && 'contains' in c) return String(doc[field] ?? '').toLowerCase().includes(String(c.contains).toLowerCase())
    return true
  })
}

const makePayload = (seed: Record<string, Doc[]>) => {
  const store: Record<string, Doc[]> = {}
  for (const [k, v] of Object.entries(seed)) store[k] = v.map((d) => ({ ...d }))
  let nextId = 1000

  const payload = {
    logger: { error: () => {}, info: () => {} },
    find: async ({ collection, where, limit = 1000 }: { collection: string; where?: unknown; limit?: number }) => {
      const docs = (store[collection] ?? []).filter((d) => matches(d, where)).slice(0, limit)
      return { docs, totalDocs: docs.length }
    },
    findByID: async ({ collection, id }: { collection: string; id: string | number }) => {
      const doc = (store[collection] ?? []).find((d) => String(d.id) === String(id))
      if (!doc) throw new Error('not found')
      return doc
    },
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      const doc = { ...data, id: nextId++ } as Doc
      ;(store[collection] ??= []).push(doc)
      return doc
    },
    update: async ({ collection, id, data }: { collection: string; id: string | number; data: Record<string, unknown> }) => {
      const list = store[collection] ?? []
      const i = list.findIndex((d) => String(d.id) === String(id))
      if (i < 0) throw new Error('not found')
      list[i] = { ...list[i], ...data }
      return list[i]
    },
    count: async ({ collection, where }: { collection: string; where?: unknown }) => ({
      totalDocs: (store[collection] ?? []).filter((d) => matches(d, where)).length,
    }),
  }
  return { payload: payload as unknown as Payload, store }
}

const bookOf = (sheets: Record<string, Record<string, unknown>[]>): Buffer => {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name)
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

describe('planMenuImport', () => {
  it('classifies rows as create / update / error against existing data', async () => {
    const { payload } = makePayload({
      clubs: [{ id: 1, event_id: 9, name: 'Menteng AC', slug: 'menteng-ac' }],
    })
    const buffer = bookOf({
      Clubs: [
        { name: 'Menteng AC', slug: 'menteng-ac', contact_person: 'Budi' }, // update (slug match)
        { name: 'Kemang United', slug: '' }, // create
        { name: '', slug: 'x' }, // error - name required
      ],
    })
    const parsed = parseMenuWorkbook(buffer, MENU_IO_SPECS.clubs)
    const plan = await planMenuImport(payload, '9', MENU_IO_SPECS.clubs, parsed)

    expect(plan.counts).toMatchObject({ create: 1, update: 1, error: 1 })
    expect(plan.rows.find((r) => r.label === 'Menteng AC')?.action).toBe('update')
    expect(plan.rows.find((r) => r.action === 'error')?.reason).toMatch(/name is required/i)
  })

  it('flags an unknown relation label as a per-row error', async () => {
    const { payload } = makePayload({ sports: [{ id: 1, event_id: 9, name: 'Badminton', slug: 'badminton' }] })
    const buffer = bookOf({ Rulesets: [{ name: 'Standard', sport: 'Chess' }] })
    const parsed = parseMenuWorkbook(buffer, MENU_IO_SPECS.rulesets)
    const plan = await planMenuImport(payload, '9', MENU_IO_SPECS.rulesets, parsed)
    expect(plan.counts.error).toBe(1)
    expect(plan.rows[0].reason).toMatch(/"Chess" was not found/i)
  })
})

describe('applyMenuImport', () => {
  it('creates and updates rows, scoped to the event, and resolves relations by label', async () => {
    const { payload, store } = makePayload({
      sports: [{ id: 1, event_id: 9, name: 'Badminton', slug: 'badminton' }],
      rulesets: [{ id: 5, event_id: 9, name: 'Old Rules', slug: 'old-rules', sport_id: 1, points_win: 2 }],
    })
    const buffer = bookOf({
      Rulesets: [
        { name: 'Old Rules', slug: 'old-rules', sport: 'Badminton', points_win: 3 }, // update
        { name: 'Cup Rules', slug: 'cup-rules', sport: 'Badminton', points_win: 3 }, // create
      ],
    })
    const parsed = parseMenuWorkbook(buffer, MENU_IO_SPECS.rulesets)
    const summary = await applyMenuImport(payload, '9', 1, MENU_IO_SPECS.rulesets, parsed)

    expect(summary).toMatchObject({ created: 1, updated: 1, failed: 0 })
    expect(store.rulesets.find((r) => r.slug === 'old-rules')?.points_win).toBe(3)
    const created = store.rulesets.find((r) => r.slug === 'cup-rules')
    expect(created).toMatchObject({ sport_id: 1, event_id: 9 })
  })

  it('rebuilds the relation index between sheets so a later sheet can reference a new row', async () => {
    const { payload, store } = makePayload({
      clubs: [{ id: 1, event_id: 9, name: 'Menteng AC', slug: 'menteng-ac' }],
    })
    const buffer = bookOf({
      Players: [{ name: 'Ana', identification_number: 'X1', club: 'Menteng AC' }],
      Teams: [{ name: 'Team A', slug: 'team-a', club: 'Menteng AC', captain: 'Ana' }],
      Rosters: [{ team: 'Team A', player: 'Ana', role: 'captain' }],
    })
    const parsed = parseMenuWorkbook(buffer, MENU_IO_SPECS.participants)
    const summary = await applyMenuImport(payload, '9', 1, MENU_IO_SPECS.participants, parsed)

    expect(summary.failed).toBe(0)
    expect(summary.created).toBe(3)
    const ana = store.players.find((p) => p.name === 'Ana')!
    const teamA = store.teams.find((t) => t.slug === 'team-a')!
    expect(teamA.captain_player_id).toBe(ana.id)
    expect(store.rosters[0]).toMatchObject({ team_id: teamA.id, player_id: ana.id })
  })
})
