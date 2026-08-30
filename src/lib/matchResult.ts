// Derives set and match outcomes from the score plus the category/stage ruleset, so an officer
// entering a live score never has to also tell the system who won - the rules already say.
//
// AUDIT_E2E RULE-01 gave us validateSetScore (src/lib/ruleValidation.ts), which *rejects* a score
// that doesn't fit the rules. This module is the other half: given a score that fits, *which side
// has won the set*, and *is the match decided*. validateSetScore now delegates its "is this set
// actually finished" check here so the two can never disagree.

export type MatchRuleset = {
  set_based?: boolean | null
  allow_draw?: boolean | null
  best_of?: number | null
  target_score?: number | null
  max_score?: number | null
  deuce_enabled?: boolean | null
}

export type OutcomeSet = {
  participant_a_score?: number | null
  participant_b_score?: number | null
  // A stored winner (manual override, walkover, historical data) takes precedence over the score
  // when present - mirrors src/lib/standings.ts.
  winner_side?: 'a' | 'b' | null
}

export type Side = 'a' | 'b'

/**
 * Is a set finished under the ruleset, given the winner's and loser's scores?
 * `target_score` unset -> not auto-decidable (returns false; a human still finalises it).
 */
export const isSetDecidedByRules = (
  ruleset: MatchRuleset | null | undefined,
  hiScore: number,
  loScore: number,
): boolean => {
  const target = ruleset?.target_score
  if (target === null || target === undefined) {
    return false
  }
  if (hiScore < target) {
    return false
  }
  const max = ruleset?.max_score
  if (max !== null && max !== undefined && hiScore >= max) {
    return true
  }
  if (ruleset?.deuce_enabled) {
    return hiScore - loScore >= 2
  }
  return true
}

/** Which side has won this set, or null if it is a draw or not yet decided. */
export const deriveSetWinnerSide = (
  ruleset: MatchRuleset | null | undefined,
  aScore: number,
  bScore: number,
): Side | null => {
  if (aScore === bScore) {
    return null
  }
  const hi = Math.max(aScore, bScore)
  const lo = Math.min(aScore, bScore)
  if (!isSetDecidedByRules(ruleset, hi, lo)) {
    return null
  }
  return aScore > bScore ? 'a' : 'b'
}

const setWinnerSide = (ruleset: MatchRuleset | null | undefined, set: OutcomeSet): Side | null => {
  if (set.winner_side === 'a' || set.winner_side === 'b') {
    return set.winner_side
  }
  return deriveSetWinnerSide(ruleset, set.participant_a_score ?? 0, set.participant_b_score ?? 0)
}

export type MatchOutcome = {
  decided: boolean
  winnerSide: Side | null
  setsWonA: number
  setsWonB: number
  /** Set wins needed to take the match (best_of/2 rounded up; 1 when best_of is unset). */
  neededWins: number
}

export const deriveMatchOutcome = (
  ruleset: MatchRuleset | null | undefined,
  sets: OutcomeSet[],
): MatchOutcome => {
  let setsWonA = 0
  let setsWonB = 0
  for (const set of sets) {
    const side = setWinnerSide(ruleset, set)
    if (side === 'a') setsWonA += 1
    else if (side === 'b') setsWonB += 1
  }

  const bestOf = ruleset?.best_of
  const neededWins = bestOf && bestOf >= 1 ? Math.ceil(bestOf / 2) : 1

  const winnerSide: Side | null =
    setsWonA >= neededWins ? 'a' : setsWonB >= neededWins ? 'b' : null

  return { decided: winnerSide !== null, winnerSide, setsWonA, setsWonB, neededWins }
}

const perSetScores = (sets: OutcomeSet[]): string =>
  sets
    .map((set) => `${set.participant_a_score ?? 0}-${set.participant_b_score ?? 0}`)
    .join(', ')

/**
 * A one-line recap for `matches.score_summary` (shown on the workspace + every public surface).
 * Decided -> "Winner beat Loser 2-1 (21-18, 19-21, 21-15)". Otherwise the running per-set line, or
 * '' when nothing has been scored yet.
 */
export const formatScoreSummary = (
  aLabel: string,
  bLabel: string,
  sets: OutcomeSet[],
  outcome: MatchOutcome,
): string => {
  const scored = sets.filter(
    (set) => (set.participant_a_score ?? 0) !== 0 || (set.participant_b_score ?? 0) !== 0,
  )
  if (scored.length === 0) {
    return ''
  }

  const line = perSetScores(sets)

  if (outcome.decided && outcome.winnerSide) {
    const winnerLabel = outcome.winnerSide === 'a' ? aLabel : bLabel
    const loserLabel = outcome.winnerSide === 'a' ? bLabel : aLabel
    const winnerSets = outcome.winnerSide === 'a' ? outcome.setsWonA : outcome.setsWonB
    const loserSets = outcome.winnerSide === 'a' ? outcome.setsWonB : outcome.setsWonA
    const tally = winnerSets + loserSets > 1 ? ` ${winnerSets}-${loserSets}` : ''
    return `${winnerLabel} beat ${loserLabel}${tally} (${line})`
  }

  return line
}
