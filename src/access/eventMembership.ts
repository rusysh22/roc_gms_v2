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

/** Membership is required, full stop: a staff account only reaches an event it has an explicit
 * EventMemberships row for (super_admin always bypasses). Events.ts's enrollCreatorAsMember hook
 * enrolls the creator the moment an event is made, so this never blocks the person who actually
 * made it - it only blocks everyone else. (Earlier this had a "zero-membership events are open to
 * any staff" fallback for pre-existing events; removed per explicit product decision - an event
 * an admin didn't create/get added to must not appear in their admin panel at all, only through
 * the public site like any other visitor.) */
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
    where: { and: [{ event_id: { equals: eventId } }, { user_id: { equals: user.id } }] },
  })

  return membershipsForEvent.totalDocs > 0
}

/** Same membership-required rule as canAccessEvent, applied across every event at once - used to
 * filter the workspace event switcher (and, via eventScope.ts/eventVisibility.ts, every
 * event-scoped collection's access control) so a non-member never even sees an event they don't
 * belong to. */
export const getAccessibleEventIds = async (
  payload: Payload,
  user: MembershipUser,
): Promise<(string | number)[] | 'all'> => {
  if (user.roles?.includes('super_admin')) {
    return 'all'
  }

  const membershipsResult = await payload.find({
    collection: 'event-memberships',
    depth: 0,
    limit: 1000,
    where: { user_id: { equals: user.id } },
  })

  // A user can hold more than one membership row per event (e.g. distinct sport_ids scoping) -
  // dedupe by string key while keeping the original id value/type for the returned list.
  const uniqueById = new Map<string, string | number>()
  for (const membership of membershipsResult.docs) {
    const eventId = getRelationId(membership.event_id)
    if (eventId !== undefined) {
      uniqueById.set(String(eventId), eventId)
    }
  }

  return [...uniqueById.values()]
}
