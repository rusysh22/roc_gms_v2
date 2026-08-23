import type { Access } from 'payload'

import { getAccessibleEventIds } from './eventMembership'
import type { UserRole } from './roles'

type ScopeUser = { id: string | number; roles?: UserRole[] | null }

/** Wraps a role-based Access function used for `read`/`update`/`delete` with event-membership
 * scoping: the role check still gates *capability* (e.g. "is this an event_admin at all"), this
 * narrows *which event's* rows that capability actually reaches, via `getAccessibleEventIds` -
 * an explicit EventMemberships row for that event (or super_admin) is required, full stop. An
 * event's creator is auto-enrolled as its first member (Events.ts's enrollCreatorAsMember), so
 * this never locks someone out of what they just made - it only keeps everyone else out. */
export const scopedToUserEvents = (roleAccess: Access, eventIdField = 'event_id'): Access => {
  return async (args) => {
    const allowed = await roleAccess(args)
    if (!allowed) {
      return false
    }

    const { req } = args
    if (!req.user) {
      return false
    }

    const accessibleIds = await getAccessibleEventIds(req.payload, req.user as ScopeUser)
    if (accessibleIds === 'all') {
      return true
    }

    return { [eventIdField]: { in: accessibleIds } }
  }
}

/** Same idea for `create`, where there's no existing row for a Where clause to filter (Payload
 * create access must resolve to a boolean) - checks the incoming `data[eventIdField]` against the
 * caller's accessible-event set directly instead. */
export const scopedCreateToUserEvents = (roleAccess: Access, eventIdField = 'event_id'): Access => {
  return async (args) => {
    const allowed = await roleAccess(args)
    if (!allowed) {
      return false
    }

    const { req, data } = args
    if (!req.user) {
      return false
    }

    const accessibleIds = await getAccessibleEventIds(req.payload, req.user as ScopeUser)
    if (accessibleIds === 'all') {
      return true
    }

    const eventId = (data as Record<string, unknown> | undefined)?.[eventIdField]
    if (eventId === undefined || eventId === null) {
      // No event_id on the incoming data - not this check's job to enforce required fields, let
      // the collection's own field validation reject it.
      return true
    }

    return accessibleIds.some((id) => String(id) === String(eventId))
  }
}
