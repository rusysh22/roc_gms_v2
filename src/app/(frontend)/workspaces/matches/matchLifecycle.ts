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
}
