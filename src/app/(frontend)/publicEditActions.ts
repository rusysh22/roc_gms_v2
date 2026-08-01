'use server'

import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'
import { recordAuditLog } from '@/lib/audit'
import { canEditEventPublicContent, hasPublicEditRole } from './publicEditState'

type PublicEditUser = {
  id: string | number
  roles?: string[] | null
}

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
  const before = await payload.findByID({ collection: 'events', id, depth: 0 })
  const visibility = textField(formData, 'visibility')
  const data = {
    description: nullableTextField(formData, 'description'),
    hero_tagline: nullableTextField(formData, 'heroTagline'),
    visibility: visibility || before.visibility,
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
  const status = textField(formData, 'status') || before.status
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
  const status = textField(formData, 'status') || before.status
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
