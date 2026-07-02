import { getPayload } from 'payload'

import config from '@payload-config'
import { StatBlock, WorkspaceNav, formatDateTime } from '../workspaceComponents'

export const dynamic = 'force-dynamic'

type EventDoc = {
  name?: string
  status?: string
  visibility?: string
  event_start_at?: string
  event_end_at?: string
  public_open_at?: string
  location?: string
}

const readinessLabels = [
  'Event information',
  'Sports',
  'Competition categories',
  'Rulesets',
  'Clubs',
  'Players',
  'Teams',
  'Entries',
  'Venues',
  'Courts',
  'Matches',
]

export default async function EventAdminWorkspacePage() {
  const payload = await getPayload({ config })
  const [
    events,
    sports,
    categories,
    rulesets,
    clubs,
    players,
    teams,
    entries,
    venues,
    courts,
    matches,
  ] = await Promise.all([
    payload.find({ collection: 'events', limit: 1, sort: 'event_start_at' }),
    payload.find({ collection: 'sports', limit: 1 }),
    payload.find({ collection: 'competition-categories', limit: 1 }),
    payload.find({ collection: 'rulesets', limit: 1 }),
    payload.find({ collection: 'clubs', limit: 1 }),
    payload.find({ collection: 'players', limit: 1 }),
    payload.find({ collection: 'teams', limit: 1 }),
    payload.find({ collection: 'competition-entries', limit: 1 }),
    payload.find({ collection: 'venues', limit: 1 }),
    payload.find({ collection: 'courts', limit: 1 }),
    payload.find({ collection: 'matches', limit: 1 }),
  ])

  const event = events.docs[0] as EventDoc | undefined
  const readiness = [
    Boolean(event),
    sports.totalDocs > 0,
    categories.totalDocs > 0,
    rulesets.totalDocs > 0,
    clubs.totalDocs > 0,
    players.totalDocs > 0,
    teams.totalDocs > 0,
    entries.totalDocs > 0,
    venues.totalDocs > 0,
    courts.totalDocs > 0,
    matches.totalDocs > 0,
  ]
  const completedCount = readiness.filter(Boolean).length

  return (
    <main className="workspace-shell">
      <WorkspaceNav />

      <section className="workspace-hero" aria-labelledby="event-admin-title">
        <p className="eyebrow">Event Admin Workspace</p>
        <h1 id="event-admin-title">{event?.name || 'Event Setup'}</h1>
        <p className="summary">
          Setup progress for the active event structure. Use Payload Admin as the backoffice editor
          while this workspace grows into the committee setup cockpit.
        </p>
        <div className="actions">
          <a href="/admin/collections/events">Manage Event</a>
          <a href="/admin/collections/sports">Sports</a>
          <a href="/admin/collections/competition-categories">Categories</a>
          <a href="/admin/collections/competition-entries">Entries</a>
        </div>
      </section>

      <section className="workspace-stats" aria-label="Event setup summary">
        <StatBlock label="Readiness" value={`${completedCount}/${readiness.length}`} tone="good" />
        <StatBlock label="Sports" value={sports.totalDocs} />
        <StatBlock label="Categories" value={categories.totalDocs} />
        <StatBlock label="Matches" value={matches.totalDocs} />
      </section>

      <section className="workspace-grid workspace-grid--two">
        <article className="workspace-panel">
          <h2>Readiness Checklist</h2>
          <div className="checklist">
            {readinessLabels.map((label, index) => (
              <div className="checklist-item" key={label}>
                <span aria-hidden="true">{readiness[index] ? 'OK' : 'TODO'}</span>
                <p>{label}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="workspace-panel">
          <h2>Event Window</h2>
          <dl className="workspace-facts">
            <div>
              <dt>Status</dt>
              <dd>{event?.status?.replaceAll('_', ' ') || 'not set'}</dd>
            </div>
            <div>
              <dt>Visibility</dt>
              <dd>{event?.visibility?.replaceAll('_', ' ') || 'not set'}</dd>
            </div>
            <div>
              <dt>Starts</dt>
              <dd>{formatDateTime(event?.event_start_at)}</dd>
            </div>
            <div>
              <dt>Public opens</dt>
              <dd>{formatDateTime(event?.public_open_at)}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{event?.location || 'not set'}</dd>
            </div>
          </dl>
        </article>
      </section>
    </main>
  )
}
