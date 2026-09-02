// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import sitemap from '@astrojs/sitemap'

const SITE = 'https://docs.intourney.id'
const OG_IMAGE = `${SITE}/og.png`

// The docs site is a standalone Astro + Starlight project, deployed separately from the InTourney
// application and served at https://docs.intourney.id (see README.md in this folder). Its only
// content source is src/content/docs/*.md — the same files that used to live in /documentation.
export default defineConfig({
  site: SITE,
  // Trailing-slash consistency so canonical URLs and the sitemap agree with what nginx serves.
  trailingSlash: 'ignore',
  integrations: [
    starlight({
      title: 'InTourney Docs',
      description:
        'User documentation for InTourney — planning and running multi-sport tournaments and games.',
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      lastUpdated: true,
      favicon: '/favicon.svg',
      // Crawlers + social unfurls. Starlight already emits <title>, meta description, canonical,
      // og:title/description and the RSS-less basics; these fill in the image + Twitter card and a
      // stable site name. Per-page <title>/description still come from each file's frontmatter.
      head: [
        { tag: 'meta', attrs: { property: 'og:site_name', content: 'InTourney Docs' } },
        { tag: 'meta', attrs: { property: 'og:image', content: OG_IMAGE } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: OG_IMAGE } },
      ],
      // Explicit order and labels — the source files are plain slugs (no numeric prefixes), so the
      // reading order is defined here rather than by filename.
      sidebar: [
        { label: 'Overview', link: '/' },
        { label: 'Getting Started', slug: 'getting-started' },
        {
          label: 'Setting up an event',
          items: [
            { label: 'Creating an Event', slug: 'creating-an-event' },
            { label: 'Importing Event Data', slug: 'importing-event-data' },
            { label: 'Participants & Registration', slug: 'participants-and-registration' },
            { label: 'Draw & Match Generation', slug: 'draw-and-match-generation' },
          ],
        },
        {
          label: 'Running & publishing',
          items: [
            { label: 'Running Match Day', slug: 'running-match-day' },
            { label: 'Publishing & the Public Site', slug: 'publishing-and-public-site' },
            { label: 'Content', slug: 'content' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Roles & Permissions', slug: 'roles-and-permissions' },
            { label: 'Reference', slug: 'reference' },
            { label: 'Worked Example', slug: 'worked-example' },
          ],
        },
      ],
    }),
    sitemap(),
  ],
})
