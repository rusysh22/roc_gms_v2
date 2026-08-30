'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../workspaceAuth'

const ALLOWED_ADMIN_COMMENT_TYPES = new Set(['internal', 'official_note'])

const toStringField = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value.trim() : ''

// Optional - lets a caller elsewhere in the match-officer flow (e.g. live-score's inline
// "Incident note" form) land back where it started instead of always bouncing to the full match
// details page. Same pattern as matchActions.ts's getSafeReturnTo.
const getSafeReturnTo = (formData: FormData, fallback: string) => {
  const returnTo = toStringField(formData.get('returnTo'))
  return returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : fallback
}

export async function addMatchCommentAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const commentType = toStringField(formData.get('commentType')) || 'internal'
  const authorName = toStringField(formData.get('authorName')) || 'System / Unknown'
  const body = toStringField(formData.get('body'))
  const isPinned = formData.get('isPinned') === 'on'
  const returnTo = getSafeReturnTo(formData, `/workspaces/matches/${matchNumber}`)

  if (!matchNumber) {
    redirect('/workspaces/scheduler?commentError=invalid_request')
  }

  if (!ALLOWED_ADMIN_COMMENT_TYPES.has(commentType)) {
    redirect(`${returnTo}?commentError=invalid_type`)
  }

  if (!body) {
    redirect(`${returnTo}?commentError=missing_body`)
  }

  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.matchOfficer,
    returnTo,
  })
  const matches = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 1,
    where: { match_number: { equals: matchNumber } },
  })
  const match = matches.docs[0]

  if (!match) {
    redirect(`${returnTo}?commentError=not_found`)
  }

  const actorUserId = user.id
  const resolvedAuthorName =
    authorName === 'System / Unknown' && typeof user.name === 'string'
      ? user.name
      : authorName

  const status = commentType === 'official_note' ? 'approved' : 'pending'
  const comment = await payload.create({
    collection: 'comments',
    data: {
      entity_type: 'matches',
      entity_id: String(match.id),
      comment_type: commentType as 'internal' | 'official_note',
      author_name: resolvedAuthorName,
      author_user_id: actorUserId ? Number(actorUserId) : undefined,
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
  redirect(`${returnTo}?commentUpdated=1`)
}

// The delete counterpart to addMatchCommentAction - remove an internal comment / official note.
// The author can delete their own; an event_admin / super_admin can delete any.
export async function deleteMatchCommentAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const commentId = toStringField(formData.get('commentId'))
  const returnTo = getSafeReturnTo(formData, `/workspaces/matches/${matchNumber}`)

  if (!matchNumber || !commentId) {
    redirect(`${returnTo}?commentError=invalid_request`)
  }

  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.matchOfficer,
    returnTo,
  })

  const comment = await payload.findByID({ collection: 'comments', id: commentId, depth: 0 }).catch(() => null)
  if (!comment || comment.entity_type !== 'matches') {
    redirect(`${returnTo}?commentError=not_found`)
  }

  const isAdmin = (user.roles ?? []).some((role) => role === 'super_admin' || role === 'event_admin')
  const isAuthor =
    comment!.author_user_id != null && String(comment!.author_user_id) === String(user.id)
  if (!isAdmin && !isAuthor) {
    redirect(`${returnTo}?commentError=not_allowed`)
  }

  await payload.delete({ collection: 'comments', id: commentId })
  await recordAuditLog({
    payload,
    action: 'comment.delete',
    entityType: 'comments',
    entityId: commentId,
    before: comment,
    after: null,
    actorUserId: user.id,
  })

  revalidatePath(`/workspaces/matches/${matchNumber}`)
  revalidatePath(`/matches/${matchNumber}`)
  redirect(`${returnTo}?commentUpdated=1`)
}
