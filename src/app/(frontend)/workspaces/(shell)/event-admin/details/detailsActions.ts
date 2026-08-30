'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

import { recordAuditLog } from '@/lib/audit'
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

  // Shrinking the event window under matches that are already scheduled would strand those matches
  // outside their own event's dates. Block it - the organiser reschedules (or clears) those matches
  // first, then narrows the window.
  const startIso = new Date(start).toISOString()
  const endIso = new Date(end).toISOString()
  const outsideWindow = await payload.count({
    collection: 'matches',
    where: {
      and: [
        { event_id: { equals: event.id } },
        { scheduled_start_at: { exists: true } },
        {
          or: [
            { scheduled_start_at: { less_than: startIso } },
            { scheduled_start_at: { greater_than: endIso } },
          ],
        },
      ],
    },
  })
  if (outsideWindow.totalDocs > 0) {
    redirect(`${page}?detailsError=schedule_outside_window`)
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

// Backward-flow gap: a mistakenly created event had no way out of the workspace - it sat in the
// EventSwitcher forever. This gives one:
//  - an event that never got past "just created" (no sports / categories / participants / matches)
//    is hard-deleted, logo media included;
//  - anything with real setup is *archived* instead (status + visibility both `archived`), which
//    hides it from the switcher and the public site but keeps the data recoverable.
// Either way the active-event cookie is cleared so the workspace falls back to another event.
export async function discardEventAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: page,
  })
  const event = await getActiveEvent(payload)
  if (!event) {
    redirect(`${page}?detailsError=missing_event`)
  }

  const confirmToken = text(formData, 'confirmName')
  if (confirmToken !== String(event.name)) {
    redirect(`${page}?detailsError=discard_name_mismatch`)
  }

  // Every child collection that carries a foreign key back to the event - if any has a row, a hard
  // delete would hit an FK, so archive instead. (event-memberships is excluded: every event has the
  // creator's row and it's cleared explicitly below.)
  const eventWhere = { event_id: { equals: event.id } }
  const childCollections = [
    'sports',
    'rulesets',
    'competition-categories',
    'clubs',
    'players',
    'teams',
    'venues',
    'courts',
    'competition-entries',
    'matches',
    'registration-submissions',
    'sponsors',
    'announcements',
    'articles',
  ] as const
  const childCounts = await Promise.all(
    childCollections.map((collection) => payload.count({ collection, where: eventWhere })),
  )
  const isEmpty = childCounts.every((result) => result.totalDocs === 0)

  const before = await payload.findByID({ collection: 'events', id: event.id, depth: 0 })

  if (isEmpty) {
    // Every event has at least the creator's event-memberships row (Events.enrollCreatorAsMember);
    // clear it (and any co-admins added since) before the event row so the FK doesn't block delete.
    await payload
      .delete({ collection: 'event-memberships', where: { event_id: { equals: event.id } } })
      .catch(() => null)
    await payload.delete({ collection: 'events', id: event.id })
    if (before.logo) {
      const logoId = typeof before.logo === 'object' ? (before.logo as { id?: unknown }).id : before.logo
      if (logoId) {
        await payload.delete({ collection: 'media', id: String(logoId) }).catch(() => null)
      }
    }
  } else {
    await payload.update({
      collection: 'events',
      id: event.id,
      data: { status: 'archived', visibility: 'archived' },
    })
  }

  await recordAuditLog({
    payload,
    action: isEmpty ? 'event.delete' : 'event.archive',
    entityType: 'events',
    entityId: event.id,
    before,
    after: isEmpty ? null : { ...before, status: 'archived', visibility: 'archived' },
    actorUserId: user.id,
  })

  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_EVENT_COOKIE)

  revalidatePath(page)
  revalidatePath('/workspaces/event-admin')
  redirect(`/workspaces/event-admin?eventDiscarded=${isEmpty ? 'deleted' : 'archived'}`)
}
