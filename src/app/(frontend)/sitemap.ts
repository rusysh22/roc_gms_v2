import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'

import config from '@payload-config'
import { getPublicBaseUrl } from '@/lib/shareMetadata'
import { getPublicArticles } from './contentData'
import { listPublicEvents } from './events/publicEvents'

// Served at /sitemap.xml. Dynamic: the marketing page plus every publicly-visible event and its
// indexable sub-pages (schedule, standings, brackets, champions, medals, sports, articles,
// announcements) and each published article. Staff surfaces, auth flows and the flat-URL redirect
// shims are intentionally absent - see robots.ts.
export const dynamic = 'force-dynamic'

const EVENT_SUBPAGES = [
  '',
  '/schedule',
  '/standings',
  '/brackets',
  '/champions',
  '/medals',
  '/sports',
  '/articles',
  '/announcements',
] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicBaseUrl()
  const now = new Date()

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
  ]

  try {
    const payload = await getPayload({ config })
    const events = await listPublicEvents(payload)

    for (const event of events) {
      const lastModified = (event as { updatedAt?: string }).updatedAt
        ? new Date((event as { updatedAt?: string }).updatedAt as string)
        : now

      for (const sub of EVENT_SUBPAGES) {
        entries.push({
          url: `${base}/events/${event.slug}${sub}`,
          lastModified,
          changeFrequency: sub === '' ? 'daily' : 'weekly',
          priority: sub === '' ? 0.9 : 0.6,
        })
      }

      const articles = await getPublicArticles(200, event.id)
      for (const article of articles) {
        const slug = (article as { slug?: string }).slug
        if (!slug) continue
        entries.push({
          url: `${base}/events/${event.slug}/articles/${slug}`,
          lastModified: (article as { published_at?: string; updatedAt?: string }).updatedAt
            ? new Date((article as { updatedAt?: string }).updatedAt as string)
            : lastModified,
          changeFrequency: 'monthly',
          priority: 0.5,
        })
      }
    }
  } catch {
    // A DB blip should degrade the sitemap to just the marketing page, not 500 it.
  }

  return entries
}
