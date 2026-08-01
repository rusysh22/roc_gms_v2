'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/content-admin/media'

const text = (form: FormData, key: string) =>
  typeof form.get(key) === 'string' ? String(form.get(key)).trim() : ''

export async function uploadMediaAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: page,
  })

  const file = formData.get('file')
  const alt = text(formData, 'alt')
  if (!(file instanceof File) || file.size === 0 || !alt) {
    redirect(`${page}?mediaError=invalid_upload`)
  }
  if (!file.type.startsWith('image/')) {
    redirect(`${page}?mediaError=invalid_image`)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const media = await payload.create({
    collection: 'media',
    data: { alt, caption: text(formData, 'caption') || undefined },
    file: { data: buffer, mimetype: file.type, name: file.name, size: file.size },
  })
  await recordAuditLog({
    payload,
    action: 'media.create',
    entityType: 'media',
    entityId: media.id,
    after: { alt, filename: media.filename },
    actorUserId: user.id,
  })

  revalidatePath(page)
  redirect(`${page}?mediaUpdated=1`)
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const id = text(formData, 'id')
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: page,
  })
  if (!id) {
    redirect(page)
  }

  const before = await payload.findByID({ collection: 'media', id, depth: 0 })
  await payload.delete({ collection: 'media', id })
  await recordAuditLog({
    payload,
    action: 'media.delete',
    entityType: 'media',
    entityId: id,
    before: { alt: before.alt, filename: before.filename },
    actorUserId: user.id,
  })

  revalidatePath(page)
  redirect(`${page}?mediaDeleted=1`)
}
