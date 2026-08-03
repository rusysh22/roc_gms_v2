import { describe, expect, it } from 'vitest'

import { buildLosersBracketPlan, isExactPowerOfTwo } from './doubleElimination'

// Regression/structural coverage for ADMIN_EVENT_CREATION_NUSANTARA_GRAND_GAMES_2026.md F-14: the
// losers-bracket topology this generates has to be right by construction, since (unlike
// single-elimination) there's no simple "every entry appears exactly once" property to lean on -
// see buildLosersBracketPlan's own comments in doubleElimination.ts for the algorithm this
// asserts against.

describe('isExactPowerOfTwo', () => {
  it('accepts only exact powers of two, 2 and up', () => {
    expect(isExactPowerOfTwo(2)).toBe(true)
    expect(isExactPowerOfTwo(4)).toBe(true)
    expect(isExactPowerOfTwo(8)).toBe(true)
    expect(isExactPowerOfTwo(16)).toBe(true)
    expect(isExactPowerOfTwo(1)).toBe(false)
    expect(isExactPowerOfTwo(0)).toBe(false)
    expect(isExactPowerOfTwo(3)).toBe(false)
    expect(isExactPowerOfTwo(6)).toBe(false)
    expect(isExactPowerOfTwo(12)).toBe(false)
  })
})

describe('buildLosersBracketPlan', () => {
  it('returns no losers-bracket rounds for a 2-entry winners bracket', () => {
    expect(buildLosersBracketPlan(1)).toEqual([])
  })

  it('matches the hand-derived 4-entry shape (1 winners-bracket round pair -> 2 LB rounds of 1 match each)', () => {
    const plan = buildLosersBracketPlan(2)
    expect(plan).toHaveLength(2)
    expect(plan[0]).toEqual({
      round: 0,
      matchIndex: 0,
      sourceA: { kind: 'wb_loser', round: 0, matchIndex: 0 },
      sourceB: { kind: 'wb_loser', round: 0, matchIndex: 1 },
    })
    expect(plan[1]).toEqual({
      round: 1,
      matchIndex: 0,
      sourceA: { kind: 'lb_winner', round: 0, matchIndex: 0 },
      sourceB: { kind: 'wb_loser', round: 1, matchIndex: 0 },
    })
  })

  it('matches the hand-derived 8-entry shape (round sizes 2, 2, 1, 1)', () => {
    const plan = buildLosersBracketPlan(3)
    const byRound = (round: number) => plan.filter((p) => p.round === round)

    expect(byRound(0)).toHaveLength(2)
    expect(byRound(1)).toHaveLength(2)
    expect(byRound(2)).toHaveLength(1)
    expect(byRound(3)).toHaveLength(1)

    // Round 0 (minor): WB round-0 losers paired adjacently.
    expect(byRound(0)[1]).toEqual({
      round: 0,
      matchIndex: 1,
      sourceA: { kind: 'wb_loser', round: 0, matchIndex: 2 },
      sourceB: { kind: 'wb_loser', round: 0, matchIndex: 3 },
    })
    // Round 1 (major): LB round-0 winners vs WB round-1 losers, same index.
    expect(byRound(1)[1]).toEqual({
      round: 1,
      matchIndex: 1,
      sourceA: { kind: 'lb_winner', round: 0, matchIndex: 1 },
      sourceB: { kind: 'wb_loser', round: 1, matchIndex: 1 },
    })
    // Round 2 (minor): LB round-1 winners paired adjacently.
    expect(byRound(2)[0]).toEqual({
      round: 2,
      matchIndex: 0,
      sourceA: { kind: 'lb_winner', round: 1, matchIndex: 0 },
      sourceB: { kind: 'lb_winner', round: 1, matchIndex: 1 },
    })
    // Round 3 (LB final, major): LB round-2 winner vs the winners-bracket FINAL's loser.
    expect(byRound(3)[0]).toEqual({
      round: 3,
      matchIndex: 0,
      sourceA: { kind: 'lb_winner', round: 2, matchIndex: 0 },
      sourceB: { kind: 'wb_loser', round: 2, matchIndex: 0 },
    })
  })

  const winnersRoundsToCheck = [1, 2, 3, 4, 5, 6]

  for (const winnersRounds of winnersRoundsToCheck) {
    const bracketSize = 2 ** winnersRounds

    it(`produces a structurally valid losers bracket for a ${bracketSize}-entry winners bracket`, () => {
      const plan = buildLosersBracketPlan(winnersRounds)

      if (winnersRounds < 2) {
        expect(plan).toEqual([])
        return
      }

      const totalLoserRounds = 2 * (winnersRounds - 1)
      expect(Math.max(...plan.map((p) => p.round)) + 1).toBe(totalLoserRounds)

      // Total elimination-bracket match count (winners + losers + grand final, reset excluded)
      // must equal the standard double-elimination identity 2N - 2.
      const wbMatchCount = bracketSize - 1
      const lbMatchCount = plan.length
      expect(wbMatchCount + lbMatchCount + 1).toBe(2 * bracketSize - 2)

      // Every round's match count must match the level formula, and every source index must
      // point at a match that actually exists in the round/bracket it references.
      const wbRoundSize = (round: number) => bracketSize / 2 ** (round + 1)
      const lbRoundSize = new Map<number, number>()
      for (const p of plan) {
        lbRoundSize.set(p.round, (lbRoundSize.get(p.round) || 0) + 1)
      }

      for (const p of plan) {
        const level = Math.floor(p.round / 2)
        const expectedSize = 2 ** (winnersRounds - level - 2)
        expect(lbRoundSize.get(p.round)).toBe(expectedSize)

        for (const source of [p.sourceA, p.sourceB]) {
          if (source.kind === 'wb_loser') {
            expect(source.matchIndex).toBeLessThan(wbRoundSize(source.round))
          } else {
            expect(source.matchIndex).toBeLessThan(lbRoundSize.get(source.round) || 0)
          }
        }

        // sourceA and sourceB must never resolve to the same feeder match.
        expect(p.sourceA).not.toEqual(p.sourceB)
      }
    })
  }
})
