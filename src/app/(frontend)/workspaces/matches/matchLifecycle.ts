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
    from: ['finished'],
    to: 'result_published',
    label: 'Confirm and Publish Result',
    requiresConfirm: true,
    requiresWinnerSelection: true,
  },
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
}
