import { notFound } from 'next/navigation'

import { getMatchDetail } from '../../../matchDetailData'
import {
  MatchSetsTable,
  WorkspaceNav,
  formatDateTime,
  formatStatus,
  getRelationshipLabel,
} from '../../workspaceComponents'

export const dynamic = 'force-dynamic'

type MatchPageParams = Promise<{ matchNumber: string }>

export default async function AdminMatchDetailPage({ params }: { params: MatchPageParams }) {
  const { matchNumber } = await params
  const result = await getMatchDetail(matchNumber)

  if (!result) {
    notFound()
  }

  const { match, matchSets } = result

  return (
    <main className="workspace-shell match-detail-shell">
      <WorkspaceNav />

      <section className="workspace-hero" aria-labelledby="match-detail-title">
        <p className="eyebrow">
          {getRelationshipLabel(match.sport_id)} / {getRelationshipLabel(match.category_id)}
        </p>
        <h1 id="match-detail-title">{match.match_number}</h1>
        <p className="summary">
          {match.round_name || 'Match'} &middot; {formatStatus(match.status)}. Read-only view for
          this phase; score input, lifecycle actions, documentation upload, and comments arrive in a
          later phase.
        </p>
        <div className="actions">
          <a href="/workspaces/scheduler">Scheduler Workspace</a>
          <a href="/workspaces/match-officer">Match Officer Workspace</a>
          <a href={`/admin/collections/matches/${match.id}`}>Edit in Backoffice</a>
          {match.is_public ? <a href={`/matches/${match.match_number}`}>View Public Page</a> : null}
        </div>
      </section>

      <section className="match-detail-grid" aria-label="Match details">
        <article className="workspace-panel">
          <h2>Participants</h2>
          <div className="match-participants match-participants--detail">
            <span>{getRelationshipLabel(match.participant_a_entry_id)}</span>
            <strong>vs</strong>
            <span>{getRelationshipLabel(match.participant_b_entry_id)}</span>
          </div>
          {match.winner_entry_id ? (
            <p className="match-winner">Winner: {getRelationshipLabel(match.winner_entry_id)}</p>
          ) : null}
        </article>

        <article className="workspace-panel">
          <h2>Schedule</h2>
          <dl className="workspace-facts">
            <div>
              <dt>Starts</dt>
              <dd>{formatDateTime(match.scheduled_start_at)}</dd>
            </div>
            <div>
              <dt>Ends</dt>
              <dd>{formatDateTime(match.scheduled_end_at)}</dd>
            </div>
            <div>
              <dt>Actual Start</dt>
              <dd>{formatDateTime(match.actual_start_at)}</dd>
            </div>
            <div>
              <dt>Actual End</dt>
              <dd>{formatDateTime(match.actual_end_at)}</dd>
            </div>
            <div>
              <dt>Venue</dt>
              <dd>{getRelationshipLabel(match.venue_id)}</dd>
            </div>
            <div>
              <dt>Court</dt>
              <dd>{getRelationshipLabel(match.court_id)}</dd>
            </div>
          </dl>
        </article>

        <article className="workspace-panel">
          <h2>Competition Context</h2>
          <dl className="workspace-facts">
            <div>
              <dt>Event</dt>
              <dd>{getRelationshipLabel(match.event_id)}</dd>
            </div>
            <div>
              <dt>Stage</dt>
              <dd>{getRelationshipLabel(match.stage_id)}</dd>
            </div>
            <div>
              <dt>Group</dt>
              <dd>{getRelationshipLabel(match.group_id, 'No group')}</dd>
            </div>
            <div>
              <dt>Round</dt>
              <dd>{match.round_name || 'Not set'}</dd>
            </div>
          </dl>
        </article>

        <article className="workspace-panel">
          <h2>Operational Status</h2>
          <dl className="workspace-facts">
            <div>
              <dt>Status</dt>
              <dd>{formatStatus(match.status)}</dd>
            </div>
            <div>
              <dt>Documentation</dt>
              <dd>{formatStatus(match.documentation_status)}</dd>
            </div>
            <div>
              <dt>Generation Source</dt>
              <dd>{formatStatus(match.generation_source || 'manual')}</dd>
            </div>
            <div>
              <dt>Public Visibility</dt>
              <dd>{match.is_public ? 'Public' : 'Internal only'}</dd>
            </div>
          </dl>
        </article>

        <article className="workspace-panel match-detail-grid__wide">
          <h2>Score Summary</h2>
          <p>{match.score_summary || 'Score summary not recorded yet.'}</p>
          <MatchSetsTable sets={matchSets} />
        </article>
      </section>
    </main>
  )
}
