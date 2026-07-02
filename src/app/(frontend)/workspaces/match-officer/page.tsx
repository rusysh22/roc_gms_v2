import { getPayload } from 'payload'

import config from '@payload-config'
import {
  MatchCard,
  StatBlock,
  WorkspaceMatch,
  WorkspaceNav,
  formatDateTime,
  getRelationshipLabel,
} from '../workspaceComponents'
import { transitionMatchStatusAction } from '../matches/matchActions'
import { getAllowedTransitions } from '../matches/matchLifecycle'

export const dynamic = 'force-dynamic'

const matchDayStatuses = ['published', 'scheduled', 'check_in_open', 'ready_to_start', 'ongoing']

export default async function MatchOfficerWorkspacePage() {
  const payload = await getPayload({ config })
  const matches = await payload.find({
    collection: 'matches',
    depth: 2,
    limit: 50,
    sort: 'scheduled_start_at',
    where: {
      scheduled_start_at: {
        exists: true,
      },
    },
  })

  const scheduledMatches = (matches.docs as WorkspaceMatch[]).filter((match) =>
    matchDayStatuses.includes(match.status),
  )
  const nextMatch = scheduledMatches[0]
  const quickTransitions = nextMatch
    ? getAllowedTransitions(nextMatch.status).filter((transition) => !transition.requiresConfirm)
    : []

  return (
    <main className="workspace-shell workspace-shell--officer">
      <WorkspaceNav />

      <section className="workspace-hero" aria-labelledby="match-officer-title">
        <p className="eyebrow">Match Officer Workspace</p>
        <h1 id="match-officer-title">Match-Day Flow</h1>
        <p className="summary">
          Mobile-first match list for officers on venue duty. Quick status actions for the next
          match are available below; open Match Details for score input and the full lifecycle
          action set. Documentation upload and live scoring are not enabled yet.
        </p>
      </section>

      <section className="workspace-stats" aria-label="Match officer summary">
        <StatBlock label="Ready Today" value={scheduledMatches.length} tone="good" />
        <StatBlock
          label="Documentation"
          value={scheduledMatches.filter((match) => match.documentation_status === 'needed').length}
          tone="warn"
        />
      </section>

      {nextMatch ? (
        <section className="officer-focus" aria-label="Next assigned match">
          <p className="eyebrow">Next Match</p>
          <h2>{nextMatch.match_number}</h2>
          <p>
            {getRelationshipLabel(nextMatch.participant_a_entry_id)} vs{' '}
            {getRelationshipLabel(nextMatch.participant_b_entry_id)}
          </p>
          <dl>
            <div>
              <dt>Start</dt>
              <dd>{formatDateTime(nextMatch.scheduled_start_at)}</dd>
            </div>
            <div>
              <dt>Place</dt>
              <dd>
                {getRelationshipLabel(nextMatch.venue_id)} / {getRelationshipLabel(nextMatch.court_id)}
              </dd>
            </div>
          </dl>
          <a className="match-card__details-link" href={`/workspaces/matches/${nextMatch.match_number}`}>
            Match details
          </a>

          <div className="officer-actions" aria-label="Match officer quick actions">
            {quickTransitions.length === 0 ? (
              <span>No quick actions for this status</span>
            ) : (
              quickTransitions.map((transition) => (
                <form key={transition.to} action={transitionMatchStatusAction}>
                  <input type="hidden" name="matchNumber" value={nextMatch.match_number} />
                  <input type="hidden" name="targetStatus" value={transition.to} />
                  <button type="submit" className="officer-action-button">
                    {transition.label}
                  </button>
                </form>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section aria-label="Assigned matches">
        <div className="queue-heading">
          <h2>Assigned Match List</h2>
          <span>{scheduledMatches.length}</span>
        </div>
        <div className="schedule-list">
          {scheduledMatches.length === 0 ? (
            <p className="empty-state">No scheduled match-day items are ready yet.</p>
          ) : (
            scheduledMatches.map((match) => <MatchCard key={match.id} match={match} compact />)
          )}
        </div>
      </section>
    </main>
  )
}
