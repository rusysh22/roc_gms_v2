'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/event-admin/facilities'
const text = (formData: FormData, name: string) => {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

const getEvent = async (payload: Awaited<ReturnType<typeof assertWorkspaceActionAccess>>['payload']) =>
  (await payload.find({ collection: 'events', depth: 0, limit: 1, sort: 'event_start_at' })).docs[0] as
    | { id: string | number }
    | undefined

const revalidate = () => {
  revalidatePath(page)
  revalidatePath('/workspaces/event-admin')
  revalidatePath('/workspaces/scheduler')
}

export async function saveVenueAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.eventAdmin, returnTo: page })
  const event = await getEvent(payload); const id = text(formData, 'id'); const name = text(formData, 'name')
  if (!event || !name) redirect(`${page}?facilityError=invalid_venue`)
  const data = { event_id: event.id, name, address: text(formData, 'address') || undefined, map_url: text(formData, 'mapUrl') || undefined, description: text(formData, 'description') || undefined, is_virtual: text(formData, 'isVirtual') === 'on', virtual_url: text(formData, 'virtualUrl') || undefined }
  if (id) {
    const before = await payload.findByID({ collection: 'venues', id, depth: 0 })
    await payload.update({ collection: 'venues', id, data })
    await recordAuditLog({ payload, action: 'venue.update', entityType: 'venues', entityId: id, before, after: data, actorUserId: user.id })
  } else {
    const created = await payload.create({ collection: 'venues', data })
    await recordAuditLog({ payload, action: 'venue.create', entityType: 'venues', entityId: created.id, before: null, after: data, actorUserId: user.id })
  }
  revalidate(); redirect(`${page}?venueUpdated=1`)
}

export async function saveCourtAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.eventAdmin, returnTo: page })
  const event = await getEvent(payload); const id = text(formData, 'id'); const name = text(formData, 'name'); const venueId = text(formData, 'venueId'); const sportId = text(formData, 'sportId')
  if (!event || !name || !venueId) redirect(`${page}?facilityError=invalid_court`)
  try {
    const venue = await payload.findByID({ collection: 'venues', id: venueId, depth: 0 }) as { event_id?: string | number }
    if (String(venue.event_id) !== String(event.id)) throw new Error('venue')
    if (sportId) {
      const sport = await payload.findByID({ collection: 'sports', id: sportId, depth: 0 }) as { event_id?: string | number }
      if (String(sport.event_id) !== String(event.id)) throw new Error('sport')
    }
  } catch { redirect(`${page}?facilityError=invalid_relationship`) }
  const capacity = text(formData, 'capacity'); const parsedCapacity = capacity ? Number(capacity) : undefined
  if (parsedCapacity !== undefined && (!Number.isInteger(parsedCapacity) || parsedCapacity < 0)) redirect(`${page}?facilityError=invalid_court`)
  const data = { event_id: event.id, venue_id: venueId, name, sport_id: sportId || undefined, capacity: parsedCapacity, is_active: text(formData, 'isActive') === 'on' }
  if (id) {
    const before = await payload.findByID({ collection: 'courts', id, depth: 0 })
    await payload.update({ collection: 'courts', id, data })
    await recordAuditLog({ payload, action: 'court.update', entityType: 'courts', entityId: id, before, after: data, actorUserId: user.id })
  } else {
    const created = await payload.create({ collection: 'courts', data })
    await recordAuditLog({ payload, action: 'court.create', entityType: 'courts', entityId: created.id, before: null, after: data, actorUserId: user.id })
  }
  revalidate(); redirect(`${page}?courtUpdated=1`)
}
