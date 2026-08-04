import { cache } from 'react'
import { headers as getHeaders } from 'next/headers'
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
  hero_tagline?: string | null
  event_start_at: string
  event_end_at: string
  registration_open_at?: string | null
  registration_close_at?: string | null
  visibility?: string | null
  status?: string | null
  location?: string | null
  organizer_name?: string | null
  contact_email?: string | null
  logo?: EventBannerImage | string | number | null
  banner_image?: EventBannerImage | string | number | null
  theme_config?: EventThemeConfig | null
  // MSG-02
  medal_tally_enabled?: boolean | null
  medal_ranking_method?: 'gold_first' | 'weighted_points' | null
  medal_points_gold?: number | null
  medal_points_silver?: number | null
  medal_points_bronze?: number | null
}

// "hidden" (never published) and "preview_only" (admin/member preview, not yet a public teaser)
// must never resolve on the public site - see AUDIT_E2E EVT-01, which found both being treated as
// fully public. Kept in sync with the collection-boundary check in
// src/access/eventVisibility.ts (PUBLIC_EVENT_VISIBILITY_VALUES).
const PUBLIC_VISIBILITY = { in: ['coming_soon', 'published', 'archived'] } as const
// Any authenticated staff account may still resolve a hidden/preview_only event through the
// public route - that's exactly what the "Preview" mode in PublicEditToolbar
// (src/app/(frontend)/publicEditComponents.tsx) relies on. Only truly anonymous visitors are held
// to PUBLIC_VISIBILITY.
const STAFF_PREVIEW_VISIBILITY = { not_equals: 'hidden' } as const

// Wrapped in React's cache() so this only ever checks the session once per request even though
// several pages/layouts call getPublicEventBySlug independently.
const isRequestFromAuthenticatedStaff = cache(async (payload: Payload) => {
  const headersList = await getHeaders()
  const { user } = await payload.auth({ headers: headersList })
  return Boolean(user)
})

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
    const isStaff = await isRequestFromAuthenticatedStaff(payload)
    const result = await payload.find({
      collection: 'events',
      depth: 1,
      limit: 1,
      where: {
        and: [{ slug: { equals: slug } }, { visibility: isStaff ? STAFF_PREVIEW_VISIBILITY : PUBLIC_VISIBILITY }],
      },
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
