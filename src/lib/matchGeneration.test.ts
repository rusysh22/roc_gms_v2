import { describe, expect, it } from 'vitest'

import {
  buildSingleEliminationBracketPlan,
  getNextPowerOfTwo,
  getStandardSeedSlotOrder,
  type MatchGenerationEntry,
} from './matchGeneration'

// Regression coverage for AUDIT_E2E BRK-01/BRK-02: the single-elimination bracket generator used
// to pair bye recipients directly against each other one round early instead of spreading them
// across separate quarters/halves per standard seeding. See buildSingleEliminationBracketPlan's
// own comments in matchGeneration.ts for the algorithm this asserts against.

const makeEntries = (count: number): MatchGenerationEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    display_name: `Seed ${index + 1}`,
    seed_number: index + 1,
  }))

describe('getStandardSeedSlotOrder', () => {
  it('matches the known standard tournament seeding sequences', () => {
    expect(getStandardSeedSlotOrder(2)).toEqual([1, 2])
    expect(getStandardSeedSlotOrder(4)).toEqual([1, 4, 2, 3])
    expect(getStandardSeedSlotOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
    expect(getStandardSeedSlotOrder(16)).toEqual([
      1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11,
    ])
  })
})

describe('buildSingleEliminationBracketPlan', () => {
  it('returns an empty plan for fewer than 2 entries', () => {
    expect(buildSingleEliminationBracketPlan(makeEntries(0))).toEqual([])
    expect(buildSingleEliminationBracketPlan(makeEntries(1))).toEqual([])
  })

  // AUDIT_E2E section 8 acceptance test: "Property test jumlah entry 2-128 memastikan setiap
  // confirmed entry muncul tepat sekali di initial bracket source" + explicit 3/5/6/7/9/12 checks.
  const sizesToCheck = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 16, 17, 24, 32, 64, 128]

  for (const entryCount of sizesToCheck) {
    it(`produces a structurally valid bracket for ${entryCount} entries`, () => {
      const entries = makeEntries(entryCount)
      const plan = buildSingleEliminationBracketPlan(entries)
      const bracketSize = getNextPowerOfTwo(entryCount)
      const totalRounds = Math.log2(bracketSize)

      // Every entry appears exactly once across round 0 - none missing, none duplicated.
      const round0 = plan.filter((match) => match.round === 0)
      const seenIds = new Set<string | number>()
      for (const match of round0) {
        for (const participant of [match.participantA, match.participantB]) {
          if (!participant) continue
          expect(seenIds.has(participant.id)).toBe(false)
          seenIds.add(participant.id)
        }
      }
      expect(seenIds.size).toBe(entryCount)

      // A single-elimination bracket always has exactly bracketSize - 1 matches in total (every
      // match eliminates exactly one side, and every entrant but the eventual champion is
      // eliminated exactly once).
      expect(plan.length).toBe(bracketSize - 1)

      // isBye is only ever true in round 0, and only when exactly one side is a real entry.
      for (const match of plan) {
        if (match.isBye) {
          expect(match.round).toBe(0)
          expect(Boolean(match.participantA) !== Boolean(match.participantB)).toBe(true)
        }
      }

      // Seed 1 and seed 2 - the two entries most likely to receive a bye - must never meet
      // before the final. This is the exact defect in AUDIT_E2E BRK-01: two byes ended up paired
      // directly against each other one round early instead of each facing a round-0 winner.
      if (totalRounds >= 2) {
        for (const match of plan) {
          if (match.round === totalRounds - 1) {
            continue // the final - seed 1 vs seed 2 here is the correct, expected outcome
          }
          const ids = [match.participantA?.id, match.participantB?.id]
          expect(ids.includes(1) && ids.includes(2)).toBe(false)
        }
      }
    })
  }

  it('reproduces the exact AUDIT_E2E BRK-01 6-entry example correctly', () => {
    const plan = buildSingleEliminationBracketPlan(makeEntries(6))

    const round0 = [...plan.filter((match) => match.round === 0)].sort(
      (a, b) => a.matchIndex - b.matchIndex,
    )
    const byeMatches = round0.filter((match) => match.isBye)
    expect(byeMatches).toHaveLength(2)
    const byeWinnerIds = byeMatches
      .map((match) => (match.participantA ?? match.participantB)!.id)
      .sort()
    expect(byeWinnerIds).toEqual([1, 2])

    // Semifinal: seed 1 and seed 2 must land in *different* matches, each waiting on the TBD
    // winner of a real round-0 match - not paired against each other.
    const round1 = plan.filter((match) => match.round === 1)
    expect(round1).toHaveLength(2)
    for (const match of round1) {
      const ids = [match.participantA?.id, match.participantB?.id]
      const hasSeedOne = ids.includes(1)
      const hasSeedTwo = ids.includes(2)
      expect(hasSeedOne && hasSeedTwo).toBe(false)
      if (hasSeedOne || hasSeedTwo) {
        expect(ids.includes(undefined)).toBe(true)
      }
    }
  })
})
