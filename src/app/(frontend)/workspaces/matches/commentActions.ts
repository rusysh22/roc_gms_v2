'use server'

import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { recordAuditLog } from '@/lib/audit'

const ALLOWED_ADMIN_COMMENT_TYPES = new Set(['internal', 'official_note'])

const toStringField = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value.trim() : ''

export async function addMatchCommentAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const commentType = toStringField(formData.get('commentType')) || 'internal'
  const authorName = toStringField(formData.get('authorName')) || 'System / Unknown'
  const body = toStringField(formData.get('body'))
  const isPinned = formData.get('isPinned') === 'on'

  if (!matchNumber) {
    redirect('/workspaces/scheduler?commentError=invalid_request')
  }

  if (!ALLOWED_ADMIN_COMMENT_TYPES.has(commentType)) {
    redirect(`/workspaces/matches/${matchNumber}?commentError=invalid_type`)
  }

  if (!body) {
    redirect(`/workspaces/matches/${matchNumber}?commentError=missing_body`)
  }

  const payload = await getPayload({ config })
  const matches = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 1,
    where: { match_number: { equals: matchNumber } },
  })
  const match = matches.docs[0]

  if (!match) {
    redirect(`/workspaces/matches/${matchNumber}?commentError=not_found`)
  }

  const headersList = await getHeaders()
  const { user } = await payload.auth({ headers: headersList })
  const actorUserId = user?.id ?? null
  const resolvedAuthorName =
    authorName === 'System / Unknown' && user && 'name' in user && typeof user.name === 'string'
      ? user.name
      : authorName

  const status = commentType === 'official_note' ? 'approved' : 'pending'
  const comment = await payload.create({
    collection: 'comments',
    data: {
      entity_type: 'matches',
      entity_id: String(match.id),
      comment_type: commentType,
      author_name: resolvedAuthorName,
      author_user_id: actorUserId || undefined,
      body,
      status,
      is_pinned: isPinned,
    },
  })

  await recordAuditLog({
    payload,
    action: `comment.${commentType}.create`,
    entityType: 'comments',
    entityId: comment.id,
    before: null,
    after: {
      entity_type: 'matches',
      entity_id: String(match.id),
      comment_type: commentType,
      author_name: resolvedAuthorName,
      author_user_id: actorUserId,
      body,
      status,
      is_pinned: isPinned,
    },
    actorUserId,
  })

  revalidatePath(`/workspaces/matches/${matchNumber}`)
  revalidatePath(`/matches/${matchNumber}`)
  redirect(`/workspaces/matches/${matchNumber}?commentUpdated=1`)
}
