import { getPayload } from 'payload'
import { notFound, redirect } from 'next/navigation'

import config from '@payload-config'
import { getRelationshipId } from '../../contentData'
import { getDefaultPublicEvent, getPublicEventBySlug } from '../../events/publicEvents'

// Legacy flat URL, kept alive so old bookmarks/shared links don't break - redirects to the
// article's own event under /events/[slug]/articles/[slug] (falls back to the default event if
// the article can't be resolved directly, so the link still lands somewhere sensible).
export default async function LegacyArticleRedirect({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'articles',
    depth: 0,
    limit: 1,
    where: { slug: { equals: slug } },
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
  redirect(`/events/${fallbackEvent.slug}/articles/${slug}`)
}
