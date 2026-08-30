// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

// The docs site is a standalone Astro + Starlight project, deployed separately from the InTourney
// application and served at https://docs.intourney.id (see README.md in this folder). Its only
// content source is src/content/docs/*.md — the same files that used to live in /documentation.
export default defineConfig({
  site: 'https://docs.intourney.id',
  integrations: [
    starlight({
      title: 'InTourney Docs',
      description:
        'User documentation for InTourney — planning and running multi-sport tournaments and games.',
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      lastUpdated: true,
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
  ],
})
