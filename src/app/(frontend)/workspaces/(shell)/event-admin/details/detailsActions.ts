'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/event-admin/details'
const text = (form: FormData, key: string) =>
  typeof form.get(key) === 'string' ? String(form.get(key)).trim() : ''
const statuses = new Set(['draft', 'setup', 'coming_soon', 'live', 'completed', 'archived'])
const visibilities = new Set(['hidden', 'coming_soon', 'preview_only', 'published', 'archived'])
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

  const data = {
    name,
    slug,
    description: text(formData, 'description') || undefined,
    location: text(formData, 'location') || undefined,
    organizer_name: text(formData, 'organizerName') || undefined,
    rules_summary: text(formData, 'rulesSummary') || undefined,
    event_start_at: new Date(start).toISOString(),
    event_end_at: new Date(end).toISOString(),
    public_open_at: toIso(text(formData, 'publicOpenAt')),
    registration_open_at: toIso(text(formData, 'registrationOpenAt')),
    registration_close_at: toIso(text(formData, 'registrationCloseAt')),
    schedule_publish_at: toIso(text(formData, 'schedulePublishAt')),
    archive_at: toIso(text(formData, 'archiveAt')),
    status,
    visibility,
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
