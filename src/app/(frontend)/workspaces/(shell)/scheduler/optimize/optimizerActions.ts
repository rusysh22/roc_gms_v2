'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import type { WorkspaceMatch } from '../../../workspaceComponents'
import { detectScheduleConflicts } from '../conflicts'

const returnTo = '/workspaces/scheduler/optimize'

type ProposedAssignment = { matchId: string; venueId: string; courtId: string; start: string; end: string }

// The optimizer page only ever *proposes* placements (src/lib/scheduleOptimizer.ts computes
// nothing to disk) - this is the one place a proposal actually gets written, and it re-validates
// every candidate against the live database rather than trusting the form payload: a match may
// already have been scheduled by someone else, or by an earlier row in this same batch, since the
// proposal was generated. Conflicts are re-checked with the exact same detectScheduleConflicts
// used by manual create/reschedule, so a bulk-applied schedule can never bypass the guarantees a
// single-match schedule already has.
export async function applyOptimizerPlanAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.scheduler, returnTo })
  const event = await getActiveEvent(payload)
  if (!event) {
    redirect(`${returnTo}?optimizerError=invalid_request`)
  }

  const count = Number(formData.get('count') || 0)
  const candidates: ProposedAssignment[] = []
  for (let i = 0; i < count; i += 1) {
    if (formData.get(`apply_${i}`) !== 'on') continue
    const matchId = String(formData.get(`matchId_${i}`) || '')
    const venueId = String(formData.get(`venueId_${i}`) || '')
    const courtId = String(formData.get(`courtId_${i}`) || '')
    const start = String(formData.get(`start_${i}`) || '')
    const end = String(formData.get(`end_${i}`) || '')
    if (matchId && venueId && courtId && start && end) {
      candidates.push({ matchId, venueId, courtId, start, end })
    }
  }

  if (candidates.length === 0) {
    redirect(`${returnTo}?optimizerError=invalid_request`)
  }

  const allMatchesResult = await payload.find({
    collection: 'matches',
    depth: 2,
    limit: 2000,
    where: { event_id: { equals: event!.id } },
  })
  // Mutated in place as candidates are accepted, so a later candidate in this same batch sees the
  // slot an earlier one just took (the DB itself is only updated one match at a time below, but
  // detectScheduleConflicts needs the whole in-progress picture, not just what's already committed).
  const runningMatches = allMatchesResult.docs as WorkspaceMatch[]

  let appliedCount = 0
  let skippedCount = 0

  for (const candidate of candidates) {
    const matchIndex = runningMatches.findIndex((item) => String(item.id) === candidate.matchId)
    const match = matchIndex >= 0 ? runningMatches[matchIndex] : undefined

    if (!match || match.scheduled_start_at) {
      skippedCount += 1
      continue
    }

    const court = await payload.findByID({ collection: 'courts', id: candidate.courtId, depth: 0 }).catch(() => null)
    if (!court || String(court.event_id) !== String(event!.id) || String(court.venue_id) !== candidate.venueId) {
      skippedCount += 1
      continue
    }

    const candidateForConflictCheck: WorkspaceMatch = {
      ...match,
      id: 'candidate',
      scheduled_start_at: candidate.start,
      scheduled_end_at: candidate.end,
      venue_id: candidate.venueId,
      court_id: candidate.courtId,
      status: 'scheduled',
    }
    const others = runningMatches.filter((item) => String(item.id) !== candidate.matchId)
    const conflicts = detectScheduleConflicts([...others, candidateForConflictCheck])
    if (conflicts.some((warning) => warning.matchIds.includes('candidate') && warning.severity === 'alert')) {
      skippedCount += 1
      continue
    }

    const before = {
      status: match.status,
      scheduled_start_at: match.scheduled_start_at || null,
      scheduled_end_at: match.scheduled_end_at || null,
      venue_id: match.venue_id || null,
      court_id: match.court_id || null,
    }

    await payload.update({
      collection: 'matches',
      id: Number(match.id),
      data: {
        scheduled_start_at: candidate.start,
        scheduled_end_at: candidate.end,
        venue_id: Number(candidate.venueId),
        court_id: Number(candidate.courtId),
        // A generator leaves new matches as draft/ready_for_scheduling - now that they have a
        // real slot, "scheduled" is what every other schedule-aware check (missing_schedule_fields,
        // public schedule display) expects.
        status: 'scheduled',
      },
      user,
    })
    await recordAuditLog({
      payload,
      action: 'schedule.optimizer_apply',
      entityType: 'matches',
      entityId: match.id,
      before,
      after: {
        status: 'scheduled',
        scheduled_start_at: candidate.start,
        scheduled_end_at: candidate.end,
        venue_id: candidate.venueId,
        court_id: candidate.courtId,
      },
      actorUserId: user.id,
    })

    runningMatches[matchIndex] = {
      ...match,
      status: 'scheduled',
      scheduled_start_at: candidate.start,
      scheduled_end_at: candidate.end,
      venue_id: candidate.venueId,
      court_id: candidate.courtId,
    }
    appliedCount += 1
  }

  revalidatePath('/workspaces/scheduler')
  revalidatePath(returnTo)
  revalidatePath('/schedule')
  redirect(`${returnTo}?optimizerApplied=${appliedCount}&optimizerSkipped=${skippedCount}`)
}
