'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { isEventThemePresetKey } from '@/lib/eventTheme'
import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/event-admin/appearance'

export async function saveAppearanceAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: page,
  })
  const event = await getActiveEvent(payload)
  if (!event) {
    redirect(`${page}?appearanceError=missing_event`)
  }

  const preset = formData.get('preset')
  if (!isEventThemePresetKey(preset)) {
    redirect(`${page}?appearanceError=invalid_preset`)
  }

  const data: Record<string, unknown> = { theme_config: { preset } }

  const removeLogo = formData.get('removeLogo') === 'on'
  const logoFile = formData.get('logoImage')
  if (removeLogo) {
    data.logo = null
  } else if (logoFile instanceof File && logoFile.size > 0) {
    if (!logoFile.type.startsWith('image/')) {
      redirect(`${page}?appearanceError=invalid_image`)
    }
    const buffer = Buffer.from(await logoFile.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { alt: `${event.name} logo` },
      file: { data: buffer, mimetype: logoFile.type, name: logoFile.name, size: logoFile.size },
    })
    data.logo = media.id
  }

  const removeImage = formData.get('removeImage') === 'on'
  const file = formData.get('heroImage')
  if (removeImage) {
    data.banner_image = null
  } else if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith('image/')) {
      redirect(`${page}?appearanceError=invalid_image`)
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { alt: `${event.name} hero image` },
      file: { data: buffer, mimetype: file.type, name: file.name, size: file.size },
    })
    data.banner_image = media.id
  }

  const before = await payload.findByID({ collection: 'events', id: event.id, depth: 0 })
  await payload.update({ collection: 'events', id: event.id, data })
  await recordAuditLog({
    payload,
    action: 'event.appearance_update',
    entityType: 'events',
    entityId: event.id,
    before: { theme_config: before.theme_config, banner_image: before.banner_image, logo: before.logo },
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(page)
  revalidatePath(`/events/${event.slug}`)
  redirect(`${page}?appearanceUpdated=1`)
}
