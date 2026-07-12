import { cache } from 'react'
import type { Payload } from 'payload'

export type EventThemeConfig = {
  preset?: string
}

export type EventBannerImage = {
  id: string | number
  url?: string | null
  alt?: string | null
  sizes?: { thumbnail?: { url?: string | null } }
}

// Event = the tenant every public page is scoped under (see workspaces/activeEvent.ts for the
// admin-side equivalent). Public visitors have no session/cookie, so the event is resolved from
// the URL slug instead - every shareable link stays pinned to one specific event.
export type PublicEventDoc = {
  id: string | number
  name: string
  slug: string
  description?: string | null
  event_start_at: string
  event_end_at: string
  visibility?: string | null
  status?: string | null
  location?: string | null
  banner_image?: EventBannerImage | string | number | null
  theme_config?: EventThemeConfig | null
}

// "hidden" events are the only visibility state that should never appear on the public site;
// everything else (coming_soon/preview_only/published/archived) is meant to be reachable.
const PUBLIC_VISIBILITY = { not_equals: 'hidden' } as const

export const listPublicEvents = async (payload: Payload): Promise<PublicEventDoc[]> => {
  const result = await payload.find({
    collection: 'events',
    depth: 1,
    limit: 100,
    sort: '-event_start_at',
    where: { visibility: PUBLIC_VISIBILITY },
  })
  return result.docs as PublicEventDoc[]
}

// Wrapped in React's cache() so the layout and the page (and any nested page needing the event
// again) all resolve the same slug within one request without repeating the query.
export const getPublicEventBySlug = cache(
  async (payload: Payload, slug: string): Promise<PublicEventDoc | null> => {
    if (!slug) {
      return null
    }
    const result = await payload.find({
      collection: 'events',
      depth: 1,
      limit: 1,
      where: { and: [{ slug: { equals: slug } }, { visibility: PUBLIC_VISIBILITY }] },
    })
    return (result.docs[0] as PublicEventDoc) || null
  },
)

// Used only by the legacy flat-URL redirect shims (/standings, /brackets, ...) so old shared
// links keep working - same "most recent by start date" rule the homepage always used.
export const getDefaultPublicEvent = async (payload: Payload): Promise<PublicEventDoc | null> => {
  const result = await payload.find({
    collection: 'events',
    depth: 0,
    limit: 1,
    sort: '-event_start_at',
    where: { visibility: PUBLIC_VISIBILITY },
  })
  return (result.docs[0] as PublicEventDoc) || null
}
