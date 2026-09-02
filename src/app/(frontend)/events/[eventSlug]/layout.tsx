import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { getEventThemeStyle } from '@/lib/eventTheme'
import { eventShareCopy } from '@/lib/shareMessages'
import { formatEventDateRange } from '@/lib/eventDates'
import { resolveEventTimezone } from '@/lib/timezone'
import { getPublicEventBySlug } from '../publicEvents'

type EventLayoutParams = Promise<{ eventSlug: string }>

// The browser-tab title for every page under /events/[eventSlug]/* - home, schedule, standings,
// brackets, medals, champions, sport/category, match detail, and anything else that doesn't
// define a more specific title of its own uses `default` (the plain event name); root layout's
// own "%s | InTourney" template still applies to that, producing "<event name> | InTourney". A
// page that defines its own title (articles, updates - e.g. "Updates / <event name>") is instead
// substituted into *this* segment's own template - Next.js resolves an explicit descendant title
// against the nearest ancestor template, which is this one, not root's, so `default` and an
// explicit descendant title need the same '%s | InTourney' shape kept in sync here rather than
// left to root alone (confirmed empirically: root's template does not additionally re-apply once
// a descendant title has already been resolved through this one - only `default` still passes
// through to root untouched, since using a fallback doesn't count as "this segment resolved a
// title").
export async function generateMetadata({ params }: { params: EventLayoutParams }): Promise<Metadata> {
  const { eventSlug } = await params
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  const name = event?.name || 'Event'

  const tz = resolveEventTimezone(event?.timezone)
  const dateLabel =
    event?.event_start_at && event?.event_end_at
      ? formatEventDateRange(event.event_start_at, event.event_end_at, tz)
      : null
  const copy = eventShareCopy(name, {
    dateLabel,
    location: event?.location,
    tagline: event?.hero_tagline,
  })

  // The co-located events/[eventSlug]/opengraph-image.tsx is attached automatically by Next
  // (metadataBase is set in the root layout); this only supplies the flexible text.
  return {
    title: {
      template: '%s | InTourney',
      default: name,
    },
    description: copy.description,
    openGraph: {
      type: 'website',
      siteName: 'InTourney',
      title: name,
      description: copy.description,
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description: copy.description,
    },
  }
}

export default async function EventLayout({
  children,
  params,
}: {
  children: ReactNode
  params: EventLayoutParams
}) {
  const { eventSlug } = await params
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)

  if (!event) {
    notFound()
  }

  return <div style={getEventThemeStyle(event.theme_config?.preset)}>{children}</div>
}
