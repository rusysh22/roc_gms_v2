'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/event-admin/sponsors'
const text = (data: FormData, key: string) =>
  typeof data.get(key) === 'string' ? String(data.get(key)).trim() : ''

const TIERS = new Set(['title', 'gold', 'silver', 'bronze', 'partner'])

export async function saveSponsorAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: page,
  })
  const event = await getActiveEvent(payload)
  const id = text(formData, 'id')
  const name = text(formData, 'name')
  const tier = text(formData, 'tier')
  const websiteUrl = text(formData, 'websiteUrl')
  const displayOrderRaw = text(formData, 'displayOrder')
  const displayOrder = displayOrderRaw ? Number(displayOrderRaw) : 0

  if (!event || !name || !TIERS.has(tier) || Number.isNaN(displayOrder)) {
    redirect(`${page}?sponsorError=invalid_input`)
  }

  const removeLogo = formData.get('removeLogo') === 'on'
  const file = formData.get('logoImage')
  let logo: number | null | undefined
  if (removeLogo) {
    logo = null
  } else if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith('image/')) {
      redirect(`${page}?sponsorError=invalid_image`)
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { alt: `${name} logo` },
      file: { data: buffer, mimetype: file.type, name: file.name, size: file.size },
    })
    logo = media.id
  }

  const data = {
    event_id: Number(event.id),
    name,
    tier: tier as 'title' | 'gold' | 'silver' | 'bronze' | 'partner',
    website_url: websiteUrl || undefined,
    display_order: displayOrder,
    logo,
  }

  if (id) {
    const before = await payload.findByID({ collection: 'sponsors', id, depth: 0 })
    await payload.update({ collection: 'sponsors', id, data })
    await recordAuditLog({
      payload,
      action: 'sponsor.update',
      entityType: 'sponsors',
      entityId: id,
      before,
      after: data,
      actorUserId: user.id,
    })
  } else {
    const created = await payload.create({ collection: 'sponsors', data })
    await recordAuditLog({
      payload,
      action: 'sponsor.create',
      entityType: 'sponsors',
      entityId: created.id,
      before: null,
      after: data,
      actorUserId: user.id,
    })
  }

  revalidatePath(page)
  revalidatePath(`/events/${event.slug}`)
  redirect(`${page}?sponsorUpdated=1`)
}

export async function deleteSponsorAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: page,
  })
  const event = await getActiveEvent(payload)
  const id = text(formData, 'id')
  if (!event || !id) {
    redirect(`${page}?sponsorError=invalid_input`)
  }

  const before = await payload.findByID({ collection: 'sponsors', id, depth: 0 })
  await payload.delete({ collection: 'sponsors', id })
  await recordAuditLog({
    payload,
    action: 'sponsor.delete',
    entityType: 'sponsors',
    entityId: id,
    before,
    after: null,
    actorUserId: user.id,
  })

  revalidatePath(page)
  revalidatePath(`/events/${event.slug}`)
  redirect(`${page}?sponsorUpdated=1`)
}
