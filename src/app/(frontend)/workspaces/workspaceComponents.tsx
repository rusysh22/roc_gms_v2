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
  </article>
)

export const WorkspaceNav = () => (
  <nav className="workspace-nav" aria-label="Operational workspaces">
    <a href="/workspaces/event-admin">Event Admin</a>
    <a href="/workspaces/scheduler">Scheduler</a>
    <a href="/workspaces/match-officer">Match Officer</a>
    <a href="/workspaces/content-admin">Content Admin</a>
    <a href="/admin">Backoffice</a>
  </nav>
)
