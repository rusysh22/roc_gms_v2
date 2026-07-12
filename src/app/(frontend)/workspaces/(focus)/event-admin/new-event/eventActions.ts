'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { slugify, text, wizardPage } from './wizardShared'

export async function createEventAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const name = text(formData, 'name')
  const slug = slugify(text(formData, 'slug') || name)
  const start = text(formData, 'eventStart')
  const end = text(formData, 'eventEnd')
  const location = text(formData, 'location')
  const organizerName = text(formData, 'organizerName')

  if (!name || !slug || !start || !end) {
    redirect(`${wizardPage}?step=event&wizardError=invalid_event`)
  }
  if (new Date(end).getTime() <= new Date(start).getTime()) {
    redirect(`${wizardPage}?step=event&wizardError=invalid_date_range`)
  }

  const duplicate = await payload.find({
    collection: 'events',
    depth: 0,
    limit: 1,
    where: { slug: { equals: slug } },
  })
  if (duplicate.docs.length > 0) {
    redirect(`${wizardPage}?step=event&wizardError=duplicate_slug`)
  }

  let logoId: number | undefined
  const logoFile = formData.get('logo')
  if (logoFile instanceof File && logoFile.size > 0) {
    if (!logoFile.type.startsWith('image/')) {
      redirect(`${wizardPage}?step=event&wizardError=invalid_logo`)
    }
    const buffer = Buffer.from(await logoFile.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { alt: `${name} logo` },
      file: { data: buffer, mimetype: logoFile.type, name: logoFile.name, size: logoFile.size },
    })
    logoId = Number(media.id)
  }

  const data = {
    name,
    slug,
    logo: logoId,
    event_start_at: new Date(start).toISOString(),
    event_end_at: new Date(end).toISOString(),
    location: location || undefined,
    organizer_name: organizerName || undefined,
    status: 'draft' as const,
    visibility: 'hidden' as const,
  }
  const created = await payload.create({ collection: 'events', data })
  await recordAuditLog({
    payload,
    action: 'event.create',
    entityType: 'events',
    entityId: created.id,
    before: null,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  revalidatePath('/workspaces/event-admin')
  redirect(`${wizardPage}?eventId=${created.id}&step=sports&wizardCreated=1`)
}
