export type RelationshipDoc = {
  id?: string | number
  name?: string
  display_name?: string
}

export type EntryDoc = RelationshipDoc & {
  club_id?: RelationshipDoc | string | number | null
  team_id?: RelationshipDoc | string | number | null
  player_id?: RelationshipDoc | string | number | null
}

export type WorkspaceMatch = {
  id: string | number
  match_number: string
  round_name?: string | null
  scheduled_start_at?: string | null
  scheduled_end_at?: string | null
  status: string
  generation_source?: string | null
  is_public?: boolean | null
  documentation_status?: string | null
  sport_id?: RelationshipDoc | string | number | null
  category_id?: RelationshipDoc | string | number | null
  participant_a_entry_id?: EntryDoc | string | number | null
  participant_b_entry_id?: EntryDoc | string | number | null
  venue_id?: RelationshipDoc | string | number | null
  court_id?: RelationshipDoc | string | number | null
}

export type WorkspaceOption = {
  id: string
  label: string
}

export type WorkspaceMatchSet = {
  id: string | number
  set_number: number
  participant_a_score?: number | null
  participant_b_score?: number | null
  winner_entry_id?: EntryDoc | string | number | null
  notes?: string | null
}

export type StandingImpactSummaryRow = {
  id: string | number
  rank: number
  played: number
  points: number
  score_difference: number
  qualified_status: string
  entry_id?: RelationshipDoc | string | number | null
}

export type StandingImpactSummary = {
  scopeLabel: string
  rows: StandingImpactSummaryRow[]
  participantRows: StandingImpactSummaryRow[]
  reason?: string
}

export type BracketImpactSummary = {
  roundName: string
  nextMatchNumber?: string
  nextTargetSlot?: 'a' | 'b'
  nextReason: string
  isLastRound: boolean
  champion?: {
    status: 'decided' | 'pending'
    label?: string
    match_number?: string
    round_name?: string
    reason: string
  } | null
}

export const getRelationshipLabel = (
  value: RelationshipDoc | string | number | null | undefined,
  fallback = 'TBD',
) => {
  if (!value || typeof value === 'string' || typeof value === 'number') {
    return fallback
  }

  return value.display_name || value.name || fallback
}

export const getRelationshipId = (
  value: RelationshipDoc | string | number | null | undefined,
) => {
  if (!value) {
    return ''
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  return value.id ? String(value.id) : ''
}

export const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'Not scheduled'
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value))
}

export const formatStatus = (value?: string | null) =>
  value ? value.replaceAll('_', ' ') : 'not set'

export const formatAuditAction = (value?: string | null) =>
  value ? value.replaceAll('.', ' ').replaceAll('_', ' ') : 'unknown action'

export const formatTimeOnly = (value?: string | null) => {
  if (!value) {
    return '--:--'
  }

  return new Intl.DateTimeFormat('en', {
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value))
}

export const formatDateLabel = (value?: string | null) => {
  if (!value) {
    return 'Unscheduled'
  }

  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value))
}

export const getDateKey = (value?: string | null) => {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export const getSetWinnerSide = (
  match: {
    participant_a_entry_id?: EntryDoc | string | number | null
    participant_b_entry_id?: EntryDoc | string | number | null
  },
  set: { winner_entry_id?: EntryDoc | string | number | null },
): '' | 'a' | 'b' => {
  const winnerId = getRelationshipId(set.winner_entry_id)
  if (!winnerId) {
    return ''
  }

  if (winnerId === getRelationshipId(match.participant_a_entry_id)) {
    return 'a'
  }

  if (winnerId === getRelationshipId(match.participant_b_entry_id)) {
    return 'b'
  }

  return ''
}

export const toOptions = (docs: unknown[]): WorkspaceOption[] =>
  docs
    .map((doc) => {
      const candidate = doc as RelationshipDoc

      return {
        id: candidate.id ? String(candidate.id) : '',
        label: candidate.display_name || candidate.name || 'Untitled',
      }
    })
    .filter((option) => option.id)

export const StatBlock = ({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'good' | 'warn' | 'alert'
}) => (
  <div className={`workspace-stat workspace-stat--${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
)

export const MatchCard = ({
  match,
  compact = false,
}: {
  match: WorkspaceMatch
  compact?: boolean
}) => (
  <article className={compact ? 'match-card match-card--compact' : 'match-card'}>
    <div className="match-card__topline">
      <span>{getRelationshipLabel(match.sport_id)}</span>
      <span>{formatStatus(match.status)}</span>
    </div>

    <div>
      <p className="match-meta">{getRelationshipLabel(match.category_id)}</p>
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
        <dd>{formatDateTime(match.scheduled_start_at)}</dd>
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
        <dt>Source</dt>
        <dd>{formatStatus(match.generation_source || 'manual')}</dd>
      </div>
    </dl>

    <a className="match-card__details-link" href={`/workspaces/matches/${match.match_number}`}>
      Match details
    </a>
  </article>
)

export const MatchSetsTable = ({ sets }: { sets: WorkspaceMatchSet[] }) => {
  if (sets.length === 0) {
    return <p className="empty-state">No match sets recorded yet.</p>
  }

  return (
    <table className="match-sets-table">
      <thead>
        <tr>
          <th>Set</th>
          <th>Participant A</th>
          <th>Participant B</th>
          <th>Winner</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {sets.map((set) => (
          <tr key={set.id}>
            <td>{set.set_number}</td>
            <td>{set.participant_a_score ?? '-'}</td>
            <td>{set.participant_b_score ?? '-'}</td>
            <td>{getRelationshipLabel(set.winner_entry_id, 'Not decided')}</td>
            <td>{set.notes || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export const StandingImpactPanel = ({
  impact,
}: {
  impact: StandingImpactSummary | null | undefined
}) => {
  if (!impact) {
    return null
  }

  return (
    <article className="workspace-panel match-detail-grid__wide impact-panel">
      <h2>Standing Impact</h2>
      <p className="match-meta">{impact.scopeLabel}</p>
      {impact.rows.length === 0 ? (
        <p className="empty-state">
          {impact.reason || 'Standings are not calculated yet for this match scope.'}
        </p>
      ) : (
        <>
          <div className="impact-summary-grid" aria-label="Match participant standing summary">
            {impact.participantRows.length === 0 ? (
              <p className="empty-state">This match's participants are not in the standing cache yet.</p>
            ) : (
              impact.participantRows.map((row) => (
                <div className="impact-summary-card" key={row.id}>
                  <span>{getRelationshipLabel(row.entry_id)}</span>
                  <strong>#{row.rank}</strong>
                  <small>
                    {row.points} pts / {row.played} played / SD {row.score_difference}
                  </small>
                </div>
              ))
            )}
          </div>
          <div className="impact-table-wrap">
            <table className="impact-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Entry</th>
                  <th>P</th>
                  <th>Pts</th>
                  <th>SD</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {impact.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.rank}</td>
                    <td>{getRelationshipLabel(row.entry_id)}</td>
                    <td>{row.played}</td>
                    <td>{row.points}</td>
                    <td>{row.score_difference}</td>
                    <td>{formatStatus(row.qualified_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </article>
  )
}

export const BracketImpactPanel = ({
  impact,
  workspace = false,
}: {
  impact: BracketImpactSummary | null | undefined
  workspace?: boolean
}) => {
  if (!impact) {
    return null
  }

  const matchHref =
    impact.nextMatchNumber ?
      `${workspace ? '/workspaces' : ''}/matches/${impact.nextMatchNumber}`
    : ''
  const championMatchHref =
    impact.champion?.match_number ?
      `${workspace ? '/workspaces' : ''}/matches/${impact.champion.match_number}`
    : ''

  return (
    <article className="workspace-panel match-detail-grid__wide impact-panel">
      <h2>Bracket Impact</h2>
      <dl className="workspace-facts impact-facts">
        <div>
          <dt>Round</dt>
          <dd>{impact.roundName}</dd>
        </div>
        <div>
          <dt>Next Match</dt>
          <dd>
            {impact.nextMatchNumber ? (
              <a href={matchHref}>{impact.nextMatchNumber}</a>
            ) : (
              'No next match'
            )}
          </dd>
        </div>
        <div>
          <dt>Target Slot</dt>
          <dd>{impact.nextTargetSlot ? impact.nextTargetSlot.toUpperCase() : 'Not set'}</dd>
        </div>
        <div>
          <dt>Last Round</dt>
          <dd>{impact.isLastRound ? 'Yes' : 'No'}</dd>
        </div>
      </dl>
      <p className="empty-state">{impact.nextReason}</p>
      {impact.isLastRound && impact.champion ? (
        <div
          className={
            impact.champion.status === 'decided' ?
              'champion-banner champion-banner--decided'
            : 'champion-banner'
          }
        >
          <div>
            <p className="match-meta">Champion</p>
            <h3>
              {impact.champion.status === 'decided' ?
                impact.champion.label || 'Champion'
              : 'Not decided yet'}
            </h3>
          </div>
          <p>
            {impact.champion.reason}
            {championMatchHref ? (
              <>
                {' '}
                <a href={championMatchHref}>View deciding match</a>
              </>
            ) : null}
          </p>
        </div>
      ) : null}
    </article>
  )
}

export type DocumentationAssetSummary = {
  id: string | number
  asset_type: string
  caption?: string | null
  visibility: string
  url?: string | null
  filename?: string | null
  mimeType?: string | null
  uploaded_by?: RelationshipDoc | string | number | null
  createdAt?: string
}

export const DocumentationAssetList = ({
  assets,
  showVisibility = false,
}: {
  assets: DocumentationAssetSummary[]
  showVisibility?: boolean
}) => {
  if (assets.length === 0) {
    return <p className="empty-state">No documentation uploaded yet.</p>
  }

  return (
    <ul className="documentation-list">
      {assets.map((asset) => (
        <li key={asset.id} className="documentation-item">
          <div className="documentation-item__meta">
            <span className="documentation-item__type">{formatStatus(asset.asset_type)}</span>
            {showVisibility ? (
              <span
                className={`documentation-item__visibility documentation-item__visibility--${asset.visibility}`}
              >
                {asset.visibility}
              </span>
            ) : null}
          </div>
          {asset.url ? (
            <a
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              className="documentation-item__link"
            >
              {asset.filename || 'View file'}
            </a>
          ) : (
            <span>{asset.filename || 'File unavailable'}</span>
          )}
          {asset.caption ? <p className="documentation-item__caption">{asset.caption}</p> : null}
          <p className="documentation-item__footer">
            {getRelationshipLabel(asset.uploaded_by, 'Unknown uploader')}
            {asset.createdAt ? ` · ${formatDateTime(asset.createdAt)}` : ''}
          </p>
        </li>
      ))}
    </ul>
  )
}

export type AuditLogSummary = {
  id: string | number
  action: string
  entity_type: string
  entity_id: string
  actor_user_id?: RelationshipDoc | string | number | null
  before_snapshot?: unknown
  after_snapshot?: unknown
  createdAt?: string
}

export type CommentSummary = {
  id: string | number
  comment_type: string
  author_name: string
  author_user_id?: RelationshipDoc | string | number | null
  body: string
  status: string
  is_pinned?: boolean | null
  resolved_at?: string | null
  parent_comment_id?: RelationshipDoc | string | number | null
  createdAt?: string
}

export const CommentList = ({
  comments,
  showStatus = false,
}: {
  comments: CommentSummary[]
  showStatus?: boolean
}) => {
  if (comments.length === 0) {
    return <p className="empty-state">No comments yet.</p>
  }

  return (
    <ul className="comment-list">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className={comment.is_pinned ? 'comment-item comment-item--pinned' : 'comment-item'}
        >
          <div className="comment-item__meta">
            <span className="comment-item__type">{formatStatus(comment.comment_type)}</span>
            {comment.is_pinned ? <span className="comment-item__pin">Pinned</span> : null}
            {showStatus ? (
              <span className={`comment-item__status comment-item__status--${comment.status}`}>
                {formatStatus(comment.status)}
              </span>
            ) : null}
          </div>
          <p className="comment-item__body">{comment.body}</p>
          <p className="comment-item__footer">
            {comment.author_name || getRelationshipLabel(comment.author_user_id, 'System / Unknown')}
            {comment.createdAt ? <> &middot; {formatDateTime(comment.createdAt)}</> : null}
            {comment.resolved_at ? (
              <> &middot; Resolved {formatDateTime(comment.resolved_at)}</>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  )
}

export const AuditLogPanel = ({ entries }: { entries: AuditLogSummary[] }) => {
  if (entries.length === 0) {
    return <p className="empty-state">No audited changes yet.</p>
  }

  return (
    <ul className="audit-log-list">
      {entries.map((entry) => (
        <li key={entry.id} className="audit-log-item">
          <div className="audit-log-item__meta">
            <span className="audit-log-item__action">{formatAuditAction(entry.action)}</span>
            <span className="audit-log-item__time">{formatDateTime(entry.createdAt)}</span>
          </div>
          <p className="audit-log-item__actor">
            {getRelationshipLabel(entry.actor_user_id, 'System / Unknown')} &middot;{' '}
            {entry.entity_type} #{entry.entity_id}
          </p>
          <details>
            <summary>View before / after</summary>
            <pre>
              {JSON.stringify(
                { before: entry.before_snapshot, after: entry.after_snapshot },
                null,
                2,
              )}
            </pre>
          </details>
        </li>
      ))}
    </ul>
  )
}

export const WorkspaceNav = () => (
  <nav className="workspace-nav" aria-label="Operational workspaces">
    <a href="/workspaces/event-admin">Event Admin</a>
    <a href="/workspaces/scheduler">Scheduler</a>
    <a href="/workspaces/match-officer">Match Officer</a>
    <a href="/workspaces/standings">Standings</a>
    <a href="/workspaces/brackets">Brackets</a>
    <a href="/workspaces/content-admin">Content Admin</a>
    <a href="/admin">Backoffice</a>
  </nav>
)
