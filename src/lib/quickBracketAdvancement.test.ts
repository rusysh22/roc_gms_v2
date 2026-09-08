import { describe, expect, it } from 'vitest'

import type { MatchGenerationEntry } from './matchGeneration'
import {
  buildQuickDoubleEliminationBracket,
  buildQuickSingleEliminationBracket,
} from './quickBracketGeneration'
import { applyQuickDoubleEliminationResult, applyQuickSingleEliminationResult } from './quickBracketAdvancement'

const entries = (count: number): MatchGenerationEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    display_name: `P${index + 1}`,
    seed_number: index + 1,
  }))

const findMatch = (rounds: { matches: { id: string | number }[] }[], id: string) => {
  for (const round of rounds) {
    const match = round.matches.find((candidate) => String(candidate.id) === id)
    if (match) return match
  }
  throw new Error(`match ${id} not found`)
}

describe('applyQuickSingleEliminationResult', () => {
  it('advances a winner into the next round slot', () => {
    const bracket = buildQuickSingleEliminationBracket(
      { mode: 'from_participants', entries: entries(4) },
      { thirdPlace: false },
    )
    // 4-entrant bracket: round 0 = Semifinal (sf-0, sf-1), round 1 = Final (final-0)
    const result = applyQuickSingleEliminationResult(bracket, { matchId: 'sf-0', winnerSlot: 'a' })
    expect(result.error).toBeUndefined()
    const final = findMatch(result.data.rounds, 'final-0') as any
    expect(final.participant_a.label).toBe('P1')
    expect(final.participant_a.isPlaceholder).toBe(false)
    expect(final.participant_b.label).toBe('TBD')
  })

  it('routes both semifinal losers into the bronze final', () => {
    const bracket = buildQuickSingleEliminationBracket(
      { mode: 'from_participants', entries: entries(4) },
      { thirdPlace: true },
    )
    let result = applyQuickSingleEliminationResult(bracket, { matchId: 'sf-0', winnerSlot: 'a' })
    result = applyQuickSingleEliminationResult(result.data, { matchId: 'sf-1', winnerSlot: 'b' })
    const bronze = findMatch(result.data.rounds, 'bronze') as any
    // sf-0 = P1 vs P4 (winner P1, loser P4); sf-1 = P2 vs P3 (winner slot b = P3, loser P2)
    expect(bronze.participant_a.label).toBe('P4')
    expect(bronze.participant_b.label).toBe('P2')
    const final = findMatch(result.data.rounds, 'final-0') as any
    expect(final.participant_a.label).toBe('P1')
    expect(final.participant_b.label).toBe('P3')
  })

  it('detects the champion once the final is decided', () => {
    const bracket = buildQuickSingleEliminationBracket(
      { mode: 'from_participants', entries: entries(2) },
      { thirdPlace: false },
    )
    const result = applyQuickSingleEliminationResult(bracket, { matchId: 'final-0', winnerSlot: 'a' })
    expect(result.data.champion.status).toBe('decided')
    expect(result.data.champion.label).toBe('P1')
  })

  it('rejects setting a winner on an empty slot', () => {
    const bracket = buildQuickSingleEliminationBracket(
      { mode: 'manual_size', bracketSize: 4 },
      { thirdPlace: false },
    )
    const result = applyQuickSingleEliminationResult(bracket, { matchId: 'sf-0', winnerSlot: 'a' })
    expect(result.error).toBe('Cannot set a winner for an empty slot.')
  })
})

describe('applyQuickDoubleEliminationResult', () => {
  // 4-entrant DE topology (verified against buildLosersBracketPlan(2)): winners rounds wsf-0/
  // wsf-1 (semis) -> wfinal-0 (final). Losers bracket has only 2 rounds: l1-0 (fed directly by
  // BOTH semifinal losers - winnersRounds=2 collapses the usual "minor round" to a single match)
  // -> lfinal-0 (fed by l1-0's winner + the winners-final loser) -> grand final slot b.
  it('drops both winners-semifinal losers into the same first losers-bracket match', () => {
    const bracket = buildQuickDoubleEliminationBracket({ mode: 'from_participants', entries: entries(4) })
    let result = applyQuickDoubleEliminationResult(bracket, { matchId: 'wsf-0', winnerSlot: 'a' }) // P1 beats P4
    result = applyQuickDoubleEliminationResult(result.data, { matchId: 'wsf-1', winnerSlot: 'a' }) // P2 beats P3
    expect(result.error).toBeUndefined()
    const loserMatch = findMatch(result.data.losers_rounds, 'l1-0') as any
    expect([loserMatch.participant_a.label, loserMatch.participant_b.label].sort()).toEqual(['P3', 'P4'])
  })

  it('routes the winners-final loser and losers-bracket winner into the grand final', () => {
    let bracket = buildQuickDoubleEliminationBracket({ mode: 'from_participants', entries: entries(4) })
    let result = applyQuickDoubleEliminationResult(bracket, { matchId: 'wsf-0', winnerSlot: 'a' }) // P1 beats P4
    result = applyQuickDoubleEliminationResult(result.data, { matchId: 'wsf-1', winnerSlot: 'a' }) // P2 beats P3
    result = applyQuickDoubleEliminationResult(result.data, { matchId: 'wfinal-0', winnerSlot: 'a' }) // P1 beats P2 -> grand final slot a
    result = applyQuickDoubleEliminationResult(result.data, { matchId: 'l1-0', winnerSlot: 'a' }) // P4 beats P3 -> feeds lfinal-0

    const lfinal = findMatch(result.data.losers_rounds, 'lfinal-0') as any
    expect(lfinal.participant_a.label).toBe('P4') // l1-0 winner
    expect(lfinal.participant_b.label).toBe('P2') // winners-final loser

    result = applyQuickDoubleEliminationResult(result.data, { matchId: 'lfinal-0', winnerSlot: 'a' }) // P4 beats P2
    const grandFinal = result.data.grand_final as any
    expect(grandFinal.participant_a.label).toBe('P1')
    expect(grandFinal.participant_b.label).toBe('P4')
  })

  it('declares the grand final winner champion outright (no reset)', () => {
    const bracket = buildQuickDoubleEliminationBracket({ mode: 'from_participants', entries: entries(2) })
    // 2-entrant DE: wfinal-0 is the only winners match; loser goes straight to grand final slot b.
    let result = applyQuickDoubleEliminationResult(bracket, { matchId: 'wfinal-0', winnerSlot: 'a' })
    const grandFinal = result.data.grand_final as any
    expect(grandFinal.participant_b.label).toBe('P2')

    result = applyQuickDoubleEliminationResult(result.data, { matchId: 'grand-final', winnerSlot: 'b' })
    expect(result.data.champion.status).toBe('decided')
    expect(result.data.champion.label).toBe('P2')
  })
})
