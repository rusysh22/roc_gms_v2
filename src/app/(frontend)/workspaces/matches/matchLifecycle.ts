export type MatchTransition = {
  from: string[]
  to: string
  label: string
  requiresConfirm?: boolean
  requiresWinnerSelection?: boolean
  /** A "back" step (Undo Start / Reopen / Restore). Surfaced on the Match Details page but kept off
   *  the Live Score quick-action panel, which is for driving a match forward. */
  reverse?: boolean
}

export const MATCH_TRANSITIONS: MatchTransition[] = [
  // Nothing in the app currently advances a match into `check_in_open` / `ready_to_start` - those
  // auto-check-in steps aren't built yet (see the note in src/lib/delayPropagation.ts) - so a
  // `scheduled` or `published` match had no path to `ongoing` at all, and the officer's Live Score
  // point taps failed with `invalid_match_state`. Allow starting straight from the scheduled
  // states; `transitionMatchStatusAction` still stamps `actual_start_at` on the way in.
  { from: ['scheduled', 'published', 'check_in_open', 'ready_to_start'], to: 'ongoing', label: 'Start Match' },
  { from: ['ongoing'], to: 'paused', label: 'Pause Match' },
  { from: ['paused'], to: 'ongoing', label: 'Resume Match' },
  { from: ['ongoing'], to: 'finished', label: 'Finish Match' },
  // Reverse steps for the common "oops" cases. `transitionMatchStatusAction` clears the timestamps
  // and derived winner these unwind. Set scores are kept (the winner re-derives from them).
  { from: ['ongoing', 'paused'], to: 'scheduled', label: 'Undo Start', requiresConfirm: true, reverse: true },
  {
    from: ['finished', 'under_review'],
    to: 'ongoing',
    label: 'Reopen Match',
    requiresConfirm: true,
    reverse: true,
  },
  { from: ['cancelled'], to: 'scheduled', label: 'Restore Match', requiresConfirm: true, reverse: true },
  // Reopening a final result / undoing a walkover. Event Admin only (locked-status hook). For
  // single elimination the winner is pulled back out of the next round first, and it is blocked if
  // that next match has already progressed; not supported for double elimination.
  { from: ['result_published'], to: 'under_review', label: 'Reopen Result', requiresConfirm: true, reverse: true },
  { from: ['walkover'], to: 'scheduled', label: 'Undo Walkover', requiresConfirm: true, reverse: true },
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

// The match statuses in which per-point / per-set score entry is accepted. Kept here so the Live
// Score UI can disable its controls up front instead of letting every tap fail server-side with
// `invalid_match_state`, and so matchActions.ts's guard reads from the same list.
export const SCOREABLE_MATCH_STATUSES = ['ongoing', 'paused', 'under_review'] as const

export const isScoreableStatus = (status: string): boolean =>
  (SCOREABLE_MATCH_STATUSES as readonly string[]).includes(status)

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md 15.6: only status changes a spectator would actually care
// about post to the public "Match Updates" feed - ongoing/paused/finished/under_review are
// internal operating states with no public-facing meaning of their own (finished still says
// "Provisional" until result_published; under_review shouldn't alarm anyone).
//
// Lives here (a plain module) rather than in matchActions.ts - a "use server" file's static
// analysis only allows async-function exports, so a plain object constant like this has to live
// outside the action file that uses it (schedulerActions.ts's bulk import needs it too).
export const PUBLIC_STATUS_NOTICES: Record<string, { urgency: 'warning' | 'urgent' | 'result'; displayMode: 'banner' | 'urgent_alert' | 'feed'; label: string }> = {
  postponed: { urgency: 'warning', displayMode: 'banner', label: 'postponed' },
  cancelled: { urgency: 'warning', displayMode: 'banner', label: 'cancelled' },
  disputed: { urgency: 'urgent', displayMode: 'urgent_alert', label: 'marked disputed' },
  result_published: { urgency: 'result', displayMode: 'feed', label: 'result published' },
  walkover: { urgency: 'result', displayMode: 'feed', label: 'decided by walkover' },
}

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
  match_not_decided:
    "The rules don't show a winner yet - finish the deciding set, or use \"Correct manually\" to set the result.",
  transition_forbidden:
    'That change needs an Event Admin - a finished, published, walked-over, or cancelled match is locked to Match Officers.',
  reopen_not_supported:
    "Reopening isn't supported for double-elimination results. Use Undo Phase or Clear & regenerate if nothing has started, or mark the match Disputed.",
  reopen_blocked_downstream:
    'The next-round match this result fed has already progressed. Reopen or resolve that match first.',
  set_delete_locked: 'Sets cannot be removed once the match result is finished or published.',
  set_delete_not_last: 'Only the most recent set can be removed. Delete later sets first.',
  ruleset_violation: 'That score is not valid for this category\'s rules (check target/max score, deuce, and draw settings).',
  best_of_decided: 'This match is already decided under its best-of format - no further sets can be added.',
  invalid_match_state: 'Scores can only be entered while a match is ongoing, paused, or under review.',
  revision_reason_required: 'A reason is required to revise a finished or published result.',
  revision_requires_approval: 'Only an event admin or super admin can revise a finished or published result.',
  invalid_ranking_result: 'Enter either a result value or a DNS/DNF/DSQ status - not both, and not neither.',
}
