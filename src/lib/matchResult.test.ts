import { describe, expect, it } from 'vitest'

import {
  deriveMatchOutcome,
  deriveSetWinnerSide,
  formatScoreSummary,
  isLevelDraw,
  isSetDecidedByRules,
  type MatchRuleset,
} from './matchResult'

// Badminton: best of 3, first to 21, win by 2, hard cap at 30.
const badminton: MatchRuleset = {
  set_based: true,
  best_of: 3,
  target_score: 21,
  max_score: 30,
  deuce_enabled: true,
}

describe('isSetDecidedByRules', () => {
  it('needs the target score', () => {
    expect(isSetDecidedByRules(badminton, 20, 15)).toBe(false)
    expect(isSetDecidedByRules(badminton, 21, 19)).toBe(true)
  })

  it('enforces win-by-two once at deuce', () => {
    expect(isSetDecidedByRules(badminton, 21, 20)).toBe(false)
    expect(isSetDecidedByRules(badminton, 22, 20)).toBe(true)
    expect(isSetDecidedByRules(badminton, 24, 24)).toBe(false)
  })

  it('is decided at the hard cap regardless of margin', () => {
    expect(isSetDecidedByRules(badminton, 30, 29)).toBe(true)
  })

  it('is never auto-decidable without a target score', () => {
    expect(isSetDecidedByRules({ set_based: true, best_of: 1 }, 5, 0)).toBe(false)
  })
})

describe('deriveSetWinnerSide', () => {
  it('picks the higher side once the set is decided', () => {
    expect(deriveSetWinnerSide(badminton, 21, 15)).toBe('a')
    expect(deriveSetWinnerSide(badminton, 19, 21)).toBe('b')
  })
  it('returns null while the set is in progress or tied', () => {
    expect(deriveSetWinnerSide(badminton, 20, 18)).toBeNull()
    expect(deriveSetWinnerSide(badminton, 21, 20)).toBeNull()
    expect(deriveSetWinnerSide(badminton, 11, 11)).toBeNull()
  })
})

describe('deriveMatchOutcome', () => {
  it('is undecided at 1-1', () => {
    const outcome = deriveMatchOutcome(badminton, [
      { participant_a_score: 21, participant_b_score: 15 },
      { participant_a_score: 18, participant_b_score: 21 },
    ])
    expect(outcome).toMatchObject({ decided: false, winnerSide: null, setsWonA: 1, setsWonB: 1, neededWins: 2 })
  })

  it('is decided at 2-0 and 2-1', () => {
    expect(
      deriveMatchOutcome(badminton, [
        { participant_a_score: 21, participant_b_score: 15 },
        { participant_a_score: 21, participant_b_score: 17 },
      ]),
    ).toMatchObject({ decided: true, winnerSide: 'a', setsWonA: 2, setsWonB: 0 })

    expect(
      deriveMatchOutcome(badminton, [
        { participant_a_score: 15, participant_b_score: 21 },
        { participant_a_score: 21, participant_b_score: 17 },
        { participant_a_score: 19, participant_b_score: 21 },
      ]),
    ).toMatchObject({ decided: true, winnerSide: 'b', setsWonA: 1, setsWonB: 2 })
  })

  it('ignores an in-progress deciding set', () => {
    const outcome = deriveMatchOutcome(badminton, [
      { participant_a_score: 21, participant_b_score: 15 },
      { participant_a_score: 18, participant_b_score: 21 },
      { participant_a_score: 15, participant_b_score: 12 },
    ])
    expect(outcome.decided).toBe(false)
  })

  it('treats a single completed set as decisive when best_of is unset', () => {
    const oneSet: MatchRuleset = { set_based: false, target_score: 21, deuce_enabled: true }
    expect(
      deriveMatchOutcome(oneSet, [{ participant_a_score: 21, participant_b_score: 12 }]),
    ).toMatchObject({ decided: true, winnerSide: 'a', neededWins: 1 })
  })

  it('honours a stored winner_side over the score', () => {
    const outcome = deriveMatchOutcome(badminton, [
      { participant_a_score: 5, participant_b_score: 3, winner_side: 'b' },
      { participant_a_score: 0, participant_b_score: 0, winner_side: 'b' },
    ])
    expect(outcome).toMatchObject({ decided: true, winnerSide: 'b', setsWonB: 2 })
  })
})

describe('isLevelDraw (MATCH-01)', () => {
  const football: MatchRuleset = { set_based: false, allow_draw: true }
  const draw = (rs: MatchRuleset, sets: Parameters<typeof deriveMatchOutcome>[1]) =>
    isLevelDraw(rs, sets, deriveMatchOutcome(rs, sets))

  it('is a draw for a permitted level result (football 1-1, even 0-0)', () => {
    expect(draw(football, [{ participant_a_score: 1, participant_b_score: 1 }])).toBe(true)
    expect(draw(football, [{ participant_a_score: 0, participant_b_score: 0 }])).toBe(true)
  })

  it('is not a draw when the ruleset forbids one', () => {
    expect(draw({ set_based: false, allow_draw: false }, [{ participant_a_score: 1, participant_b_score: 1 }])).toBe(false)
  })

  it('is not a draw when a side actually leads or won', () => {
    expect(draw(football, [{ participant_a_score: 2, participant_b_score: 1 }])).toBe(false)
    expect(
      draw({ set_based: true, best_of: 3, target_score: 21, allow_draw: true }, [
        { participant_a_score: 21, participant_b_score: 10 },
      ]),
    ).toBe(false)
  })

  it('is not a draw with no set rows (finished without scoring)', () => {
    expect(draw(football, [])).toBe(false)
  })

  it('is a draw when the set tally is level (1-1 in a best-of-3 that allows draws)', () => {
    const rs: MatchRuleset = { set_based: true, best_of: 3, target_score: 21, allow_draw: true }
    expect(
      draw(rs, [
        { participant_a_score: 21, participant_b_score: 15 },
        { participant_a_score: 18, participant_b_score: 21 },
      ]),
    ).toBe(true)
  })
})

describe('formatScoreSummary', () => {
  it('is empty before anything is scored', () => {
    expect(
      formatScoreSummary('A', 'B', [{ participant_a_score: 0, participant_b_score: 0 }], deriveMatchOutcome(badminton, [])),
    ).toBe('')
  })

  it('shows the running line while in progress', () => {
    const sets = [
      { participant_a_score: 21, participant_b_score: 15 },
      { participant_a_score: 10, participant_b_score: 8 },
    ]
    expect(formatScoreSummary('A', 'B', sets, deriveMatchOutcome(badminton, sets))).toBe('21-15, 10-8')
  })

  it('names the winner once decided', () => {
    const sets = [
      { participant_a_score: 21, participant_b_score: 18 },
      { participant_a_score: 19, participant_b_score: 21 },
      { participant_a_score: 21, participant_b_score: 15 },
    ]
    expect(formatScoreSummary('Fajar/Luthfi', 'Dimas/Joko', sets, deriveMatchOutcome(badminton, sets))).toBe(
      'Fajar/Luthfi beat Dimas/Joko 2-1 (21-18, 19-21, 21-15)',
    )
  })
})
