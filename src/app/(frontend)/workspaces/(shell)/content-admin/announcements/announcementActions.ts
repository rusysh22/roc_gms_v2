'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const listPage = '/workspaces/content-admin/announcements'
const newPage = `${listPage}/new`

const text = (form: FormData, key: string) =>
  typeof form.get(key) === 'string' ? String(form.get(key)).trim() : ''
const statuses = new Set(['draft', 'review', 'published', 'archived'])
const urgencies = new Set(['info', 'warning', 'urgent', 'result', 'schedule_change'])
const displayModes = new Set(['feed', 'banner', 'urgent_alert'])
const targetScopes = new Set(['event', 'sport', 'category', 'match'])
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96)
const toIso = (value: string) => (value ? new Date(value).toISOString() : undefined)

export async function createAnnouncementAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: newPage,
  })
  const event = await getActiveEvent(payload)
  if (!event) {
    redirect(`${newPage}?announcementError=missing_event`)
  }

  const title = text(formData, 'title')
  const slug = slugify(text(formData, 'slug') || title)
  const summary = text(formData, 'summary')
  const body = text(formData, 'body')
  const status = text(formData, 'status') || 'draft'
  const urgency = text(formData, 'urgency') || 'info'
  const displayMode = text(formData, 'displayMode') || 'feed'
  const targetScope = text(formData, 'targetScope') || 'event'
  if (
    !title ||
    !slug ||
    !summary ||
    !body ||
    !statuses.has(status) ||
    !urgencies.has(urgency) ||
    !displayModes.has(displayMode) ||
    !targetScopes.has(targetScope)
  ) {
    redirect(`${newPage}?announcementError=invalid_announcement`)
  }

  const duplicate = await payload.find({
    collection: 'announcements',
    depth: 0,
    limit: 1,
    where: { slug: { equals: slug } },
  })
  if (duplicate.docs.length > 0) {
    redirect(`${newPage}?announcementError=duplicate_slug`)
  }

  const data = {
    title,
    slug,
    summary,
    body,
    urgency,
    display_mode: displayMode,
    status,
    target_scope: targetScope,
    event_id: event.id,
    sport_id: text(formData, 'sportId') || undefined,
    category_id: text(formData, 'categoryId') || undefined,
    match_id: text(formData, 'matchId') || undefined,
    published_at: status === 'published' ? new Date().toISOString() : toIso(text(formData, 'publishedAt')),
    expires_at: toIso(text(formData, 'expiresAt')),
    cta_label: text(formData, 'ctaLabel') || undefined,
    cta_url: text(formData, 'ctaUrl') || undefined,
    share_title: text(formData, 'shareTitle') || undefined,
    share_description: text(formData, 'shareDescription') || undefined,
  }

  const created = await payload.create({ collection: 'announcements', data })
  await recordAuditLog({
    payload,
    action: 'announcement.create',
    entityType: 'announcements',
    entityId: created.id,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(listPage)
  redirect(`${listPage}/${created.id}?announcementUpdated=1`)
}

export async function updateAnnouncementAction(formData: FormData): Promise<void> {
  const id = text(formData, 'id')
  const editPage = `${listPage}/${id}`
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: editPage,
  })
  if (!id) {
    redirect(listPage)
  }

  const before = await payload.findByID({ collection: 'announcements', id, depth: 0 })

  const title = text(formData, 'title')
  const slug = slugify(text(formData, 'slug') || title)
  const summary = text(formData, 'summary')
  const body = text(formData, 'body')
  const status = text(formData, 'status') || 'draft'
  const urgency = text(formData, 'urgency') || 'info'
  const displayMode = text(formData, 'displayMode') || 'feed'
  const targetScope = text(formData, 'targetScope') || 'event'
  if (
    !title ||
    !slug ||
    !summary ||
    !body ||
    !statuses.has(status) ||
    !urgencies.has(urgency) ||
    !displayModes.has(displayMode) ||
    !targetScopes.has(targetScope)
  ) {
    redirect(`${editPage}?announcementError=invalid_announcement`)
  }

  const duplicate = await payload.find({
    collection: 'announcements',
    depth: 0,
    limit: 10,
    where: { slug: { equals: slug } },
  })
  if (duplicate.docs.some((doc) => String(doc.id) !== String(id))) {
    redirect(`${editPage}?announcementError=duplicate_slug`)
  }

  const data = {
    title,
    slug,
    summary,
    body,
    urgency,
    display_mode: displayMode,
    status,
    target_scope: targetScope,
    sport_id: text(formData, 'sportId') || null,
    category_id: text(formData, 'categoryId') || null,
    match_id: text(formData, 'matchId') || null,
    published_at:
      status === 'published' && !before.published_at
        ? new Date().toISOString()
        : toIso(text(formData, 'publishedAt')) || before.published_at,
    expires_at: toIso(text(formData, 'expiresAt')),
    cta_label: text(formData, 'ctaLabel') || undefined,
    cta_url: text(formData, 'ctaUrl') || undefined,
    share_title: text(formData, 'shareTitle') || undefined,
    share_description: text(formData, 'shareDescription') || undefined,
  }

  await payload.update({ collection: 'announcements', id, data })
  await recordAuditLog({
    payload,
    action: 'announcement.update',
    entityType: 'announcements',
    entityId: id,
    before,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(listPage)
  revalidatePath(editPage)
  redirect(`${editPage}?announcementUpdated=1`)
}

export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  const id = text(formData, 'id')
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: listPage,
  })
  if (!id) {
    redirect(listPage)
  }

  const before = await payload.findByID({ collection: 'announcements', id, depth: 0 })
  await payload.delete({ collection: 'announcements', id })
  await recordAuditLog({
    payload,
    action: 'announcement.delete',
    entityType: 'announcements',
    entityId: id,
    before,
    actorUserId: user.id,
  })

  revalidatePath(listPage)
  redirect(`${listPage}?announcementDeleted=1`)
}
