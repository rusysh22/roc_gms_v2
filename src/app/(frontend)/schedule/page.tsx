import { getPayload } from 'payload'

import config from '@payload-config'

export const dynamic = 'force-dynamic'

type RelationshipDoc = {
  name?: string
  display_name?: string
}

type ScheduleMatch = {
  id: string | number
  match_number: string
  round_name?: string | null
  scheduled_start_at?: string | null
  scheduled_end_at?: string | null
  status: string
  score_summary?: string | null
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
    return 'Unscheduled'
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value))
}

export default async function PublicSchedulePage() {
  const payload = await getPayload({ config })
  const matches = await payload.find({
    collection: 'matches',
    depth: 2,
    limit: 50,
    sort: 'scheduled_start_at',
    where: {
      is_public: {
        equals: true,
      },
    },
  })

  const schedule = matches.docs as ScheduleMatch[]

  return (
    <main className="schedule-shell">
      <section className="schedule-header" aria-labelledby="schedule-title">
        <p className="eyebrow">Public Schedule</p>
        <h1 id="schedule-title">ROC Olympic 2026 Schedule</h1>
        <p className="summary">
          Published matches for Badminton and Futsal. This is the first schedule list foundation;
          filters and match details will grow in later phases.
        </p>
        <div className="actions">
          <a href="/">Home</a>
          <a href="/admin/collections/matches">Backoffice Matches</a>
        </div>
      </section>

      <section className="schedule-list" aria-label="Published matches">
        {schedule.length === 0 ? (
          <p className="empty-state">No public matches have been published yet.</p>
        ) : (
          schedule.map((match) => (
            <article className="schedule-item" key={match.id}>
              <div>
                <p className="match-meta">
                  {getRelationshipLabel(match.sport_id)} / {getRelationshipLabel(match.category_id)}
                </p>
                <h2>{match.match_number}</h2>
                <p className="match-round">{match.round_name || 'Scheduled Match'}</p>
              </div>

              <div className="match-participants">
                <span>{getRelationshipLabel(match.participant_a_entry_id)}</span>
                <strong>vs</strong>
                <span>{getRelationshipLabel(match.participant_b_entry_id)}</span>
              </div>

              <dl className="match-details">
                <div>
                  <dt>Starts</dt>
                  <dd>{formatTime(match.scheduled_start_at)}</dd>
                </div>
                <div>
                  <dt>Ends</dt>
                  <dd>{formatTime(match.scheduled_end_at)}</dd>
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
              </dl>

              <a className="match-card__details-link" href={`/matches/${match.match_number}`}>
                View match details
              </a>
            </article>
          ))
        )}
      </section>
    </main>
  )
}
