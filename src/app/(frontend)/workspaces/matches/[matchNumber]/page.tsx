import { notFound } from 'next/navigation'

import { getMatchDetail } from '../../../matchDetailData'
import {
  MatchSetsTable,
  WorkspaceNav,
  formatDateTime,
  formatStatus,
  getRelationshipLabel,
  getSetWinnerSide,
} from '../../workspaceComponents'
import { ConfirmSubmitButton } from '../ConfirmSubmitButton'
import { addMatchSetAction, transitionMatchStatusAction, updateMatchSetScoreAction } from '../matchActions'
import { MATCH_ACTION_ERROR_MESSAGES, getAllowedTransitions } from '../matchLifecycle'

export const dynamic = 'force-dynamic'

type MatchPageParams = Promise<{ matchNumber: string }>
type MatchPageSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminMatchDetailPage({
  params,
  searchParams,
}: {
  params: MatchPageParams
  searchParams?: MatchPageSearchParams
}) {
  const { matchNumber } = await params
  const query = searchParams ? await searchParams : {}
  const matchUpdated = query.matchUpdated === '1'
  const matchErrorCode = typeof query.matchError === 'string' ? query.matchError : ''

  const result = await getMatchDetail(matchNumber)

  if (!result) {
    notFound()
  }

  const { match, matchSets } = result
  const allowedTransitions = getAllowedTransitions(match.status)

  return (
    <main className="workspace-shell match-detail-shell">
      <WorkspaceNav />

      <section className="workspace-hero" aria-labelledby="match-detail-title">
        <p className="eyebrow">
          {getRelationshipLabel(match.sport_id)} / {getRelationshipLabel(match.category_id)}
        </p>
        <h1 id="match-detail-title">{match.match_number}</h1>
        <p className="summary">
          {match.round_name || 'Match'} &middot; {formatStatus(match.status)}. Score input and
          lifecycle actions are available below. Documentation upload, comments, and audit logging
          arrive in a later phase.
        </p>
        <div className="actions">
          <a href="/workspaces/scheduler">Scheduler Workspace</a>
          <a href="/workspaces/match-officer">Match Officer Workspace</a>
          <a href={`/admin/collections/matches/${match.id}`}>Edit in Backoffice</a>
          {match.is_public ? <a href={`/matches/${match.match_number}`}>View Public Page</a> : null}
        </div>
      </section>

      {matchUpdated ? <p className="match-banner match-banner--success">Match updated.</p> : null}
      {matchErrorCode ? (
        <p className="match-banner match-banner--error">
          {MATCH_ACTION_ERROR_MESSAGES[matchErrorCode] || 'The last action could not be completed.'}
        </p>
      ) : null}

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
          <h2>Match Actions</h2>
          {allowedTransitions.length === 0 ? (
            <p className="empty-state">No lifecycle actions available for the current status.</p>
          ) : (
            <div className="match-actions">
              {allowedTransitions.map((transition) => (
                <form
                  key={transition.to}
                  action={transitionMatchStatusAction}
                  className="match-action-form"
                >
                  <input type="hidden" name="matchNumber" value={match.match_number} />
                  <input type="hidden" name="targetStatus" value={transition.to} />
                  {transition.requiresWinnerSelection ? (
                    <label className="match-action-form__winner">
                      <span>Winner</span>
                      <select name="winnerSide" defaultValue="">
                        <option value="">No winner / draw</option>
                        <option value="a">{getRelationshipLabel(match.participant_a_entry_id)}</option>
                        <option value="b">{getRelationshipLabel(match.participant_b_entry_id)}</option>
                      </select>
                    </label>
                  ) : null}
                  {transition.requiresConfirm ? (
                    <ConfirmSubmitButton
                      className="match-action-button"
                      confirmMessage={`${transition.label}. Are you sure?`}
                    >
                      {transition.label}
                    </ConfirmSubmitButton>
                  ) : (
                    <button type="submit" className="match-action-button">
                      {transition.label}
                    </button>
                  )}
                </form>
              ))}
            </div>
          )}
        </article>

        <article className="workspace-panel match-detail-grid__wide">
          <h2>Score Input</h2>
          {matchSets.length === 0 ? (
            <p className="empty-state">No match sets recorded yet.</p>
          ) : (
            <div className="match-set-forms">
              {matchSets.map((set) => (
                <form
                  key={set.id}
                  action={updateMatchSetScoreAction}
                  className="match-set-form"
                >
                  <input type="hidden" name="matchNumber" value={match.match_number} />
                  <input type="hidden" name="matchSetId" value={set.id} />
                  <div className="match-set-form__row">
                    <span className="match-set-form__label">Set {set.set_number}</span>
                    <label>
                      <span>{getRelationshipLabel(match.participant_a_entry_id)}</span>
                      <input
                        type="number"
                        name="participantAScore"
                        min={0}
                        defaultValue={set.participant_a_score ?? 0}
                      />
                    </label>
                    <label>
                      <span>{getRelationshipLabel(match.participant_b_entry_id)}</span>
                      <input
                        type="number"
                        name="participantBScore"
                        min={0}
                        defaultValue={set.participant_b_score ?? 0}
                      />
                    </label>
                  </div>
                  <label>
                    <span>Set Winner</span>
                    <select name="winnerSide" defaultValue={getSetWinnerSide(match, set)}>
                      <option value="">Not decided</option>
                      <option value="a">{getRelationshipLabel(match.participant_a_entry_id)}</option>
                      <option value="b">{getRelationshipLabel(match.participant_b_entry_id)}</option>
                    </select>
                  </label>
                  <label>
                    <span>Notes</span>
                    <textarea name="notes" rows={2} defaultValue={set.notes || ''} />
                  </label>
                  <button type="submit" className="match-action-button">
                    Save Set {set.set_number}
                  </button>
                </form>
              ))}
            </div>
          )}

          <form action={addMatchSetAction} className="match-set-form--add">
            <input type="hidden" name="matchNumber" value={match.match_number} />
            <button type="submit" className="match-action-button match-action-button--muted">
              Add Set {matchSets.length + 1}
            </button>
          </form>
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
