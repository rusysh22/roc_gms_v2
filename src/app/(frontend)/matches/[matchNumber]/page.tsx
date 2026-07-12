import { getPayload } from 'payload'
import { notFound, redirect } from 'next/navigation'

import config from '@payload-config'
import { getRelationshipId } from '../../contentData'
import { getDefaultPublicEvent, getPublicEventBySlug } from '../../events/publicEvents'

// Legacy flat URL, kept alive so old bookmarks/shared links don't break - redirects to the
// match's own event under /events/[slug]/matches/[matchNumber] (falls back to the default event
// if the match can't be resolved directly, so the link still lands somewhere sensible).
export default async function LegacyMatchRedirect({
  params,
}: {
  params: Promise<{ matchNumber: string }>
}) {
  const { matchNumber } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 1,
    where: { match_number: { equals: matchNumber } },
  })
  const eventId = getRelationshipId(result.docs[0]?.event_id as never)
  const event = eventId
    ? await payload.findByID({ collection: 'events', id: eventId, depth: 0 }).catch(() => null)
    : null
  const resolvedEvent = event ? await getPublicEventBySlug(payload, String(event.slug)) : null
  const fallbackEvent = resolvedEvent || (await getDefaultPublicEvent(payload))
  if (!fallbackEvent) {
    notFound()
  }
  redirect(`/events/${fallbackEvent.slug}/matches/${matchNumber}`)
}
