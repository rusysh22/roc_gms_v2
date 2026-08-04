// MSG-08: the one-sentence "layer 2" summary shown wherever a ruleset needs to be glanced at
// without opening its full edit form - the sport catalog card, the categories list, the category
// detail page. Pure function (no payload access) so it's cheap to call anywhere and easy to test.
//
// Catalog-sourced rulesets carry their own hand-written `summary` (see sportCatalog.ts) because a
// naturally-readable sentence isn't always something you can reliably compose from raw field
// values - callers with a catalog summary in hand should prefer it over this function. This
// function exists for everything else: custom rulesets, and catalog rulesets after a user has
// edited them away from the preset.

export type RulesetSummaryInput = {
  score_type?: string | null
  set_based?: boolean | null
  best_of?: number | null
  target_score?: number | null
  max_score?: number | null
  deuce_enabled?: boolean | null
  allow_draw?: boolean | null
  period_count?: number | null
  period_duration?: number | null
  default_duration_minutes?: number | null
  min_rest_minutes?: number | null
}

export const formatRulesetSummary = (ruleset: RulesetSummaryInput | null | undefined): string => {
  if (!ruleset) {
    return 'No rules set'
  }

  const parts: string[] = []

  if (ruleset.set_based) {
    parts.push(ruleset.best_of ? `Best of ${ruleset.best_of}` : 'Set-based')
  }

  if (ruleset.score_type === 'time') {
    parts.push('Fastest time wins')
  } else if (ruleset.target_score) {
    parts.push(`${ruleset.target_score} points${ruleset.max_score ? ` (max ${ruleset.max_score})` : ''}`)
  } else if (ruleset.score_type === 'goals') {
    parts.push('Goals')
  } else if (ruleset.score_type === 'result') {
    parts.push('Win/draw/loss result')
  }

  if (ruleset.deuce_enabled) {
    parts.push('deuce')
  }

  if (ruleset.allow_draw) {
    parts.push('draw allowed')
  }

  if (ruleset.period_count && ruleset.period_duration) {
    parts.push(`${ruleset.period_count}×${ruleset.period_duration} min`)
  }

  if (ruleset.default_duration_minutes) {
    parts.push(`~${ruleset.default_duration_minutes} min per match`)
  }

  if (parts.length === 0) {
    return 'No rules set'
  }

  return parts.join(' · ')
}
