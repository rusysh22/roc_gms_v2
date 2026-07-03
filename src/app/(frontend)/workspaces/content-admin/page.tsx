import { getPayload } from 'payload'

import config from '@payload-config'
import { StatBlock, WorkspaceNav } from '../workspaceComponents'

export const dynamic = 'force-dynamic'

export default async function ContentAdminWorkspacePage() {
  const payload = await getPayload({ config })
  const [
    events,
    articles,
    publishedArticles,
    reviewArticles,
    announcements,
    publishedAnnouncements,
    activeAlerts,
    publicMatches,
    documentationNeeded,
  ] = await Promise.all([
    payload.find({ collection: 'events', limit: 1 }),
    payload.find({ collection: 'articles', limit: 1 }),
    payload.find({
      collection: 'articles',
      limit: 1,
      where: {
        status: {
          equals: 'published',
        },
      },
    }),
    payload.find({
      collection: 'articles',
      limit: 1,
      where: {
        status: {
          equals: 'review',
        },
      },
    }),
    payload.find({ collection: 'announcements', limit: 1 }),
    payload.find({
      collection: 'announcements',
      limit: 1,
      where: {
        status: {
          equals: 'published',
        },
      },
    }),
    payload.find({
      collection: 'announcements',
      limit: 1,
      where: {
        and: [
          {
            status: {
              equals: 'published',
            },
          },
          {
            urgency: {
              equals: 'urgent',
            },
          },
        ],
      },
    }),
    payload.find({
      collection: 'matches',
      limit: 1,
      where: {
        is_public: {
          equals: true,
        },
      },
    }),
    payload.find({
      collection: 'matches',
      limit: 1,
      where: {
        documentation_status: {
          equals: 'needed',
        },
      },
    }),
  ])

  return (
    <main className="workspace-shell">
      <WorkspaceNav />

      <section className="workspace-hero" aria-labelledby="content-admin-title">
        <p className="eyebrow">Content Admin Workspace</p>
        <h1 id="content-admin-title">Content Operations</h1>
        <p className="summary">
          Prepare articles, announcements, share previews, and match documentation from one focused
          content desk. Public reading pages and notification workflows are still scheduled for the
          next Phase 6 passes.
        </p>
        <div className="actions">
          <a href="/admin/collections/articles">Edit Articles</a>
          <a href="/admin/collections/announcements">Edit Announcements</a>
          <a href="/admin/collections/media">Media Library</a>
        </div>
      </section>

      <section className="workspace-stats" aria-label="Content summary">
        <StatBlock label="Events" value={events.totalDocs} />
        <StatBlock label="Articles" value={articles.totalDocs} tone="good" />
        <StatBlock label="Announcements" value={announcements.totalDocs} tone="warn" />
        <StatBlock label="Public Matches" value={publicMatches.totalDocs} tone="good" />
        <StatBlock label="Docs Needed" value={documentationNeeded.totalDocs} tone="warn" />
      </section>

      <section className="workspace-grid workspace-grid--three">
        <article className="workspace-panel">
          <h2>Article Readiness</h2>
          <p>
            {publishedArticles.totalDocs} published article(s) and {reviewArticles.totalDocs} item(s)
            in review. Use the CMS editor for event stories, match recaps, cover images, and share
            metadata.
          </p>
          <a href="/admin/collections/articles">Open article editor</a>
        </article>
        <article className="workspace-panel">
          <h2>Announcement Readiness</h2>
          <p>
            {publishedAnnouncements.totalDocs} published announcement(s), including{' '}
            {activeAlerts.totalDocs} urgent alert(s). Targeting is ready for event, sport, category,
            and match updates.
          </p>
          <a href="/admin/collections/announcements">Open announcement editor</a>
        </article>
        <article className="workspace-panel">
          <h2>Share Assets</h2>
          <p>
            Upload reusable article covers and share images in the media library. Public article
            pages, announcement feeds, email, and calendar export remain deliberately outside 6A.
          </p>
          <a href="/admin/collections/media">Open media library</a>
        </article>
      </section>
    </main>
  )
}
