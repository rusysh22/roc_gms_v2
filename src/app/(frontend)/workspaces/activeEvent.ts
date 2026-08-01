import { cookies } from 'next/headers'
import type { Payload } from 'payload'

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

  if (cookieEventId) {
    const event = await payload
      .findByID({ collection: 'events', id: cookieEventId, depth })
      .catch(() => null)
    if (event) {
      return event as ActiveEventDoc
    }
  }

  // No cookie yet (first visit) or it pointed at a deleted event - fall back to the
  // earliest-starting event, matching this app's original single-event assumption.
  const fallback = await payload.find({
    collection: 'events',
    depth,
    limit: 1,
    sort: 'event_start_at',
  })
  return (fallback.docs[0] as ActiveEventDoc) || null
}

export const listEventsForSwitcher = async (payload: Payload): Promise<ActiveEventDoc[]> => {
  const result = await payload.find({
    collection: 'events',
    depth: 0,
    limit: 100,
    sort: '-event_start_at',
  })
  return result.docs as ActiveEventDoc[]
}
