import { describe, expect, it } from 'vitest'

import { retractSingleEliminationAdvancement } from './winnerAdvancement'

// Minimal in-memory Payload stub - only findByID + update on `matches` are exercised.
type Match = Record<string, unknown> & { id: number }
const makePayload = (matches: Match[]) => {
  const byId = new Map(matches.map((m) => [String(m.id), structuredClone(m)]))
  return {
    findByID: async ({ id }: { id: number | string }) => {
      const doc = byId.get(String(id))
      if (!doc) throw new Error(`no match ${id}`)
      return doc
    },
    update: async ({ id, data }: { id: number | string; data: Record<string, unknown> }) => {
      const doc = byId.get(String(id))!
      Object.assign(doc, data)
      return doc
    },
    _get: (id: number) => byId.get(String(id))!,
  }
}

const seStage = { id: 9, stage_type: 'single_elimination' }

describe('retractSingleEliminationAdvancement', () => {
  it('pulls the winner back out of an unstarted next match', async () => {
    const payload = makePayload([
      {
        id: 1,
        match_number: 'SF1',
        status: 'result_published',
        stage_id: seStage,
        participant_a_entry_id: { id: 100 },
        participant_b_entry_id: { id: 200 },
        winner_entry_id: { id: 100 },
        next_match_id: { id: 2 },
        next_match_slot: 'a',
      },
      { id: 2, match_number: 'FINAL', status: 'scheduled', participant_a_entry_id: { id: 100 }, participant_b_entry_id: null },
    ])
    const result = await retractSingleEliminationAdvancement(payload as never, 1)
    expect(result).toMatchObject({ retracted: true, clearedFrom: ['FINAL'] })
    expect(payload._get(2).participant_a_entry_id).toBeNull()
  })

  it('refuses when the next match has already started', async () => {
    const payload = makePayload([
      {
        id: 1,
        match_number: 'SF1',
        status: 'result_published',
        stage_id: seStage,
        participant_a_entry_id: { id: 100 },
        participant_b_entry_id: { id: 200 },
        winner_entry_id: { id: 100 },
        next_match_id: { id: 2 },
        next_match_slot: 'a',
      },
      { id: 2, match_number: 'FINAL', status: 'ongoing', participant_a_entry_id: { id: 100 }, participant_b_entry_id: { id: 300 } },
    ])
    const result = await retractSingleEliminationAdvancement(payload as never, 1)
    expect(result.retracted).toBe(false)
    expect(result.blockedBy).toBe('FINAL')
    expect(payload._get(2).participant_a_entry_id).toEqual({ id: 100 })
  })

  it('also clears the Bronze Final slot for a semifinal', async () => {
    const payload = makePayload([
      {
        id: 1,
        match_number: 'SF1',
        status: 'result_published',
        stage_id: seStage,
        participant_a_entry_id: { id: 100 },
        participant_b_entry_id: { id: 200 },
        winner_entry_id: { id: 100 },
        next_match_id: { id: 2 },
        next_match_slot: 'a',
        next_loser_match_id: { id: 3 },
        next_loser_match_slot: 'b',
      },
      { id: 2, match_number: 'FINAL', status: 'scheduled', participant_a_entry_id: { id: 100 }, participant_b_entry_id: null },
      { id: 3, match_number: 'BRONZE', status: 'scheduled', participant_a_entry_id: null, participant_b_entry_id: { id: 200 } },
    ])
    const result = await retractSingleEliminationAdvancement(payload as never, 1)
    expect(result.retracted).toBe(true)
    expect(result.clearedFrom).toEqual(expect.arrayContaining(['FINAL', 'BRONZE']))
    expect(payload._get(2).participant_a_entry_id).toBeNull()
    expect(payload._get(3).participant_b_entry_id).toBeNull()
  })

  it('leaves a slot that holds someone else untouched', async () => {
    const payload = makePayload([
      {
        id: 1,
        match_number: 'SF1',
        status: 'result_published',
        stage_id: seStage,
        participant_a_entry_id: { id: 100 },
        participant_b_entry_id: { id: 200 },
        winner_entry_id: { id: 100 },
        next_match_id: { id: 2 },
        next_match_slot: 'a',
      },
      { id: 2, match_number: 'FINAL', status: 'scheduled', participant_a_entry_id: { id: 999 }, participant_b_entry_id: null },
    ])
    const result = await retractSingleEliminationAdvancement(payload as never, 1)
    expect(result.retracted).toBe(true)
    expect(result.clearedFrom).toEqual([])
    expect(payload._get(2).participant_a_entry_id).toEqual({ id: 999 })
  })

  it('is a no-op for a non-single-elimination stage', async () => {
    const payload = makePayload([
      { id: 1, match_number: 'RR1', status: 'result_published', stage_id: { id: 5, stage_type: 'round_robin' }, winner_entry_id: { id: 100 } },
    ])
    const result = await retractSingleEliminationAdvancement(payload as never, 1)
    expect(result.retracted).toBe(false)
  })
})
