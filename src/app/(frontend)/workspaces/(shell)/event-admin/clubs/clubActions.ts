'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { slugify } from '@/lib/slugify'
import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/event-admin/clubs'
const text = (data: FormData, key: string) => typeof data.get(key) === 'string' ? String(data.get(key)).trim() : ''
const emailIsValid = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export async function saveClubAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.draw, returnTo: page })
  const event = await getActiveEvent(payload)
  const id = text(formData, 'id'); const name = text(formData, 'name'); const requestedSlug = text(formData, 'slug'); const email = text(formData, 'contactEmail')
  const slug = slugify(requestedSlug || name)
  if (!event || !name || !slug || !emailIsValid(email)) redirect(`${page}?clubError=invalid_input`)
  const duplicate = await payload.find({ collection: 'clubs', depth: 0, limit: 10, where: { and: [{ slug: { equals: slug } }, { event_id: { equals: event.id } }] } })
  if (duplicate.docs.some((club) => String(club.id) !== id)) redirect(`${page}?clubError=duplicate_slug`)
  const data = { event_id: Number(event.id), name, slug, logo: text(formData, 'logo') || undefined, description: text(formData, 'description') || undefined, contact_person: text(formData, 'contactPerson') || undefined, contact_email: email || undefined }
  if (id) {
    const before = await payload.findByID({ collection: 'clubs', id, depth: 0 })
    await payload.update({ collection: 'clubs', id, data })
    await recordAuditLog({ payload, action: 'club.update', entityType: 'clubs', entityId: id, before, after: data, actorUserId: user.id })
  } else {
    const created = await payload.create({ collection: 'clubs', data })
    await recordAuditLog({ payload, action: 'club.create', entityType: 'clubs', entityId: created.id, before: null, after: data, actorUserId: user.id })
  }
  revalidatePath(page); revalidatePath('/workspaces/event-admin'); redirect(`${page}?clubUpdated=1`)
}

export async function deleteClubAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.draw, returnTo: page })
  const event = await getActiveEvent(payload)
  const id = text(formData, 'id')
  if (!event || !id) redirect(`${page}?clubError=invalid_input`)

  const club = await payload.findByID({ collection: 'clubs', id, depth: 0 }).catch(() => null)
  if (!club || String(club.event_id) !== String(event.id)) redirect(`${page}?clubError=invalid_relationship`)

  const [players, teams, entries] = await Promise.all([
    payload.count({ collection: 'players', where: { club_id: { equals: id } } }),
    payload.count({ collection: 'teams', where: { club_id: { equals: id } } }),
    payload.count({ collection: 'competition-entries', where: { club_id: { equals: id } } }),
  ])
  if (players.totalDocs + teams.totalDocs + entries.totalDocs > 0) {
    redirect(`${page}?clubError=club_in_use`)
  }

  await payload.delete({ collection: 'clubs', id })
  await recordAuditLog({ payload, action: 'club.delete', entityType: 'clubs', entityId: id, before: club, after: null, actorUserId: user.id })
  revalidatePath(page); revalidatePath('/workspaces/event-admin'); redirect(`${page}?clubUpdated=1`)
}
