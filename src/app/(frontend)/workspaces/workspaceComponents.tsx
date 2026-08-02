import Link from 'next/link'
import type { ReactNode } from 'react'
import { Crown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge, getMatchStatusTone, type StatusTone } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
  score_summary?: string | null
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

export const PageHero = ({
  eyebrow,
  title,
  summary,
  actions,
}: {
  eyebrow: string
  title: ReactNode
  summary?: ReactNode
  actions?: ReactNode
}) => (
  <section className="mb-6">
    {/* AUDIT_UI_UX_CSS axe: text-green measured 4.24:1 here - PageHero sits directly on the
        workspace shell's bg-mist body (no paper wrapper of its own), and this is the header
        used across essentially every workspace page, so the shortfall was universal. ink-soft
        passes on both mist and paper and reads as a standard neutral "eyebrow" label. */}
    <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">{eyebrow}</p>
    <h1 className="mt-1 text-2xl font-extrabold text-ink md:text-3xl">{title}</h1>
    {summary ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{summary}</p> : null}
    {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
  </section>
)

// Shown instead of a page's normal content when no event exists yet to scope its data to -
// every master-data/transaction collection requires an event_id, so there is nothing to manage
// until at least one event has been created.
export const NoActiveEventNotice = () => (
  <EmptyState>
    No event exists yet.{' '}
    <Link href="/workspaces/event-admin/new-event" className="font-bold text-blue underline">
      Create your first event
    </Link>{' '}
    to start adding data here.
  </EmptyState>
)

export const StatGrid = ({ children }: { children: ReactNode }) => (
  <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</section>
)

const statTextTone: Record<'default' | 'good' | 'warn' | 'alert', string> = {
  default: 'text-ink',
  good: 'text-green',
  warn: 'text-gold',
  alert: 'text-danger',
}

export const StatBlock = ({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'good' | 'warn' | 'alert'
}) => (
  <Card className="flex flex-col gap-1">
    <span className="text-xs font-bold tracking-wide text-ink-soft uppercase">{label}</span>
    <strong className={cn('text-2xl font-extrabold tabular-nums', statTextTone[tone])}>{value}</strong>
  </Card>
)

export const MatchCard = ({
  match,
  compact = false,
  detailsHref,
}: {
  match: WorkspaceMatch
  compact?: boolean
  detailsHref?: string | null
}) => (
  <Card interactive={detailsHref !== null} className={cn('flex flex-col gap-3', compact && 'gap-2 p-3')}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-bold tracking-wide text-ink-soft uppercase">
        {getRelationshipLabel(match.sport_id)}
      </span>
      <StatusBadge tone={getMatchStatusTone(match.status)}>{formatStatus(match.status)}</StatusBadge>
    </div>

    <div>
      <p className="text-xs font-semibold text-ink-soft">{getRelationshipLabel(match.category_id)}</p>
      <h2 className="text-lg font-extrabold text-ink">{match.match_number}</h2>
      <p className="text-sm font-semibold text-ink-soft">{match.round_name || 'Match'}</p>
    </div>

    <div className="flex items-center justify-between gap-2 rounded-card bg-mist px-3 py-2 text-sm font-bold text-ink">
      <span className="min-w-0 truncate">{getRelationshipLabel(match.participant_a_entry_id)}</span>
      <span className="shrink-0 text-xs font-bold text-ink-soft">vs</span>
      <span className="min-w-0 truncate text-right">{getRelationshipLabel(match.participant_b_entry_id)}</span>
    </div>

    {compact ? null : (
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="font-bold tracking-wide text-ink-soft uppercase">Time</dt>
          <dd className="font-semibold text-ink">{formatDateTime(match.scheduled_start_at)}</dd>
        </div>
        <div>
          <dt className="font-bold tracking-wide text-ink-soft uppercase">Venue</dt>
          <dd className="font-semibold text-ink">{getRelationshipLabel(match.venue_id)}</dd>
        </div>
        <div>
          <dt className="font-bold tracking-wide text-ink-soft uppercase">Court</dt>
          <dd className="font-semibold text-ink">{getRelationshipLabel(match.court_id)}</dd>
        </div>
        <div>
          <dt className="font-bold tracking-wide text-ink-soft uppercase">Source</dt>
          <dd className="font-semibold text-ink">{formatStatus(match.generation_source || 'manual')}</dd>
        </div>
      </dl>
    )}

    {detailsHref !== null ? (
      <Link
        href={detailsHref || `/workspaces/matches/${match.match_number}`}
        className="text-sm font-bold text-blue no-underline hover:underline"
      >
        Match details →
      </Link>
    ) : null}
  </Card>
)

export const MatchSetsTable = ({ sets }: { sets: WorkspaceMatchSet[] }) => {
  if (sets.length === 0) {
    return <EmptyState>No match sets recorded yet.</EmptyState>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Set</TableHead>
          <TableHead>Participant A</TableHead>
          <TableHead>Participant B</TableHead>
          <TableHead>Winner</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sets.map((set) => (
          <TableRow key={set.id}>
            <TableCell className="font-extrabold">{set.set_number}</TableCell>
            <TableCell className="tabular-nums">{set.participant_a_score ?? '-'}</TableCell>
            <TableCell className="tabular-nums">{set.participant_b_score ?? '-'}</TableCell>
            <TableCell>{getRelationshipLabel(set.winner_entry_id, 'Not decided')}</TableCell>
            <TableCell className="text-ink-soft">{set.notes || '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
    <Card className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-extrabold text-ink">Standing Impact</p>
        <p className="text-xs font-semibold text-ink-soft">{impact.scopeLabel}</p>
      </div>
      {impact.rows.length === 0 ? (
        <EmptyState>
          {impact.reason || 'Standings are not calculated yet for this match scope.'}
        </EmptyState>
      ) : (
        <>
          {impact.participantRows.length === 0 ? (
            <EmptyState>This match's participants are not in the standing cache yet.</EmptyState>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2" aria-label="Match participant standing summary">
              {impact.participantRows.map((row) => (
                <div key={row.id} className="rounded-card border border-line bg-mist px-3 py-2">
                  <p className="truncate text-sm font-bold text-ink">{getRelationshipLabel(row.entry_id)}</p>
                  <p className="text-lg font-extrabold text-green">#{row.rank}</p>
                  <p className="text-xs font-semibold text-ink-soft">
                    {row.points} pts / {row.played} played / SD {row.score_difference}
                  </p>
                </div>
              ))}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>P</TableHead>
                <TableHead>Pts</TableHead>
                <TableHead>SD</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {impact.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-extrabold">{row.rank}</TableCell>
                  <TableCell>{getRelationshipLabel(row.entry_id)}</TableCell>
                  <TableCell className="tabular-nums">{row.played}</TableCell>
                  <TableCell className="tabular-nums">{row.points}</TableCell>
                  <TableCell className="tabular-nums">{row.score_difference}</TableCell>
                  <TableCell>{formatStatus(row.qualified_status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Card>
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
    <Card className="flex flex-col gap-3">
      <p className="text-sm font-extrabold text-ink">Bracket Impact</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="font-bold tracking-wide text-ink-soft uppercase">Round</dt>
          <dd className="font-semibold text-ink">{impact.roundName}</dd>
        </div>
        <div>
          <dt className="font-bold tracking-wide text-ink-soft uppercase">Next Match</dt>
          <dd className="font-semibold text-ink">
            {impact.nextMatchNumber ? (
              <Link href={matchHref} className="text-blue no-underline hover:underline">
                {impact.nextMatchNumber}
              </Link>
            ) : (
              'No next match'
            )}
          </dd>
        </div>
        <div>
          <dt className="font-bold tracking-wide text-ink-soft uppercase">Target Slot</dt>
          <dd className="font-semibold text-ink">
            {impact.nextTargetSlot ? impact.nextTargetSlot.toUpperCase() : 'Not set'}
          </dd>
        </div>
        <div>
          <dt className="font-bold tracking-wide text-ink-soft uppercase">Last Round</dt>
          <dd className="font-semibold text-ink">{impact.isLastRound ? 'Yes' : 'No'}</dd>
        </div>
      </dl>
      <p className="text-sm font-semibold text-ink-soft">{impact.nextReason}</p>
      {impact.isLastRound && impact.champion ? (
        <div
          className={cn(
            'flex items-center gap-3 rounded-card border p-3',
            impact.champion.status === 'decided' ?
              'border-gold bg-mist'
            : 'border-dashed border-line bg-paper',
          )}
        >
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              impact.champion.status === 'decided' ? 'bg-gold text-paper' : 'bg-mist text-ink-soft',
            )}
          >
            <Crown className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Champion</p>
            <p className="truncate text-sm font-extrabold text-ink">
              {impact.champion.status === 'decided' ?
                impact.champion.label || 'Champion'
              : 'Not decided yet'}
            </p>
            <p className="text-xs font-semibold text-ink-soft">
              {impact.champion.reason}
              {championMatchHref ? (
                <>
                  {' '}
                  <Link href={championMatchHref} className="text-blue no-underline hover:underline">
                    View deciding match
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}
    </Card>
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
    return <EmptyState>No documentation uploaded yet.</EmptyState>
  }

  return (
    <ul className="flex flex-col gap-2">
      {assets.map((asset) => (
        <li key={asset.id} className="rounded-card border border-line bg-paper p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wide text-ink-soft uppercase">
              {formatStatus(asset.asset_type)}
            </span>
            {showVisibility ? (
              <StatusBadge tone={asset.visibility === 'public' ? 'blue' : 'neutral'}>
                {asset.visibility}
              </StatusBadge>
            ) : null}
          </div>
          {asset.url ? (
            <a
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold text-blue no-underline hover:underline"
            >
              {asset.filename || 'View file'}
            </a>
          ) : (
            <span className="text-sm font-semibold text-ink-soft">{asset.filename || 'File unavailable'}</span>
          )}
          {asset.caption ? <p className="mt-1 text-sm text-ink-soft">{asset.caption}</p> : null}
          <p className="mt-1 text-xs font-semibold text-ink-soft">
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

const commentStatusTone: Record<string, StatusTone> = {
  visible: 'green',
  pending: 'gold',
  hidden: 'neutral',
  deleted: 'neutral',
}

export const CommentList = ({
  comments,
  showStatus = false,
}: {
  comments: CommentSummary[]
  showStatus?: boolean
}) => {
  if (comments.length === 0) {
    return <EmptyState>No comments yet.</EmptyState>
  }

  return (
    <ul className="flex flex-col gap-2">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className={cn(
            'rounded-card border p-3',
            comment.is_pinned ? 'border-gold bg-mist' : 'border-line bg-paper',
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold tracking-wide text-ink-soft uppercase">
              {formatStatus(comment.comment_type)}
            </span>
            {comment.is_pinned ? <StatusBadge tone="gold">Pinned</StatusBadge> : null}
            {showStatus ? (
              <StatusBadge tone={commentStatusTone[comment.status] || 'neutral'}>
                {formatStatus(comment.status)}
              </StatusBadge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink">{comment.body}</p>
          <p className="mt-1 text-xs font-semibold text-ink-soft">
            {comment.author_name || getRelationshipLabel(comment.author_user_id, 'System / Unknown')}
            {comment.createdAt ? <> &middot; {formatDateTime(comment.createdAt)}</> : null}
            {comment.resolved_at ? <> &middot; Resolved {formatDateTime(comment.resolved_at)}</> : null}
          </p>
        </li>
      ))}
    </ul>
  )
}

export const AuditLogPanel = ({ entries }: { entries: AuditLogSummary[] }) => {
  if (entries.length === 0) {
    return <EmptyState>No audited changes yet.</EmptyState>
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-card border border-line bg-paper p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-extrabold text-ink">{formatAuditAction(entry.action)}</span>
            <span className="text-xs font-semibold text-ink-soft">{formatDateTime(entry.createdAt)}</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-ink-soft">
            {getRelationshipLabel(entry.actor_user_id, 'System / Unknown')} &middot; {entry.entity_type} #
            {entry.entity_id}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-bold text-blue">View before / after</summary>
            <pre className="mt-2 max-w-full overflow-x-auto rounded-card bg-mist p-3 text-xs whitespace-pre-wrap text-ink-soft">
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
