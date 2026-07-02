import { getPayload } from 'payload'

import config from '@payload-config'

export const dynamic = 'force-dynamic'

type RelationshipDoc = {
  name?: string
  display_name?: string
}

type QueueMatch = {
  id: string | number
  match_number: string
  round_name?: string | null
  scheduled_start_at?: string | null
  status: string
  generation_source?: string | null
  sport_id?: RelationshipDoc | string | number | null
  category_id?: RelationshipDoc | string | number | null
  participant_a_entry_id?: RelationshipDoc | string | number | null
  participant_b_entry_id?: RelationshipDoc | string | number | null
  venue_id?: RelationshipDoc | string | number | null
  court_id?: RelationshipDoc | string | number | null
}

const getRelationshipLabel = (
  value: RelationshipDoc | string | number | null | undefined,
  fallback = 'TBD',
) => {
  if (!value || typeof value === 'string' || typeof value === 'number') {
    return fallback
  }

  return value.display_name || value.name || fallback
}

const formatTime = (value?: string | null) => {
  if (!value) {
    return 'Not scheduled'
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value))
}

const MatchQueueItem = ({ match }: { match: QueueMatch }) => (
  <article className="queue-item">
    <div>
      <p className="match-meta">
        {getRelationshipLabel(match.sport_id)} / {getRelationshipLabel(match.category_id)}
      </p>
      <h2>{match.match_number}</h2>
      <p className="match-round">{match.round_name || 'Match'}</p>
    </div>

    <div className="match-participants">
      <span>{getRelationshipLabel(match.participant_a_entry_id)}</span>
      <strong>vs</strong>
      <span>{getRelationshipLabel(match.participant_b_entry_id)}</span>
    </div>

    <dl className="match-details">
      <div>
        <dt>Time</dt>
        <dd>{formatTime(match.scheduled_start_at)}</dd>
      </div>
      <div>
        <dt>Venue</dt>
        <dd>{getRelationshipLabel(match.venue_id)}</dd>
      </div>
      <div>
        <dt>Court</dt>
        <dd>{getRelationshipLabel(match.court_id)}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{match.status.replaceAll('_', ' ')}</dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd>{(match.generation_source || 'manual').replaceAll('_', ' ')}</dd>
      </div>
    </dl>
  </article>
)

export default async function SchedulerQueuePage() {
  const payload = await getPayload({ config })
  const matches = await payload.find({
    collection: 'matches',
    depth: 2,
    limit: 100,
    sort: 'scheduled_start_at',
  })

  const queueMatches = matches.docs as QueueMatch[]
  const unscheduledMatches = queueMatches.filter((match) => !match.scheduled_start_at)
  const scheduledMatches = queueMatches.filter((match) => Boolean(match.scheduled_start_at))

  return (
    <main className="schedule-shell">
      <section className="schedule-header" aria-labelledby="queue-title">
        <p className="eyebrow">Scheduler Queue</p>
        <h1 id="queue-title">Match Queue</h1>
        <p className="summary">
          Unscheduled generated matches and scheduled demo matches for ROC Olympic 2026.
        </p>
        <div className="actions">
          <a href="/schedule">Public Schedule</a>
          <a href="/admin/collections/matches">Backoffice Matches</a>
        </div>
      </section>

      <section className="queue-columns" aria-label="Match scheduling queue">
        <div>
          <div className="queue-heading">
            <h2>Unscheduled</h2>
            <span>{unscheduledMatches.length}</span>
          </div>
          <div className="schedule-list">
            {unscheduledMatches.length === 0 ? (
              <p className="empty-state">No unscheduled matches.</p>
            ) : (
              unscheduledMatches.map((match) => <MatchQueueItem key={match.id} match={match} />)
            )}
          </div>
        </div>

        <div>
          <div className="queue-heading">
            <h2>Scheduled</h2>
            <span>{scheduledMatches.length}</span>
          </div>
          <div className="schedule-list">
            {scheduledMatches.length === 0 ? (
              <p className="empty-state">No scheduled matches.</p>
            ) : (
              scheduledMatches.map((match) => <MatchQueueItem key={match.id} match={match} />)
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
