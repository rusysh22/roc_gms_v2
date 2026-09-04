'use server'

import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'
import { recordAuditLog } from '@/lib/audit'
import { canAccessEvent } from '@/access/eventMembership'
import { canEditEventPublicContent, hasPublicEditRole } from './publicEditState'

const relationId = (value: unknown): string | number | undefined => {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return (value as { id: string | number }).id
  }
  return undefined
}

type PublicEditUser = {
  id: string | number
  roles?: string[] | null
}

const eventVisibilities = new Set(['published', 'hidden', 'coming_soon', 'archived', 'preview_only'])
type EventVisibility = 'published' | 'hidden' | 'coming_soon' | 'archived' | 'preview_only'

const contentStatuses = new Set(['draft', 'published', 'archived', 'review'])
type ContentStatus = 'draft' | 'published' | 'archived' | 'review'

const textField = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const nullableTextField = (formData: FormData, key: string) => {
  const value = textField(formData, key)
  return value || null
}

const safeReturnTo = (formData: FormData) => {
  const returnTo = textField(formData, 'returnTo')
  return returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/'
}

const getAuthorizedActor = async (payload: Payload): Promise<PublicEditUser> => {
  const headersList = await getHeaders()
  const { user } = await payload.auth({ headers: headersList })
  const actor = user as PublicEditUser | null

  if (!actor || !hasPublicEditRole(actor)) {
    throw new Error('public_edit_unauthorized')
  }

  return actor
}

const revalidateReturnTargets = (returnTo: string) => {
  const path = returnTo.split('?')[0] || '/'
  revalidatePath(path)
  revalidatePath('/')
  revalidatePath('/articles')
  revalidatePath('/announcements')
}

export async function updateEventPublicContentAction(formData: FormData): Promise<void> {
  const id = textField(formData, 'id')
  const returnTo = safeReturnTo(formData)

  if (!id) {
    redirect(`${returnTo}?editError=missing_event`)
  }

  const payload = await getPayload({ config })
  const actor = await getAuthorizedActor(payload)
  if (!canEditEventPublicContent(actor)) {
    redirect(`${returnTo}?editError=unauthorized`)
  }
  if (!(await canAccessEvent(payload, actor as Parameters<typeof canAccessEvent>[1], id))) {
    redirect(`${returnTo}?editError=unauthorized`)
  }
  const before = await payload.findByID({ collection: 'events', id, depth: 0 })
  const visibility = textField(formData, 'visibility')
  if (visibility && !eventVisibilities.has(visibility)) {
    redirect(`${returnTo}?editError=invalid_visibility`)
  }
  const data = {
    description: nullableTextField(formData, 'description'),
    hero_tagline: nullableTextField(formData, 'heroTagline'),
    visibility: (visibility || before.visibility) as EventVisibility,
  }

  await payload.update({
    collection: 'events',
    id,
    data,
  })

  await recordAuditLog({
    payload,
    action: 'public_edit.event_content_update',
    entityType: 'events',
    entityId: id,
    before: {
      description: before.description ?? null,
      hero_tagline: before.hero_tagline ?? null,
      visibility: before.visibility ?? null,
    },
    after: data,
    actorUserId: actor.id,
  })

  revalidateReturnTargets(returnTo)
  redirect(`${returnTo}?preview=1&edit=1&editUpdated=1`)
}

export async function updateArticlePublicContentAction(formData: FormData): Promise<void> {
  const id = textField(formData, 'id')
  const returnTo = safeReturnTo(formData)

  if (!id) {
    redirect(`${returnTo}?editError=missing_article`)
  }

  const payload = await getPayload({ config })
  const actor = await getAuthorizedActor(payload)
  const before = await payload.findByID({ collection: 'articles', id, depth: 0 })
  const articleEventId = relationId(before.event_id)
  if (
    !articleEventId ||
    !(await canAccessEvent(payload, actor as Parameters<typeof canAccessEvent>[1], articleEventId))
  ) {
    redirect(`${returnTo}?editError=unauthorized`)
  }
  const statusInput = textField(formData, 'status')
  if (statusInput && !contentStatuses.has(statusInput)) {
    redirect(`${returnTo}?editError=invalid_status`)
  }
  const status = (statusInput || before.status) as ContentStatus
  const data = {
    title: textField(formData, 'title') || before.title,
    excerpt: textField(formData, 'excerpt') || before.excerpt,
    status,
    published_at:
      status === 'published' && !before.published_at ? new Date().toISOString() : before.published_at,
    share_title: nullableTextField(formData, 'shareTitle'),
    share_description: nullableTextField(formData, 'shareDescription'),
  }

  await payload.update({
    collection: 'articles',
    id,
    data,
  })

  await recordAuditLog({
    payload,
    action: 'public_edit.article_content_update',
    entityType: 'articles',
    entityId: id,
    before: {
      title: before.title,
      excerpt: before.excerpt,
      status: before.status,
      published_at: before.published_at ?? null,
      share_title: before.share_title ?? null,
      share_description: before.share_description ?? null,
    },
    after: data,
    actorUserId: actor.id,
  })

  revalidateReturnTargets(returnTo)
  redirect(`${returnTo}?preview=1&edit=1&editUpdated=1`)
}

export async function updateAnnouncementPublicContentAction(formData: FormData): Promise<void> {
  const id = textField(formData, 'id')
  const returnTo = safeReturnTo(formData)

  if (!id) {
    redirect(`${returnTo}?editError=missing_announcement`)
  }

  const payload = await getPayload({ config })
  const actor = await getAuthorizedActor(payload)
  const before = await payload.findByID({ collection: 'announcements', id, depth: 0 })
  const announcementEventId = relationId(before.event_id)
  if (
    !announcementEventId ||
    !(await canAccessEvent(
      payload,
      actor as Parameters<typeof canAccessEvent>[1],
      announcementEventId,
    ))
  ) {
    redirect(`${returnTo}?editError=unauthorized`)
  }
  const statusInput = textField(formData, 'status')
  if (statusInput && !contentStatuses.has(statusInput)) {
    redirect(`${returnTo}?editError=invalid_status`)
  }
  const status = (statusInput || before.status) as ContentStatus
  const data = {
    title: textField(formData, 'title') || before.title,
    summary: textField(formData, 'summary') || before.summary,
    body: textField(formData, 'body') || before.body,
    status,
    published_at:
      status === 'published' && !before.published_at ? new Date().toISOString() : before.published_at,
    share_title: nullableTextField(formData, 'shareTitle'),
    share_description: nullableTextField(formData, 'shareDescription'),
  }

  await payload.update({
    collection: 'announcements',
    id,
    data,
  })

  await recordAuditLog({
    payload,
    action: 'public_edit.announcement_content_update',
    entityType: 'announcements',
    entityId: id,
    before: {
      title: before.title,
      summary: before.summary,
      body: before.body,
      status: before.status,
      published_at: before.published_at ?? null,
      share_title: before.share_title ?? null,
      share_description: before.share_description ?? null,
    },
    after: data,
    actorUserId: actor.id,
  })

  revalidateReturnTargets(returnTo)
  redirect(`${returnTo}?preview=1&edit=1&editUpdated=1`)
}
