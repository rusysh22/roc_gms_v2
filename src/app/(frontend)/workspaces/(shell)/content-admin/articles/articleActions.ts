'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Payload } from 'payload'

import { recordAuditLog } from '@/lib/audit'
import { plainTextToLexicalContent } from '../../../../contentData'
import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const listPage = '/workspaces/content-admin/articles'
const newPage = `${listPage}/new`

const text = (form: FormData, key: string) =>
  typeof form.get(key) === 'string' ? String(form.get(key)).trim() : ''
const statuses = new Set(['draft', 'review', 'published', 'archived'])
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96)

async function uploadCoverImage(payload: Payload, formData: FormData, altFallback: string) {
  const file = formData.get('coverImage')
  if (!(file instanceof File) || file.size === 0) {
    return { id: undefined, invalid: false }
  }
  if (!file.type.startsWith('image/')) {
    return { id: undefined, invalid: true }
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const media = await payload.create({
    collection: 'media',
    data: { alt: altFallback },
    file: { data: buffer, mimetype: file.type, name: file.name, size: file.size },
  })
  return { id: media.id, invalid: false }
}

export async function createArticleAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: newPage,
  })
  const event = await getActiveEvent(payload)
  if (!event) {
    redirect(`${newPage}?articleError=missing_event`)
  }

  const title = text(formData, 'title')
  const slug = slugify(text(formData, 'slug') || title)
  const excerpt = text(formData, 'excerpt')
  const status = text(formData, 'status') || 'draft'
  if (!title || !slug || !excerpt || !statuses.has(status)) {
    redirect(`${newPage}?articleError=invalid_article`)
  }

  const duplicate = await payload.find({
    collection: 'articles',
    depth: 0,
    limit: 1,
    where: { slug: { equals: slug } },
  })
  if (duplicate.docs.length > 0) {
    redirect(`${newPage}?articleError=duplicate_slug`)
  }

  const cover = await uploadCoverImage(payload, formData, title)
  if (cover.invalid) {
    redirect(`${newPage}?articleError=invalid_cover_image`)
  }

  const data = {
    title,
    slug,
    excerpt,
    content: plainTextToLexicalContent(text(formData, 'content') || excerpt),
    cover_image: cover.id,
    event_id: event.id,
    sport_id: text(formData, 'sportId') || undefined,
    category_id: text(formData, 'categoryId') || undefined,
    match_id: text(formData, 'matchId') || undefined,
    status,
    published_at: status === 'published' ? new Date().toISOString() : undefined,
    share_title: text(formData, 'shareTitle') || undefined,
    share_description: text(formData, 'shareDescription') || undefined,
    comments_enabled: formData.get('commentsEnabled') === 'on',
  }

  const created = await payload.create({ collection: 'articles', data })
  await recordAuditLog({
    payload,
    action: 'article.create',
    entityType: 'articles',
    entityId: created.id,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(listPage)
  redirect(`${listPage}/${created.id}?articleUpdated=1`)
}

export async function updateArticleAction(formData: FormData): Promise<void> {
  const id = text(formData, 'id')
  const editPage = `${listPage}/${id}`
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: editPage,
  })
  if (!id) {
    redirect(listPage)
  }

  const before = await payload.findByID({ collection: 'articles', id, depth: 0 })

  const title = text(formData, 'title')
  const slug = slugify(text(formData, 'slug') || title)
  const excerpt = text(formData, 'excerpt')
  const status = text(formData, 'status') || 'draft'
  if (!title || !slug || !excerpt || !statuses.has(status)) {
    redirect(`${editPage}?articleError=invalid_article`)
  }

  const duplicate = await payload.find({
    collection: 'articles',
    depth: 0,
    limit: 10,
    where: { slug: { equals: slug } },
  })
  if (duplicate.docs.some((doc) => String(doc.id) !== String(id))) {
    redirect(`${editPage}?articleError=duplicate_slug`)
  }

  const cover = await uploadCoverImage(payload, formData, title)
  if (cover.invalid) {
    redirect(`${editPage}?articleError=invalid_cover_image`)
  }

  const data = {
    title,
    slug,
    excerpt,
    content: plainTextToLexicalContent(text(formData, 'content') || excerpt),
    ...(cover.id ? { cover_image: cover.id } : {}),
    sport_id: text(formData, 'sportId') || null,
    category_id: text(formData, 'categoryId') || null,
    match_id: text(formData, 'matchId') || null,
    status,
    published_at:
      status === 'published' && !before.published_at ? new Date().toISOString() : before.published_at,
    share_title: text(formData, 'shareTitle') || undefined,
    share_description: text(formData, 'shareDescription') || undefined,
    comments_enabled: formData.get('commentsEnabled') === 'on',
  }

  await payload.update({ collection: 'articles', id, data })
  await recordAuditLog({
    payload,
    action: 'article.update',
    entityType: 'articles',
    entityId: id,
    before,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(listPage)
  revalidatePath(editPage)
  redirect(`${editPage}?articleUpdated=1`)
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  const id = text(formData, 'id')
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: listPage,
  })
  if (!id) {
    redirect(listPage)
  }

  const before = await payload.findByID({ collection: 'articles', id, depth: 0 })
  await payload.delete({ collection: 'articles', id })
  await recordAuditLog({
    payload,
    action: 'article.delete',
    entityType: 'articles',
    entityId: id,
    before,
    actorUserId: user.id,
  })

  revalidatePath(listPage)
  redirect(`${listPage}?articleDeleted=1`)
}
