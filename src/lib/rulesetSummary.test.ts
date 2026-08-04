import { describe, expect, it } from 'vitest'

import { formatRulesetSummary } from './rulesetSummary'

describe('formatRulesetSummary', () => {
  it('summarizes a set-based, deuce ruleset (MSG-08)', () => {
    expect(
      formatRulesetSummary({
        set_based: true,
        best_of: 3,
        target_score: 21,
        max_score: 30,
        deuce_enabled: true,
        default_duration_minutes: 40,
      }),
    ).toBe('Best of 3 · 21 points (max 30) · deuce · ~40 min per match')
  })

  it('summarizes a goals/draw-allowed ruleset', () => {
    expect(
      formatRulesetSummary({
        score_type: 'goals',
        set_based: false,
        allow_draw: true,
        period_count: 2,
        period_duration: 20,
        default_duration_minutes: 50,
      }),
    ).toBe('Goals · draw allowed · 2×20 min · ~50 min per match')
  })

  it('summarizes a time-trial ruleset', () => {
    expect(formatRulesetSummary({ score_type: 'time', default_duration_minutes: 15 })).toBe(
      'Fastest time wins · ~15 min per match',
    )
  })

  it('falls back to a placeholder for null/empty rulesets', () => {
    expect(formatRulesetSummary(null)).toBe('No rules set')
    expect(formatRulesetSummary({})).toBe('No rules set')
  })
})
