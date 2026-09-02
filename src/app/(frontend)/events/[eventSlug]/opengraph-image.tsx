import { getPayload } from 'payload'

import config from '@payload-config'
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/lib/ogCard'
import { eventShareCopy } from '@/lib/shareMessages'
import { formatEventDateRange } from '@/lib/eventDates'
import { getEventThemePreset } from '@/lib/eventTheme'
import { resolveEventTimezone } from '@/lib/timezone'
import { getPublicEventBySlug } from '../publicEvents'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Tournament on InTourney'

type Params = { params: Promise<{ eventSlug: string }> }

export default async function EventOpengraphImage({ params }: Params) {
  const { eventSlug } = await params
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)

  if (!event) {
    const copy = eventShareCopy('Tournament')
    return renderOgCard({ eyebrow: copy.eyebrow, title: copy.title, subtitle: copy.description })
  }

  const tz = resolveEventTimezone(event.timezone)
  const dateLabel =
    event.event_start_at && event.event_end_at
      ? formatEventDateRange(event.event_start_at, event.event_end_at, tz)
      : null
  const copy = eventShareCopy(event.name, {
    dateLabel,
    location: event.location,
    tagline: event.hero_tagline,
  })

  return renderOgCard({
    eyebrow: copy.eyebrow,
    title: copy.title,
    subtitle: copy.description,
    accent: getEventThemePreset(event.theme_config?.preset).colors.primary,
  })
}
