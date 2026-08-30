import type { Payload } from 'payload'

import { isSetDecidedByRules } from './matchResult'

// AUDIT_E2E RULE-01: score entry never read best_of/target_score/max_score/deuce_enabled/
// allow_draw at all, so an operator could submit any score and pick any winner regardless of the
// category's own rules (e.g. badminton target 21/max 30 happily accepted 7-4 as a finished set).
// This module is the single place that enforces those fields against a submitted score - wired
// into the workspace's canonical score actions (src/app/(frontend)/workspaces/matches/matchActions.ts).
export type RulesetSummary = {
  set_based?: boolean | null
  allow_draw?: boolean | null
  best_of?: number | null
  target_score?: number | null
  max_score?: number | null
  deuce_enabled?: boolean | null
}

export type ValidationResult = { valid: true } | { valid: false; error: string }

const ok: ValidationResult = { valid: true }
const fail = (error: string): ValidationResult => ({ valid: false, error })

export const validateSetScore = ({
  ruleset,
  participantAScore,
  participantBScore,
  winnerSide,
}: {
  ruleset: RulesetSummary | null | undefined
  participantAScore: number
  participantBScore: number
  winnerSide: 'a' | 'b' | null
}): ValidationResult => {
  if (participantAScore === participantBScore) {
    if (winnerSide) {
      return fail('Scores are tied - a tied score cannot have a winner.')
    }
    if (!ruleset?.allow_draw) {
      return fail('This category does not allow a draw - scores cannot be tied.')
    }
    return ok
  }

  const impliedWinner = participantAScore > participantBScore ? 'a' : 'b'
  if (winnerSide && winnerSide !== impliedWinner) {
    return fail('The selected winner does not match the higher score.')
  }

  if (!ruleset?.set_based) {
    return ok
  }

  const winnerScore = Math.max(participantAScore, participantBScore)
  const loserScore = Math.min(participantAScore, participantBScore)
  const max = ruleset.max_score
  const target = ruleset.target_score

  if (max !== null && max !== undefined && winnerScore > max) {
    return fail(`Score cannot exceed the maximum of ${max} for this category.`)
  }

  // Decidedness (target reached, win-by-2 on deuce, capped at max) is computed once in
  // src/lib/matchResult.ts and reused here so validation and the auto-derived set winner can
  // never disagree about whether a set is finished.
  if (target !== null && target !== undefined && !isSetDecidedByRules(ruleset, winnerScore, loserScore)) {
    if (winnerScore < target) {
      return fail(`A set is not decided until a side reaches ${target} points for this category.`)
    }
    return fail('This category requires winning by at least 2 points once past the target score.')
  }

  return ok
}

const getRelationId = (value: unknown): string | number | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }
  if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return (value as { id: string | number }).id
  }
  return undefined
}

export const countSetWinsForSide = (
  sets: Array<{ winner_entry_id?: unknown }>,
  sideEntryId: string | number | null | undefined,
) => {
  if (!sideEntryId) {
    return 0
  }
  return sets.filter((set) => String(getRelationId(set.winner_entry_id)) === String(sideEntryId)).length
}

/** best_of is a match win-count cap (e.g. best_of=3 -> first to 2 set wins) - once a side has
 * reached that count, no further sets should be created (AUDIT_E2E RULE-01's "best-of-3 tetap
 * dapat memiliki set ke-4" example). */
export const isBestOfAlreadyDecided = (
  bestOf: number | null | undefined,
  winsA: number,
  winsB: number,
) => {
  if (!bestOf || bestOf < 1) {
    return false
  }
  const neededWins = Math.ceil(bestOf / 2)
  return winsA >= neededWins || winsB >= neededWins
}

/** Resolves the ruleset that applies to a match: the match's stage's own ruleset_id if set
 * (MSG-03's per-stage override - e.g. best-of-3 group matches, best-of-5 semifinal/final within
 * the same category), otherwise falling back to match.category_id -> category.ruleset_id.
 * Returns null (not an error) when neither has a ruleset assigned - callers should treat a
 * missing ruleset as "no extra constraints", not as a validation failure, since not every category
 * requires one (e.g. score_type: 'result' friendlies). Takes { categoryId, stageId } rather than a
 * bare categoryId (its previous signature) so a caller can never accidentally skip the stage-level
 * override by forgetting to pass it - every call site is forced to supply both. */
export const loadRulesetForMatch = async (
  payload: Payload,
  { categoryId, stageId }: { categoryId: string | number | null | undefined; stageId: string | number | null | undefined },
): Promise<RulesetSummary | null> => {
  if (stageId) {
    const stage = await payload.findByID({ collection: 'stages', id: stageId, depth: 0 }).catch(() => null)
    const stageRulesetId = stage ? getRelationId(stage.ruleset_id) : undefined
    if (stageRulesetId) {
      const stageRuleset = await payload.findByID({ collection: 'rulesets', id: stageRulesetId, depth: 0 }).catch(() => null)
      if (stageRuleset) {
        return stageRuleset as RulesetSummary
      }
    }
  }

  if (!categoryId) {
    return null
  }

  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  const rulesetId = category ? getRelationId(category.ruleset_id) : undefined
  if (!rulesetId) {
    return null
  }

  const ruleset = await payload.findByID({ collection: 'rulesets', id: rulesetId, depth: 0 }).catch(() => null)
  return (ruleset as RulesetSummary | null) || null
}
