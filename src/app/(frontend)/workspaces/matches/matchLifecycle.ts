export type MatchTransition = {
  from: string[]
  to: string
  label: string
  requiresConfirm?: boolean
  requiresWinnerSelection?: boolean
}

export const MATCH_TRANSITIONS: MatchTransition[] = [
  { from: ['ready_to_start'], to: 'ongoing', label: 'Start Match' },
  { from: ['ongoing'], to: 'paused', label: 'Pause Match' },
  { from: ['paused'], to: 'ongoing', label: 'Resume Match' },
  { from: ['ongoing'], to: 'finished', label: 'Finish Match' },
  {
    from: ['finished', 'under_review'],
    to: 'result_published',
    label: 'Confirm and Publish Result',
    requiresConfirm: true,
    requiresWinnerSelection: true,
  },
  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15.3/15.7 (P1): `under_review` and `disputed` were
  // enum values on the Matches collection with zero transitions in or out anywhere in this state
  // machine - a match could never actually reach either status through the app. This wires up the
  // lifecycle the audit itself describes: Finished -> Under review -> Result published, with
  // Disputed as a side branch reachable from either Finished or Under review and resolvable back
  // into Under review once addressed.
  { from: ['finished'], to: 'under_review', label: 'Send for Review' },
  {
    from: ['finished', 'under_review'],
    to: 'disputed',
    label: 'Mark Disputed',
    requiresConfirm: true,
  },
  { from: ['disputed'], to: 'under_review', label: 'Resume Review' },
  {
    from: ['scheduled', 'published'],
    to: 'postponed',
    label: 'Postpone Match',
    requiresConfirm: true,
  },
  {
    from: ['scheduled', 'published'],
    to: 'cancelled',
    label: 'Cancel Match',
    requiresConfirm: true,
  },
  {
    from: ['scheduled', 'published', 'ready_to_start'],
    to: 'walkover',
    label: 'Mark Walkover',
    requiresConfirm: true,
    requiresWinnerSelection: true,
  },
]

export const getAllowedTransitions = (status: string) =>
  MATCH_TRANSITIONS.filter((transition) => transition.from.includes(status))

const STANDINGS_STAGE_TYPES = new Set(['group_stage', 'round_robin', 'league', 'swiss'])

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15.5/15.7 (P0): "Confirm and Publish Result" previously
// showed only a generic "Are you sure?" - the actual downstream effects (standings recalculation,
// bracket advancement) were invisible until after confirming. A true per-winner dry-run preview
// would need to extend the bracket-advancement engine (src/lib/winnerAdvancement.ts, already
// hardened against real historical bugs - AUDIT_E2E BRK-02/BRK-03) to compute a hypothetical
// outcome without persisting anything - deliberately out of scope for a single pass given how
// correctness-sensitive that code already is. This is the safer, still-honest middle ground: tell
// the admin generically what category of consequence this specific match's publish will trigger.
export const getPublishResultConfirmMessage = (stageType: string | undefined): string => {
  const consequences: string[] = []
  if (stageType && STANDINGS_STAGE_TYPES.has(stageType)) {
    consequences.push('recalculate standings for this category')
  }
  if (stageType === 'single_elimination') {
    consequences.push("advance the winner into next round's slot")
  }
  if (stageType === 'double_elimination') {
    consequences.push(
      "advance the winner forward and route the loser into the losers bracket (or decide the champion, for the grand final)",
    )
  }

  const consequenceText =
    consequences.length > 0 ? ` This will ${consequences.join(' and ')}.` : ''

  return `Publish this result?${consequenceText} Once published, correcting it requires a reason and event admin approval.`
}

export const isValidTransition = (from: string, to: string) =>
  MATCH_TRANSITIONS.some((transition) => transition.from.includes(from) && transition.to === to)

export const MATCH_ACTION_ERROR_MESSAGES: Record<string, string> = {
  invalid_transition: 'That lifecycle action is not allowed from the current match status.',
  invalid_request: 'The action could not be completed because required data was missing.',
  invalid_score: 'Scores must be zero or a positive whole number.',
  not_found: 'Match could not be found.',
  winner_required: 'This transition requires selecting a winner before it can be confirmed.',
  ruleset_violation: 'That score is not valid for this category\'s rules (check target/max score, deuce, and draw settings).',
  best_of_decided: 'This match is already decided under its best-of format - no further sets can be added.',
  invalid_match_state: 'Scores can only be entered while a match is ongoing, paused, or under review.',
  revision_reason_required: 'A reason is required to revise a finished or published result.',
  revision_requires_approval: 'Only an event admin or super admin can revise a finished or published result.',
  invalid_ranking_result: 'Enter either a result value or a DNS/DNF/DSQ status - not both, and not neither.',
}
