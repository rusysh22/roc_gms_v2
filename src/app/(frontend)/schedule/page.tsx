import { getPayload } from 'payload'
import { notFound, redirect } from 'next/navigation'

import config from '@payload-config'
import { getDefaultPublicEvent } from '../events/publicEvents'

// Legacy flat URL, kept alive so old bookmarks/shared links don't break - redirects to the
// current default event's version of this page under /events/[slug]/...
export default async function LegacyScheduleRedirect({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>
}) {
  const { sport } = await searchParams
  const payload = await getPayload({ config })
  const event = await getDefaultPublicEvent(payload)
  if (!event) {
    notFound()
  }
  redirect(`/events/${event.slug}/schedule${sport ? `?sport=${sport}` : ''}`)
}
