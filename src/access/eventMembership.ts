import type { Payload } from 'payload'

import type { UserRole } from './roles'

type MembershipUser = {
  id: string | number
  roles?: UserRole[] | null
}

const getRelationId = (value: unknown): string | number | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }
  if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return (value as { id: string | number }).id
  }
  return undefined
}

/** An event with zero EventMemberships rows predates this feature (or was never scoped) and is
 * treated as open to any authenticated staff account - exactly how every event behaved before
 * AUDIT_E2E AUTH-01, so existing tournaments never get silently locked out. Adding at least one
 * member switches that event into per-event-scoped mode from then on. super_admin always bypasses. */
export const canAccessEvent = async (
  payload: Payload,
  user: MembershipUser,
  eventId: string | number,
): Promise<boolean> => {
  if (user.roles?.includes('super_admin')) {
    return true
  }

  const membershipsForEvent = await payload.find({
    collection: 'event-memberships',
    depth: 0,
    limit: 500,
    where: { event_id: { equals: eventId } },
  })

  if (membershipsForEvent.totalDocs === 0) {
    return true
  }

  return membershipsForEvent.docs.some(
    (membership) => String(getRelationId(membership.user_id)) === String(user.id),
  )
}

/** Same open-by-default-until-scoped rule as canAccessEvent, applied to every event at once - used
 * to filter the workspace event switcher so a scoped-out user never even sees an event they can't
 * touch (previously listEventsForSwitcher had no where clause at all). */
export const getAccessibleEventIds = async (
  payload: Payload,
  user: MembershipUser,
): Promise<(string | number)[] | 'all'> => {
  if (user.roles?.includes('super_admin')) {
    return 'all'
  }

  const [eventsResult, membershipsResult] = await Promise.all([
    payload.find({ collection: 'events', depth: 0, limit: 200, sort: '-event_start_at' }),
    payload.find({ collection: 'event-memberships', depth: 0, limit: 1000 }),
  ])

  const membersByEvent = new Map<string, Set<string>>()
  for (const membership of membershipsResult.docs) {
    const eventId = getRelationId(membership.event_id)
    const userId = getRelationId(membership.user_id)
    if (eventId === undefined || userId === undefined) {
      continue
    }
    const key = String(eventId)
    const members = membersByEvent.get(key) || new Set<string>()
    members.add(String(userId))
    membersByEvent.set(key, members)
  }

  const currentUserId = String(user.id)

  return eventsResult.docs
    .filter((event) => {
      const members = membersByEvent.get(String(event.id))
      return !members || members.has(currentUserId)
    })
    .map((event) => event.id)
}
