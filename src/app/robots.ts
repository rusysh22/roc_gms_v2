import type { MetadataRoute } from 'next'

import { getPublicBaseUrl } from '@/lib/shareMetadata'

// Served at /robots.txt. Public event pages are open to crawlers; staff surfaces, auth flows,
// the Payload admin/API, and the legacy flat-URL redirect shims (/standings, /brackets, ...) are
// not useful in an index and are disallowed.
export default function robots(): MetadataRoute.Robots {
  const base = getPublicBaseUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api/',
          '/workspaces/',
          '/scheduler/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/standings',
          '/brackets',
          '/schedule',
          '/matches',
          '/champions',
          '/articles',
          '/announcements',
          '/sports',
          '/events/*/display',
          '/events/*/broadcast',
          '/events/*/poster',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
