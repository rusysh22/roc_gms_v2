import { getPayload } from 'payload'

import config from '@payload-config'
import { StatBlock, WorkspaceNav } from '../workspaceComponents'

export const dynamic = 'force-dynamic'

export default async function ContentAdminWorkspacePage() {
  const payload = await getPayload({ config })
  const [events, publicMatches, documentationNeeded] = await Promise.all([
    payload.find({ collection: 'events', limit: 1 }),
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
          A shell for future recaps, announcements, share previews, and match documentation review.
          Article and announcement CMS features remain intentionally out of scope for this phase.
        </p>
        <div className="actions">
          <a href="/schedule">Review Public Schedule</a>
          <a href="/admin">Backoffice</a>
        </div>
      </section>

      <section className="workspace-stats" aria-label="Content summary">
        <StatBlock label="Events" value={events.totalDocs} />
        <StatBlock label="Public Matches" value={publicMatches.totalDocs} tone="good" />
        <StatBlock label="Docs Needed" value={documentationNeeded.totalDocs} tone="warn" />
      </section>

      <section className="workspace-grid workspace-grid--three">
        <article className="workspace-panel">
          <h2>Recap Queue</h2>
          <p>
            Use published matches as the first source for later recap and winner announcement work.
          </p>
        </article>
        <article className="workspace-panel">
          <h2>Share Readiness</h2>
          <p>
            Public schedule links are available now; article, announcement, WhatsApp, Teams, and
            email publishing will come in a later content phase.
          </p>
        </article>
        <article className="workspace-panel">
          <h2>Documentation Watch</h2>
          <p>
            Matches marked as needing documentation are visible for future media follow-up without
            enabling uploads yet.
          </p>
        </article>
      </section>
    </main>
  )
}
