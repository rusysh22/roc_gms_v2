import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { getPublicEventBySlug } from '@/app/(frontend)/events/publicEvents'

// Lightweight branding-only lookup for the header nav (see PublicChrome/HeaderBrand in
// public-chrome.tsx). A dedicated endpoint rather than reusing the full event page's own data
// fetch: the header is rendered by the root layout, one level above the /events/[eventSlug] route
// tree, so it has no server-side access to that route's already-fetched `event` object - only the
// URL (via usePathname in a client component). Kept intentionally tiny (name + logo URL only, not
// the full PublicEventDoc) since it's fetched on every event-page navigation.
export async function GET(_request: Request, { params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)

  if (!event) {
    return NextResponse.json(null, { status: 404 })
  }

  const logo = event.logo && typeof event.logo === 'object' ? event.logo : null

  return NextResponse.json({ name: event.name, logoUrl: logo?.url || null })
}
