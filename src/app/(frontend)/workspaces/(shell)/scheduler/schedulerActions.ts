'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { postMatchAnnouncement } from '@/lib/matchNotifications'
import {
  parseScheduleDateTime,
  parseScheduleImportWorkbook,
  type ScheduleImportRow,
  type ScheduleImportRowOutcome,
} from '@/lib/scheduleImport'
import { resolveEventTimezone } from '@/lib/timezone'
import { getActiveEvent } from '../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../workspaceAuth'
import { recalculateResultCachesBestEffort } from '../../matches/matchActions'
import { MATCH_TRANSITIONS, PUBLIC_STATUS_NOTICES, isValidTransition } from '../../matches/matchLifecycle'
import { detectScheduleConflicts } from './conflicts'
import { formatDateTime, getRelationshipId, type RelationshipDoc, type WorkspaceMatch } from '../../workspaceComponents'

const text = (data: FormData, key: string) => {
  const value = data.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
const scheduleReturn = '/workspaces/scheduler'
// Only the statuses a NEW match can be manually created with (AddMatchDialog's Status <select>
// never offers "postponed" as a starting state - creating a match that starts postponed makes no
// sense).
const scheduleStates = new Set(['draft', 'ready_for_scheduling', 'scheduled'])
// NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15.4: which EXISTING match statuses can be
// rescheduled - separate from `scheduleStates` above because this is a different question
// (can this match's time move?) that happens to include one more status (postponed) than
// (what status can a brand-new match start in?).
//
// 'published' included deliberately (unlike check_in_open/ready_to_start, which stay excluded -
// a match that's already checking in or about to start is a materially different risk than one
// that's simply upcoming): live-tournament testing found 28% of a real event's matches sitting in
// 'published' with no way to nudge their time short of Postpone-then-Reschedule, which fires a
// public "postponed" banner for what might just be a same-day court swap, then a second "schedule
// change" announcement once the real new time goes in. Rescheduling 'published' directly still
// posts that one accurate announcement (rescheduleMatchAction always does, regardless of prior
// status) - it just stops requiring the misleading detour to get there.
const reschedulableFromStates = new Set(['draft', 'ready_for_scheduling', 'scheduled', 'published', 'postponed'])

const dateValue = (value: string) => {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

const assertRelationship = async (
  payload: Awaited<ReturnType<typeof assertWorkspaceActionAccess>>['payload'],
  collection: 'sports' | 'competition-categories' | 'competition-entries' | 'venues' | 'courts',
  id: string,
  eventId: string | number,
) => {
  const document = await payload.findByID({ collection, id, depth: 0 }) as { event_id?: string | number; category_id?: string | number; venue_id?: string | number }
  if (String(document.event_id) !== String(eventId)) throw new Error('invalid_relationship')
  return document
}

const refreshSchedule = () => {
  revalidatePath(scheduleReturn)
  revalidatePath('/schedule')
}

export async function createScheduledMatchAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.scheduler, returnTo: scheduleReturn })
  const event = await getActiveEvent(payload)
  const sportId = text(formData, 'sportId'); const categoryId = text(formData, 'categoryId')
  const participantA = text(formData, 'participantA'); const participantB = text(formData, 'participantB')
  const venueId = text(formData, 'venueId'); const courtId = text(formData, 'courtId')
  const start = dateValue(text(formData, 'scheduledStart')); const end = dateValue(text(formData, 'scheduledEnd'))
  const matchNumber = text(formData, 'matchNumber').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
  const status = text(formData, 'status') || 'scheduled'
  if (!event || !sportId || !categoryId || !participantA || !participantB || participantA === participantB || !venueId || !courtId || !start || !end || new Date(end) <= new Date(start) || !matchNumber || !scheduleStates.has(status)) redirect(`${scheduleReturn}?scheduleError=invalid_match`)
  try {
    const [sport, category, entryA, entryB, venue, court, sameNumber] = await Promise.all([
      assertRelationship(payload, 'sports', sportId, event.id), assertRelationship(payload, 'competition-categories', categoryId, event.id),
      assertRelationship(payload, 'competition-entries', participantA, event.id), assertRelationship(payload, 'competition-entries', participantB, event.id),
      assertRelationship(payload, 'venues', venueId, event.id), assertRelationship(payload, 'courts', courtId, event.id),
      payload.find({ collection: 'matches', depth: 0, limit: 1, where: { match_number: { equals: matchNumber } } }),
    ])
    if (String(category.event_id) !== String(event.id) || String(entryA.category_id) !== categoryId || String(entryB.category_id) !== categoryId || String(court.venue_id) !== venueId || sameNumber.totalDocs) throw new Error('invalid_relationship')
    void sport; void venue
  } catch {
    redirect(`${scheduleReturn}?scheduleError=invalid_relationship`)
  }
  const all = await payload.find({ collection: 'matches', depth: 2, limit: 500 })
  const candidate: WorkspaceMatch = { id: 'candidate', match_number: matchNumber, status, scheduled_start_at: start, scheduled_end_at: end, participant_a_entry_id: participantA, participant_b_entry_id: participantB, venue_id: venueId, court_id: courtId }
  if (detectScheduleConflicts([...all.docs as WorkspaceMatch[], candidate]).some((warning) => warning.matchIds.includes('candidate') && warning.severity === 'alert')) redirect(`${scheduleReturn}?scheduleError=conflict`)
  const created = await payload.create({ collection: 'matches', data: { event_id: Number(event.id), sport_id: Number(sportId), category_id: Number(categoryId), participant_a_entry_id: Number(participantA), participant_b_entry_id: Number(participantB), venue_id: Number(venueId), court_id: Number(courtId), match_number: matchNumber, scheduled_start_at: start, scheduled_end_at: end, status: status as 'draft' | 'ready_for_scheduling' | 'scheduled', is_public: text(formData, 'isPublic') === 'on', generation_source: 'manual', generation_key: `manual-${event.id}-${matchNumber}`, documentation_status: 'not_started' } })
  await recordAuditLog({ payload, action: 'schedule.match_create', entityType: 'matches', entityId: created.id, before: null, after: { match_number: matchNumber, scheduled_start_at: start, scheduled_end_at: end, reason: 'manual schedule creation' }, actorUserId: user.id })
  refreshSchedule(); redirect(`${scheduleReturn}?scheduleCreated=1`)
}

export async function rescheduleMatchAction(formData: FormData): Promise<void> {
  const matchNumber = text(formData, 'matchNumber'); const reason = text(formData, 'reason')
  const start = dateValue(text(formData, 'scheduledStart')); const end = dateValue(text(formData, 'scheduledEnd')); const venueId = text(formData, 'venueId'); const courtId = text(formData, 'courtId')
  if (!matchNumber || !reason || !start || !end || new Date(end) <= new Date(start) || !venueId || !courtId) redirect(`${scheduleReturn}?scheduleError=invalid_reschedule`)
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.scheduler, returnTo: scheduleReturn })
  const result = await payload.find({ collection: 'matches', depth: 2, limit: 1, where: { match_number: { equals: matchNumber } } }); const match = result.docs[0] as WorkspaceMatch | undefined
  if (!match || !reschedulableFromStates.has(match.status)) redirect(`${scheduleReturn}?scheduleError=reschedule_not_allowed`)
  const court = await payload.findByID({ collection: 'courts', id: courtId, depth: 0 }) as { venue_id?: string | number }
  if (String(court.venue_id) !== venueId) redirect(`${scheduleReturn}?scheduleError=invalid_relationship`)
  const all = await payload.find({ collection: 'matches', depth: 2, limit: 500 })
  const candidate = { ...match, id: 'candidate', scheduled_start_at: start, scheduled_end_at: end, venue_id: venueId, court_id: courtId }
  if (detectScheduleConflicts([...all.docs.filter((item) => item.id !== match.id) as WorkspaceMatch[], candidate]).some((warning) => warning.matchIds.includes('candidate') && warning.severity === 'alert')) redirect(`${scheduleReturn}?scheduleError=conflict`)
  const before = { status: match.status, scheduled_start_at: match.scheduled_start_at || null, scheduled_end_at: match.scheduled_end_at || null, venue_id: match.venue_id || null, court_id: match.court_id || null }
  // A postponed match confirmed onto a new time is "Rescheduled - new time confirmed," not still
  // "Postponed - new time pending" (section 15.4's explicit public-page distinction) - flipping
  // status back to scheduled here is what actually resolves the postponement, not just filling in
  // a date field while the badge keeps reading "Postponed."
  const isRecoveringFromPostponed = match.status === 'postponed'
  // AUDIT_UI_UX_CSS: enforceMatchMutationCapabilities (src/access/roles.ts) needs req.user to
  // check the scheduleMatch capability - without `user` here, every reschedule (not just the
  // postponed-recovery path) threw Forbidden unconditionally, for every role.
  await payload.update({ collection: 'matches', id: Number(match.id), data: { scheduled_start_at: start, scheduled_end_at: end, venue_id: Number(venueId), court_id: Number(courtId), ...(isRecoveringFromPostponed ? { status: 'scheduled' as const } : {}) }, user })
  await recordAuditLog({ payload, action: 'schedule.match_reschedule', entityType: 'matches', entityId: match.id, before, after: { status: isRecoveringFromPostponed ? 'scheduled' : match.status, scheduled_start_at: start, scheduled_end_at: end, venue_id: venueId, court_id: courtId, reason }, actorUserId: user.id })
  const eventId = getRelationshipId(match.event_id)
  if (eventId) {
    const eventDoc = await payload.findByID({ collection: 'events', id: eventId, depth: 0 }).catch(() => null)
    const timezone = resolveEventTimezone(eventDoc?.timezone)
    await postMatchAnnouncement({
      payload,
      eventId,
      categoryId: getRelationshipId(match.category_id),
      matchId: match.id,
      matchNumber,
      title: `Schedule change: ${matchNumber}`,
      summary: `${matchNumber} has a new time: ${formatDateTime(start, timezone)}–${formatDateTime(end, timezone)}. Reason: ${reason}`,
      urgency: 'schedule_change',
    })
  }
  refreshSchedule(); redirect(`${scheduleReturn}?scheduleRescheduled=1`)
}

const importReturn = '/workspaces/scheduler/import'
const MAX_IMPORT_RESULTS_IN_URL = 60
// Deliberately restricted to the four statuses a schedule adjustment actually needs - starting a
// live match or publishing a result needs real-time score entry, which stays in the Match Officer
// workspace, not a spreadsheet.
const IMPORT_TARGET_STATUSES = new Set(['scheduled', 'postponed', 'cancelled', 'walkover'])

// Live testing on a 105-row sheet with only 3 non-trivial rows (2 updated, 1 error) found every
// one of them pushed past the cap by the ~100 no-op 'skipped' rows ahead of them in spreadsheet
// order - the summary banner's counts were accurate, but the row-by-row table nobody could see the
// rows those counts referred to. Sorting error/updated first means the rows an admin actually needs
// to check are the ones guaranteed to survive the cap; 'skipped' rows are the least useful to see
// (nothing happened) and are the ones dropped first.
const OUTCOME_PRIORITY: Record<ScheduleImportRowOutcome['outcome'], number> = { error: 0, updated: 1, skipped: 2 }
const encodeImportResults = (results: ScheduleImportRowOutcome[]) => {
  const prioritized = [...results].sort((a, b) => OUTCOME_PRIORITY[a.outcome] - OUTCOME_PRIORITY[b.outcome])
  return {
    resultsParam: prioritized.length > 0 ? encodeURIComponent(JSON.stringify(prioritized.slice(0, MAX_IMPORT_RESULTS_IN_URL))) : '',
    moreResults: prioritized.length > MAX_IMPORT_RESULTS_IN_URL ? prioritized.length - MAX_IMPORT_RESULTS_IN_URL : 0,
  }
}

type ImportMatch = WorkspaceMatch & {
  stage_id?: WorkspaceMatch['participant_a_entry_id']
  group_id?: WorkspaceMatch['participant_a_entry_id']
}

// Bulk counterpart to rescheduleMatchAction/transitionMatchStatusAction (matchActions.ts) above -
// reuses the exact same validated logic per row (reschedulableFromStates, detectScheduleConflicts,
// isValidTransition + requiresWinnerSelection, recalculateResultCachesBestEffort,
// postMatchAnnouncement) instead of a parallel bulk-only code path, so a spreadsheet edit can never
// do something the single-match UI wouldn't also validate.
export async function applyScheduleImportAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.scheduler, returnTo: importReturn })
  const event = await getActiveEvent(payload)
  if (!event) redirect(`${importReturn}?importError=missing_event`)

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) redirect(`${importReturn}?importError=invalid_file`)

  let rows: ScheduleImportRow[]
  try {
    rows = parseScheduleImportWorkbook(await file.arrayBuffer())
  } catch {
    redirect(`${importReturn}?importError=invalid_file`)
  }
  if (rows.length === 0) redirect(`${importReturn}?importError=empty_import`)

  const timezone = resolveEventTimezone(event.timezone)

  const [matchesResult, venuesResult, courtsResult] = await Promise.all([
    payload.find({ collection: 'matches', depth: 2, limit: 1000, where: { event_id: { equals: event.id } } }),
    payload.find({ collection: 'venues', depth: 0, limit: 200, where: { event_id: { equals: event.id } } }),
    payload.find({ collection: 'courts', depth: 0, limit: 500, where: { event_id: { equals: event.id } } }),
  ])

  const matches = matchesResult.docs as ImportMatch[]
  const matchesByNumber = new Map(matches.map((match) => [match.match_number, match]))
  const venueByName = new Map(
    (venuesResult.docs as { id: string | number; name: string }[]).map((venue) => [venue.name.trim().toLowerCase(), venue]),
  )
  const courtsByVenue = new Map<string, { id: string | number; name: string }[]>()
  for (const court of courtsResult.docs as { id: string | number; name: string; venue_id: RelationshipDoc | string | number | null }[]) {
    const venueId = getRelationshipId(court.venue_id)
    if (!venueId) continue
    const list = courtsByVenue.get(venueId) || []
    list.push({ id: court.id, name: court.name })
    courtsByVenue.set(venueId, list)
  }

  // Mutated as rows apply, so a conflict check for row N sees row N-1's already-applied move too -
  // not just what was in the database before the whole import started.
  const workingMatches = new Map<string, WorkspaceMatch>(matches.map((match) => [String(match.id), { ...match }]))

  const processRow = async (row: ScheduleImportRow): Promise<ScheduleImportRowOutcome> => {
    const match = matchesByNumber.get(row.matchNumber)
    if (!match) {
      return { matchNumber: row.matchNumber || '(blank)', outcome: 'error', message: 'Match number not found in this event' }
    }

    const wantsReschedule = Boolean(row.newStart || row.newEnd || row.newVenue || row.newCourt)
    const wantsStatusChange = Boolean(row.newStatus)

    if (!wantsReschedule && !wantsStatusChange) {
      return { matchNumber: row.matchNumber, outcome: 'skipped', message: 'No New Start/End/Venue/Court/Status filled in' }
    }

    const actions: string[] = []

    if (wantsReschedule) {
      if (!reschedulableFromStates.has(match.status)) {
        return { matchNumber: row.matchNumber, outcome: 'error', message: `Cannot reschedule a match with status "${match.status}"` }
      }
      if (!row.newStart || !row.newEnd || !row.newVenue || !row.newCourt) {
        return { matchNumber: row.matchNumber, outcome: 'error', message: 'Rescheduling needs New Start, New End, New Venue, and New Court all filled in together' }
      }
      const start = parseScheduleDateTime(row.newStart, timezone)
      const end = parseScheduleDateTime(row.newEnd, timezone)
      if (!start || !end) {
        return { matchNumber: row.matchNumber, outcome: 'error', message: 'New Start / New End must look like "YYYY-MM-DD HH:mm"' }
      }
      if (new Date(end).getTime() <= new Date(start).getTime()) {
        return { matchNumber: row.matchNumber, outcome: 'error', message: 'New End must be after New Start' }
      }
      const venue = venueByName.get(row.newVenue.trim().toLowerCase())
      if (!venue) {
        return { matchNumber: row.matchNumber, outcome: 'error', message: `Venue "${row.newVenue}" not found for this event` }
      }
      const court = (courtsByVenue.get(String(venue.id)) || []).find(
        (candidate) => candidate.name.trim().toLowerCase() === row.newCourt.trim().toLowerCase(),
      )
      if (!court) {
        return { matchNumber: row.matchNumber, outcome: 'error', message: `Court "${row.newCourt}" not found at venue "${row.newVenue}"` }
      }

      const candidate: WorkspaceMatch = {
        ...match,
        id: 'candidate',
        scheduled_start_at: start,
        scheduled_end_at: end,
        venue_id: venue.id,
        court_id: court.id,
      }
      const others = Array.from(workingMatches.values()).filter((item) => String(item.id) !== String(match.id))
      if (
        detectScheduleConflicts([...others, candidate]).some(
          (warning) => warning.matchIds.includes('candidate') && warning.severity === 'alert',
        )
      ) {
        return { matchNumber: row.matchNumber, outcome: 'error', message: 'Conflicts with another match at that venue/court/time' }
      }

      const before = {
        status: match.status,
        scheduled_start_at: match.scheduled_start_at || null,
        scheduled_end_at: match.scheduled_end_at || null,
        venue_id: getRelationshipId(match.venue_id) || null,
        court_id: getRelationshipId(match.court_id) || null,
      }
      // Same auto-recovery rule as the single-match reschedule action above: a postponed match
      // confirmed onto a new time is "Rescheduled," not still "Postponed."
      const isRecoveringFromPostponed = match.status === 'postponed'
      const rescheduleData: Record<string, unknown> = {
        scheduled_start_at: start,
        scheduled_end_at: end,
        venue_id: Number(venue.id),
        court_id: Number(court.id),
      }
      if (isRecoveringFromPostponed) {
        rescheduleData.status = 'scheduled'
      }

      await payload.update({ collection: 'matches', id: match.id, data: rescheduleData, user })
      await recordAuditLog({
        payload,
        action: 'schedule.match_reschedule',
        entityType: 'matches',
        entityId: match.id,
        before,
        after: {
          status: isRecoveringFromPostponed ? 'scheduled' : match.status,
          scheduled_start_at: start,
          scheduled_end_at: end,
          venue_id: venue.id,
          court_id: court.id,
          reason: row.reason || 'Bulk Excel import',
        },
        actorUserId: user.id,
      })

      match.status = isRecoveringFromPostponed ? 'scheduled' : match.status
      match.scheduled_start_at = start
      match.scheduled_end_at = end
      match.venue_id = venue.id
      match.court_id = court.id
      workingMatches.set(String(match.id), { ...match })

      await postMatchAnnouncement({
        payload,
        eventId: event.id,
        categoryId: getRelationshipId(match.category_id),
        matchId: match.id,
        matchNumber: row.matchNumber,
        title: `Schedule change: ${row.matchNumber}`,
        summary: `${row.matchNumber} has a new time: ${formatDateTime(start, timezone)}–${formatDateTime(end, timezone)}. Reason: ${row.reason || 'Bulk Excel import'}`,
        urgency: 'schedule_change',
      })
      actions.push('rescheduled')
    }

    if (wantsStatusChange) {
      const targetStatus = row.newStatus.trim().toLowerCase()
      if (!IMPORT_TARGET_STATUSES.has(targetStatus)) {
        return {
          matchNumber: row.matchNumber,
          outcome: 'error',
          message: `${actions.length ? 'Rescheduled, but s' : 'S'}tatus "${row.newStatus}" is not one of scheduled/postponed/cancelled/walkover`,
        }
      }
      if (!isValidTransition(match.status, targetStatus)) {
        return {
          matchNumber: row.matchNumber,
          outcome: 'error',
          message: `${actions.length ? 'Rescheduled, but c' : 'C'}annot change status from "${match.status}" to "${targetStatus}"`,
        }
      }

      const transition = MATCH_TRANSITIONS.find(
        (candidate) => candidate.from.includes(match.status) && candidate.to === targetStatus,
      )
      const updateData: Record<string, unknown> = { status: targetStatus }

      if (transition?.requiresWinnerSelection) {
        const winnerEntryId =
          row.winner === 'A'
            ? getRelationshipId(match.participant_a_entry_id)
            : row.winner === 'B'
              ? getRelationshipId(match.participant_b_entry_id)
              : ''
        if (!winnerEntryId) {
          return {
            matchNumber: row.matchNumber,
            outcome: 'error',
            message: `${actions.length ? 'Rescheduled, but s' : 'S'}tatus "${targetStatus}" needs Winner (A/B) filled in`,
          }
        }
        updateData.winner_entry_id = Number(winnerEntryId)
      }

      const beforeSnapshot = {
        status: match.status,
        winner_entry_id: getRelationshipId((match as ImportMatch).winner_entry_id) || null,
      }

      await payload.update({ collection: 'matches', id: match.id, data: updateData, user })
      await recordAuditLog({
        payload,
        action: 'match.status_transition',
        entityType: 'matches',
        entityId: match.id,
        before: beforeSnapshot,
        after: { ...beforeSnapshot, ...updateData, reason: row.reason || 'Bulk Excel import' },
        actorUserId: user.id,
      })

      await recalculateResultCachesBestEffort({
        payload,
        match: {
          id: match.id,
          event_id: getRelationshipId(match.event_id) || undefined,
          category_id: getRelationshipId(match.category_id) || undefined,
          stage_id: getRelationshipId((match as ImportMatch).stage_id) || undefined,
          group_id: getRelationshipId((match as ImportMatch).group_id) || undefined,
          status: targetStatus,
          participant_a_entry_id: getRelationshipId(match.participant_a_entry_id) || undefined,
          participant_b_entry_id: getRelationshipId(match.participant_b_entry_id) || undefined,
          winner_entry_id: updateData.winner_entry_id
            ? String(updateData.winner_entry_id)
            : getRelationshipId((match as ImportMatch).winner_entry_id) || undefined,
        },
        matchNumber: row.matchNumber,
        action: 'match.status_transition',
        actorUserId: user.id,
      })

      const notice = PUBLIC_STATUS_NOTICES[targetStatus]
      if (notice) {
        await postMatchAnnouncement({
          payload,
          eventId: event.id,
          categoryId: getRelationshipId(match.category_id),
          matchId: match.id,
          matchNumber: row.matchNumber,
          title: `${row.matchNumber} ${notice.label}`,
          summary: `${row.matchNumber} was ${notice.label}.`,
          urgency: notice.urgency,
          displayMode: notice.displayMode,
        })
      }

      match.status = targetStatus
      workingMatches.set(String(match.id), { ...match })
      actions.push(`status set to ${targetStatus}`)
    }

    return { matchNumber: row.matchNumber, outcome: 'updated', message: actions.join('; ') }
  }

  const results: ScheduleImportRowOutcome[] = []
  for (const row of rows) {
    results.push(await processRow(row))
  }

  refreshSchedule()
  const updatedCount = results.filter((result) => result.outcome === 'updated').length
  const errorCount = results.filter((result) => result.outcome === 'error').length
  const { resultsParam, moreResults } = encodeImportResults(results)
  redirect(
    `${importReturn}?importDone=1&importUpdated=${updatedCount}&importErrors=${errorCount}` +
      (resultsParam ? `&importResults=${resultsParam}` : '') +
      (moreResults ? `&importMoreResults=${moreResults}` : ''),
  )
}
