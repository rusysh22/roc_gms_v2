'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { cookies } from 'next/headers'

import { recordAuditLog } from '@/lib/audit'
import { deleteEventCascade, eventIsAbandonable } from '@/lib/cascadeDelete'
import { DEFAULT_EVENT_TIMEZONE, EVENT_TIMEZONE_OPTIONS } from '@/lib/timezone'
import { ACTIVE_EVENT_COOKIE, getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/event-admin/details'
const text = (form: FormData, key: string) =>
  typeof form.get(key) === 'string' ? String(form.get(key)).trim() : ''
const statuses = new Set(['draft', 'setup', 'coming_soon', 'live', 'completed', 'archived'])
const visibilities = new Set(['hidden', 'coming_soon', 'preview_only', 'published', 'archived'])
const timezones = new Set<string>(EVENT_TIMEZONE_OPTIONS.map((option) => option.value))
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
const toIso = (value: string) => (value ? new Date(value).toISOString() : undefined)

export async function updateEventDetailsAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: page,
  })
  const event = await getActiveEvent(payload)
  if (!event) {
    redirect(`${page}?detailsError=missing_event`)
  }

  const name = text(formData, 'name')
  const slug = slugify(text(formData, 'slug') || name)
  const start = text(formData, 'eventStart')
  const end = text(formData, 'eventEnd')
  const status = text(formData, 'status')
  const visibility = text(formData, 'visibility')

  if (!name || !slug || !start || !end || !statuses.has(status) || !visibilities.has(visibility)) {
    redirect(`${page}?detailsError=invalid_event`)
  }
  if (new Date(end).getTime() <= new Date(start).getTime()) {
    redirect(`${page}?detailsError=invalid_date_range`)
  }

  const duplicate = await payload.find({
    collection: 'events',
    depth: 0,
    limit: 10,
    where: { slug: { equals: slug } },
  })
  if (duplicate.docs.some((doc) => String(doc.id) !== String(event.id))) {
    redirect(`${page}?detailsError=duplicate_slug`)
  }

  const timezoneInput = text(formData, 'timezone')
  const timezone = timezones.has(timezoneInput) ? timezoneInput : DEFAULT_EVENT_TIMEZONE
  const medalRankingMethodInput = text(formData, 'medalRankingMethod')
  const medalRankingMethod =
    medalRankingMethodInput === 'weighted_points' ? 'weighted_points' : 'gold_first'
  const toNonNegativeInt = (value: string, fallback: number) => {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
  }

  const data = {
    name,
    slug,
    description: text(formData, 'description') || undefined,
    location: text(formData, 'location') || undefined,
    organizer_name: text(formData, 'organizerName') || undefined,
    rules_summary: text(formData, 'rulesSummary') || undefined,
    event_start_at: new Date(start).toISOString(),
    event_end_at: new Date(end).toISOString(),
    timezone: timezone as (typeof EVENT_TIMEZONE_OPTIONS)[number]['value'],
    public_open_at: toIso(text(formData, 'publicOpenAt')),
    registration_open_at: toIso(text(formData, 'registrationOpenAt')),
    registration_close_at: toIso(text(formData, 'registrationCloseAt')),
    schedule_publish_at: toIso(text(formData, 'schedulePublishAt')),
    archive_at: toIso(text(formData, 'archiveAt')),
    status: status as 'draft' | 'setup' | 'coming_soon' | 'live' | 'completed' | 'archived',
    visibility: visibility as 'hidden' | 'coming_soon' | 'preview_only' | 'published' | 'archived',
    medal_tally_enabled: formData.get('medalTallyEnabled') === 'on',
    medal_ranking_method: medalRankingMethod as 'gold_first' | 'weighted_points',
    medal_points_gold: toNonNegativeInt(text(formData, 'medalPointsGold'), 3),
    medal_points_silver: toNonNegativeInt(text(formData, 'medalPointsSilver'), 2),
    medal_points_bronze: toNonNegativeInt(text(formData, 'medalPointsBronze'), 1),
  }

  const before = await payload.findByID({ collection: 'events', id: event.id, depth: 0 })
  await payload.update({ collection: 'events', id: event.id, data })
  await recordAuditLog({
    payload,
    action: 'event.update',
    entityType: 'events',
    entityId: event.id,
    before,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(page)
  revalidatePath('/workspaces/event-admin')
  revalidatePath(`/events/${slug}`)
  redirect(`${page}?detailsUpdated=1`)
}

// Abandon a draft event: permanently deletes it and every record scoped to it (sports, categories,
// entries, clubs/teams/players/rosters, venues/courts, rulesets, memberships, sponsors, scoped
// content). Only allowed while the event is still `draft` and has no matches - once real
// scheduling/scoring exists it must be archived, not deleted.
export async function deleteEventAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: page,
  })
  const event = await getActiveEvent(payload)
  const confirmName = text(formData, 'confirmName')
  if (!event) {
    redirect(`${page}?detailsError=missing_event`)
  }
  if (confirmName !== event!.name) {
    redirect(`${page}?detailsError=confirm_name_mismatch`)
  }

  const abandonable = await eventIsAbandonable(payload, event!.id)
  if (!abandonable.ok) {
    redirect(`${page}?detailsError=event_not_abandonable`)
  }

  const before = await payload.findByID({ collection: 'events', id: event!.id, depth: 0 }).catch(() => null)
  await deleteEventCascade(payload, event!.id)
  await recordAuditLog({
    payload,
    action: 'event.delete',
    entityType: 'events',
    entityId: event!.id,
    before,
    after: null,
    actorUserId: user.id,
  })

  const cookieStore = await cookies()
  if (cookieStore.get(ACTIVE_EVENT_COOKIE)?.value === String(event!.id)) {
    cookieStore.delete(ACTIVE_EVENT_COOKIE)
  }

  revalidatePath(page)
  revalidatePath('/workspaces/event-admin')
  redirect('/workspaces/event-admin?eventDeleted=1')
}
