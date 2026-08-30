import { cookies, headers as getHeaders } from 'next/headers'
import type { Payload } from 'payload'

import { canAccessEvent, getAccessibleEventIds } from '@/access/eventMembership'
import type { UserRole } from '@/access/roles'

type ActiveEventUser = { id: string | number; roles?: UserRole[] | null }

// Event = the "company"/tenant every master-data and transaction collection is scoped to
// (event_id on Sports, Categories, Clubs, Teams, Players, Entries, Matches, ...). One admin
// account can own several events, so the workspace needs an explicit "which event am I working
// in right now" concept instead of every page silently guessing the earliest-starting one.
export const ACTIVE_EVENT_COOKIE = 'active_event_id'

export type ActiveEventDoc = {
  id: string | number
  name?: string | null
  slug?: string | null
  status?: string | null
  event_start_at?: string | null
  event_end_at?: string | null
  // Per-tournament timezone (IANA name) - pass through resolveEventTimezone() (src/lib/timezone.ts)
  // before handing to any date/time formatter, rather than assuming WIB directly.
  timezone?: string | null
}

// `depth` defaults to 0 (the shape every caller needing just the base scalar fields wants) but a
// page that also needs a populated relationship/upload field (e.g. Appearance needs
// `banner_image` populated) can pass `depth: 1` to get that in the same round trip, instead of
// calling this at depth 0 and then re-fetching the same event by ID a second time at depth 1.
export const getActiveEvent = async (
  payload: Payload,
  depth: 0 | 1 = 0,
): Promise<ActiveEventDoc | null> => {
  const cookieStore = await cookies()
  const cookieEventId = cookieStore.get(ACTIVE_EVENT_COOKIE)?.value

  // Resolves the caller itself (same pattern as getCurrentPublicUser.ts) so none of this file's
  // ~40 call sites need to be touched to pass a user through - every one of them gets this
  // membership scoping for free.
  const { user } = await payload.auth({ headers: await getHeaders() })
  const scopeUser = user as ActiveEventUser | null

  if (cookieEventId) {
    const event = await payload
      .findByID({ collection: 'events', id: cookieEventId, depth })
      .catch(() => null)
    // AUDIT_E2E AUTH-01 follow-up "per-user event access": trust the cookie only if this user can
    // still actually reach that event - it may have been set before their membership was removed,
    // or (before this fix) never validated against membership at all, which is exactly how one
    // account's admin panel could end up showing another account's event.
    if (event && scopeUser && (await canAccessEvent(payload, scopeUser, event.id))) {
      return event as ActiveEventDoc
    }
  }

  if (!scopeUser) {
    return null
  }

  // No (valid) cookie - fall back to this user's own earliest-starting event, matching this app's
  // original single-event assumption, but scoped to what they're actually a member of. Never a
  // bare global fallback (the previous behavior): a freshly logged-in user with no active-event
  // cookie must not be handed an event they have no relationship to just because it happens to
  // start first system-wide.
  const accessibleEventIds = await getAccessibleEventIds(payload, scopeUser)
  if (accessibleEventIds !== 'all' && accessibleEventIds.length === 0) {
    return null
  }

  // An archived event is a retired/discarded one - never auto-select it as the fallback active
  // event (a discard clears the cookie, so without this the workspace could land right back on it).
  const notArchived = { status: { not_equals: 'archived' } }
  const fallback = await payload.find({
    collection: 'events',
    depth,
    limit: 1,
    sort: 'event_start_at',
    where:
      accessibleEventIds === 'all'
        ? notArchived
        : { and: [{ id: { in: accessibleEventIds } }, notArchived] },
  })
  return (fallback.docs[0] as ActiveEventDoc) || null
}

// Scoped to the events this user is actually a member of (AUDIT_E2E AUTH-01) - previously this had
// no where clause at all, so every staff account saw and could pick every event in the system
// regardless of role or assignment.
export const listEventsForSwitcher = async (
  payload: Payload,
  user: { id: string | number; roles?: UserRole[] | null },
): Promise<ActiveEventDoc[]> => {
  const accessibleEventIds = await getAccessibleEventIds(payload, user)
  // Archived events are hidden from the switcher - a discarded/retired event should stop cluttering
  // the picker. It's still reachable through Payload admin or a direct link if it needs restoring.
  const notArchived = { status: { not_equals: 'archived' } }
  const result = await payload.find({
    collection: 'events',
    depth: 0,
    limit: 100,
    sort: '-event_start_at',
    where:
      accessibleEventIds === 'all'
        ? notArchived
        : { and: [{ id: { in: accessibleEventIds } }, notArchived] },
  })
  return result.docs as ActiveEventDoc[]
}
