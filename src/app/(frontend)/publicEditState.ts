import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@payload-config'
import { canAccessEvent } from '@/access/eventMembership'

type SearchParams = Record<string, string | string[] | undefined>

type PublicEditUser = {
  id: string | number
  email?: string | null
  roles?: string[] | null
}

export type PublicEditState = {
  canEdit: boolean
  isPreview: boolean
  isEditMode: boolean
  user: PublicEditUser | null
}

const PUBLIC_EDIT_ROLES = new Set(['super_admin', 'event_admin', 'content_admin'])

const getParam = (searchParams: SearchParams | undefined, key: string) => {
  const value = searchParams?.[key]
  return Array.isArray(value) ? value[0] : value
}

export const hasPublicEditRole = (user: PublicEditUser | null | undefined) =>
  Boolean(user?.roles?.some((role) => PUBLIC_EDIT_ROLES.has(role)))

export const canEditEventPublicContent = (user: PublicEditUser | null | undefined) =>
  Boolean(user?.roles?.some((role) => role === 'super_admin' || role === 'event_admin'))

/** Roles on Users are global, so a role check alone lets any event_admin edit *every* event's
 * public content. This narrows it to the specific event: the caller must hold an EventMemberships
 * row for that event (super_admin bypasses), matching the backoffice scope boundary. */
export const canEditEventContentScoped = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  user: PublicEditUser | null | undefined,
  eventId: string | number,
): Promise<boolean> => {
  if (!hasPublicEditRole(user) || !user) {
    return false
  }
  return canAccessEvent(
    payload,
    user as Parameters<typeof canAccessEvent>[1],
    eventId,
  )
}

export const getPublicEditState = async (
  searchParams?: SearchParams,
  eventId?: string | number,
): Promise<PublicEditState> => {
  const payload = await getPayload({ config })
  const headersList = await getHeaders()
  const { user } = await payload.auth({ headers: headersList })
  const publicUser = user as PublicEditUser | null
  const canEdit =
    hasPublicEditRole(publicUser) &&
    (eventId === undefined
      ? true
      : await canEditEventContentScoped(payload, publicUser, eventId))
  const previewRequested = getParam(searchParams, 'preview') === '1'
  const editRequested = getParam(searchParams, 'edit') === '1'

  return {
    canEdit,
    isPreview: canEdit && previewRequested,
    isEditMode: canEdit && editRequested,
    user: canEdit ? publicUser : null,
  }
}
