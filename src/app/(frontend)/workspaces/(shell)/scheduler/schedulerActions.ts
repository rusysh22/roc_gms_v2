'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { getActiveEvent } from '../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../workspaceAuth'
import { detectScheduleConflicts } from './conflicts'
import type { WorkspaceMatch } from '../../workspaceComponents'

const text = (data: FormData, key: string) => {
  const value = data.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
const scheduleReturn = '/workspaces/scheduler'
const scheduleStates = new Set(['draft', 'ready_for_scheduling', 'scheduled'])

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
  const created = await payload.create({ collection: 'matches', data: { event_id: event.id, sport_id: sportId, category_id: categoryId, participant_a_entry_id: participantA, participant_b_entry_id: participantB, venue_id: venueId, court_id: courtId, match_number: matchNumber, scheduled_start_at: start, scheduled_end_at: end, status, is_public: text(formData, 'isPublic') === 'on', generation_source: 'manual', generation_key: `manual-${event.id}-${matchNumber}`, documentation_status: 'not_started' } })
  await recordAuditLog({ payload, action: 'schedule.match_create', entityType: 'matches', entityId: created.id, before: null, after: { match_number: matchNumber, scheduled_start_at: start, scheduled_end_at: end, reason: 'manual schedule creation' }, actorUserId: user.id })
  refreshSchedule(); redirect(`${scheduleReturn}?scheduleCreated=1`)
}

export async function rescheduleMatchAction(formData: FormData): Promise<void> {
  const matchNumber = text(formData, 'matchNumber'); const reason = text(formData, 'reason')
  const start = dateValue(text(formData, 'scheduledStart')); const end = dateValue(text(formData, 'scheduledEnd')); const venueId = text(formData, 'venueId'); const courtId = text(formData, 'courtId')
  if (!matchNumber || !reason || !start || !end || new Date(end) <= new Date(start) || !venueId || !courtId) redirect(`${scheduleReturn}?scheduleError=invalid_reschedule`)
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.scheduler, returnTo: scheduleReturn })
  const result = await payload.find({ collection: 'matches', depth: 2, limit: 1, where: { match_number: { equals: matchNumber } } }); const match = result.docs[0] as WorkspaceMatch | undefined
  if (!match || !scheduleStates.has(match.status)) redirect(`${scheduleReturn}?scheduleError=reschedule_not_allowed`)
  const court = await payload.findByID({ collection: 'courts', id: courtId, depth: 0 }) as { venue_id?: string | number }
  if (String(court.venue_id) !== venueId) redirect(`${scheduleReturn}?scheduleError=invalid_relationship`)
  const all = await payload.find({ collection: 'matches', depth: 2, limit: 500 })
  const candidate = { ...match, id: 'candidate', scheduled_start_at: start, scheduled_end_at: end, venue_id: venueId, court_id: courtId }
  if (detectScheduleConflicts([...all.docs.filter((item) => item.id !== match.id) as WorkspaceMatch[], candidate]).some((warning) => warning.matchIds.includes('candidate') && warning.severity === 'alert')) redirect(`${scheduleReturn}?scheduleError=conflict`)
  const before = { scheduled_start_at: match.scheduled_start_at || null, scheduled_end_at: match.scheduled_end_at || null, venue_id: match.venue_id || null, court_id: match.court_id || null }
  await payload.update({ collection: 'matches', id: match.id, data: { scheduled_start_at: start, scheduled_end_at: end, venue_id: venueId, court_id: courtId } })
  await recordAuditLog({ payload, action: 'schedule.match_reschedule', entityType: 'matches', entityId: match.id, before, after: { scheduled_start_at: start, scheduled_end_at: end, venue_id: venueId, court_id: courtId, reason }, actorUserId: user.id })
  refreshSchedule(); redirect(`${scheduleReturn}?scheduleRescheduled=1`)
}
