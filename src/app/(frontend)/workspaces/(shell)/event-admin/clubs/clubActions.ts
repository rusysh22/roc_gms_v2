'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/event-admin/clubs'
const text = (data: FormData, key: string) => typeof data.get(key) === 'string' ? String(data.get(key)).trim() : ''
const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
const emailIsValid = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export async function saveClubAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.eventAdmin, returnTo: page })
  const event = await getActiveEvent(payload)
  const id = text(formData, 'id'); const name = text(formData, 'name'); const requestedSlug = text(formData, 'slug'); const email = text(formData, 'contactEmail')
  const slug = slugify(requestedSlug || name)
  if (!event || !name || !slug || !emailIsValid(email)) redirect(`${page}?clubError=invalid_input`)
  const duplicate = await payload.find({ collection: 'clubs', depth: 0, limit: 10, where: { slug: { equals: slug } } })
  if (duplicate.docs.some((club) => String(club.id) !== id)) redirect(`${page}?clubError=duplicate_slug`)
  const data = { event_id: event.id, name, slug, logo: text(formData, 'logo') || undefined, description: text(formData, 'description') || undefined, contact_person: text(formData, 'contactPerson') || undefined, contact_email: email || undefined }
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
