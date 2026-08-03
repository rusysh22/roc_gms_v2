import { UNSTARTED_TARGET_STATUSES } from './winnerAdvancement'

// Must match schedulerActions.ts's reschedulableFromStates exactly - it can't be imported
// directly ('use server' files may only export async functions). Deliberately narrower than
// UNSTARTED_TARGET_STATUSES (used below for "has this match not started yet") - a match already
// past 'scheduled' (published, check_in_open, ready_to_start) hasn't run yet either, but
// rescheduleMatchAction refuses to move it, so suggesting a downstream shift for one would fail
// on Apply.
const RESCHEDULABLE_STATUSES = new Set(['draft', 'ready_for_scheduling', 'scheduled', 'postponed'])

type RelationshipDoc = { id?: string | number; name?: string; display_name?: string }

export type DelayMatch = {
  id: string | number
  match_number: string
  status: string
  scheduled_start_at?: string | null
  scheduled_end_at?: string | null
  actual_start_at?: string | null
  venue_id?: RelationshipDoc | string | number | null
  court_id?: RelationshipDoc | string | number | null
}

export type DownstreamSuggestion = {
  match: DelayMatch
  suggestedStartAt: string
  suggestedEndAt: string
}

export type DelayImpact = {
  courtKey: string
  sourceMatch: DelayMatch
  delayMinutes: number
  downstream: DownstreamSuggestion[]
}

const getId = (value: RelationshipDoc | string | number | null | undefined) =>
  value && typeof value === 'object' ? value.id : value

// A delay is only worth propagating past this - a 2-minute slip isn't worth reshuffling anyone's
// schedule over, and rounding every suggestion to a 5-minute step keeps the numbers clean rather
// than proposing something like "shift by 7 minutes".
const MIN_DELAY_MINUTES = 10
const ROUND_TO_MINUTES = 5

const roundUpToStep = (minutes: number, step: number) => Math.ceil(minutes / step) * step

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15 P2 "automated delay propagation": deliberately a
// *suggestion* engine, not an auto-writer - it computes what downstream matches on the same court
// would need to shift by if a late match's delay holds, but every apply still goes through the
// existing rescheduleMatchAction (conflict-checked, audit-logged, now notification-posting) one
// match at a time. Silently rewriting other people's schedules without a human confirming each one
// is exactly the kind of surprise a scheduling tool should never spring on an operator.
export const computeDelayImpacts = (matches: DelayMatch[], now: Date = new Date()): DelayImpact[] => {
  const nowMs = now.getTime()
  const byCourt = new Map<string, DelayMatch[]>()

  for (const match of matches) {
    const courtId = getId(match.court_id)
    if (!courtId) continue
    const key = `court:${courtId}`
    const list = byCourt.get(key) || []
    list.push(match)
    byCourt.set(key, list)
  }

  const impacts: DelayImpact[] = []

  for (const [courtKey, courtMatches] of byCourt) {
    let bestSource: { match: DelayMatch; delayMinutes: number } | null = null

    for (const match of courtMatches) {
      if (!match.scheduled_start_at) continue
      const scheduledMs = new Date(match.scheduled_start_at).getTime()

      let delayMinutes = 0
      if (match.actual_start_at) {
        delayMinutes = (new Date(match.actual_start_at).getTime() - scheduledMs) / 60000
      } else if (UNSTARTED_TARGET_STATUSES.has(match.status) && scheduledMs < nowMs) {
        delayMinutes = (nowMs - scheduledMs) / 60000
      } else {
        continue
      }

      if (delayMinutes < MIN_DELAY_MINUTES) continue

      // The most recent delay source on this court is what matters - an earlier match's delay is
      // presumed already absorbed into whatever happened after it.
      if (!bestSource || scheduledMs > new Date(bestSource.match.scheduled_start_at as string).getTime()) {
        bestSource = { match, delayMinutes }
      }
    }

    if (!bestSource) continue

    const sourceScheduledMs = new Date(bestSource.match.scheduled_start_at as string).getTime()
    const shiftMinutes = roundUpToStep(bestSource.delayMinutes, ROUND_TO_MINUTES)
    const shiftMs = shiftMinutes * 60000

    const downstream: DownstreamSuggestion[] = courtMatches
      .filter((match) => {
        if (match.id === bestSource!.match.id) return false
        if (!match.scheduled_start_at || !RESCHEDULABLE_STATUSES.has(match.status)) return false
        return new Date(match.scheduled_start_at).getTime() > sourceScheduledMs
      })
      .sort((a, b) => new Date(a.scheduled_start_at as string).getTime() - new Date(b.scheduled_start_at as string).getTime())
      .map((match) => {
        const start = new Date(match.scheduled_start_at as string).getTime() + shiftMs
        const end = match.scheduled_end_at
          ? new Date(match.scheduled_end_at).getTime() + shiftMs
          : start
        return {
          match,
          suggestedStartAt: new Date(start).toISOString(),
          suggestedEndAt: new Date(end).toISOString(),
        }
      })

    if (downstream.length === 0) continue

    impacts.push({
      courtKey,
      sourceMatch: bestSource.match,
      delayMinutes: shiftMinutes,
      downstream,
    })
  }

  return impacts.sort((a, b) => b.delayMinutes - a.delayMinutes)
}
