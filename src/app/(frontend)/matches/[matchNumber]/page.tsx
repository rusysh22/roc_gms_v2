import { notFound } from 'next/navigation'

import { getMatchDetail } from '../../matchDetailData'
import {
  CommentList,
  DocumentationAssetList,
  MatchSetsTable,
  formatDateTime,
  formatStatus,
  getRelationshipLabel,
} from '../../workspaces/workspaceComponents'

export const dynamic = 'force-dynamic'

type MatchPageParams = Promise<{ matchNumber: string }>

export default async function PublicMatchDetailPage({ params }: { params: MatchPageParams }) {
  const { matchNumber } = await params
  const result = await getMatchDetail(matchNumber)

  if (!result || !result.match.is_public) {
    notFound()
  }

  const { match, matchSets, documentationAssets, comments } = result
  const publicDocumentationAssets = documentationAssets.filter(
    (asset) => asset.visibility === 'public',
  )
  const publicComments = comments.filter(
    (comment) => comment.comment_type === 'public' && comment.status === 'approved',
  )

  return (
    <main className="match-detail-shell">
      <section className="schedule-header" aria-labelledby="match-detail-title">
        <p className="eyebrow">
          {getRelationshipLabel(match.sport_id)} / {getRelationshipLabel(match.category_id)}
        </p>
        <h1 id="match-detail-title">{match.match_number}</h1>
        <p className="summary">
          {match.round_name || 'Match'} &middot; {formatStatus(match.status)}
        </p>
        <div className="actions">
          <a href="/schedule">Public Schedule</a>
          <a href="/standings">Standings</a>
          <a href="/">Home</a>
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
          <h2>Score Summary</h2>
          <p>{match.score_summary || 'Score summary not published yet.'}</p>
          <MatchSetsTable sets={matchSets} />
        </article>

        <article className="workspace-panel">
          <h2>Documentation</h2>
          <DocumentationAssetList assets={publicDocumentationAssets} />
        </article>

        <article className="workspace-panel">
          <h2>Comments</h2>
          <CommentList comments={publicComments} />
        </article>
      </section>
    </main>
  )
}
