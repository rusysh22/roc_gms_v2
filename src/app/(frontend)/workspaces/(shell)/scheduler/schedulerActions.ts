'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { postMatchAnnouncement } from '@/lib/matchNotifications'
import { resolveEventTimezone } from '@/lib/timezone'
import { getActiveEvent } from '../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../workspaceAuth'
import { detectScheduleConflicts } from './conflicts'
import { formatDateTime, getRelationshipId, type WorkspaceMatch } from '../../workspaceComponents'

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
const reschedulableFromStates = new Set(['draft', 'ready_for_scheduling', 'scheduled', 'postponed'])

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
