import type { ReactNode } from 'react'
import Link from 'next/link'
import { Calendar, Clock, FileText, MapPin, Trophy, Video } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardTitle } from '@/components/ui/card'
import { StatusBadge, getMatchStatusTone } from '@/components/ui/status-badge'
import { formatContentDate, type PublicAnnouncement } from '../../contentData'
import type {
  BracketImpact,
  CommentDetail,
  DocumentationAssetDetail,
  MatchDetail,
  MatchSetDetail,
  StandingImpact,
} from '../../matchDetailData'
import {
  formatDateLabel,
  formatDateTime,
  formatStatus,
  formatTimeOnly,
  getRelationshipId,
  getRelationshipLabel,
} from '../../workspaces/workspaceComponents'

// Match statuses that mean "there is no result to show yet" - drives both the center "vs" (rather
// than a 0-0 score nobody has actually played toward yet) and the "scores will appear" caption
// under an empty set list.
const NOT_STARTED_STATUSES = new Set([
  'draft',
  'ready_for_scheduling',
  'scheduled',
  'check_in_open',
  'ready_to_start',
])
const LIVE_STATUSES = new Set(['ongoing', 'paused'])

// Public-only presentational pieces for the redesigned match detail page. Deliberately not shared
// with src/app/(frontend)/workspaces/workspaceComponents.tsx (used by the workspace match detail
// page) so restyling the public page in R2 cannot change workspace page rendering.

// First letters of up to two words, e.g. "Jakarta Garuda 3x3 Team" -> "JG" - a compact stand-in
// for a team crest so the scoreboard reads as a scoreboard rather than a wall of text.
const getInitials = (label: string) => {
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}

const TeamAvatar = ({ label, isWinner }: { label: string; isWinner: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-extrabold sm:h-12 sm:w-12 sm:text-base',
      isWinner ? 'border-gold/40 bg-paper text-ink' : 'border-line bg-mist text-ink-soft',
    )}
  >
    {getInitials(label)}
  </span>
)

const ParticipantBlock = ({
  label,
  clubLabel,
  isWinner,
  align,
}: {
  label: string
  clubLabel?: string
  isWinner: boolean
  align: 'left' | 'right'
}) => (
  <div
    className={cn(
      'flex min-w-0 flex-1 items-center gap-3',
      align === 'right' ? 'flex-row-reverse text-right' : 'text-left',
    )}
  >
    <TeamAvatar label={label} isWinner={isWinner} />
    <div className={cn('flex min-w-0 flex-col gap-0.5', align === 'right' ? 'items-end' : 'items-start')}>
      {isWinner ? (
        <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wide text-gold">
          <Trophy className="h-3 w-3 shrink-0" aria-hidden="true" />
          Winner
        </span>
      ) : null}
      <span
        className={cn(
          // w-full + min-w-0 are load-bearing, not decorative: as a flex-column child, this
          // span's default min-width:auto resolves from its min-content size - and `truncate`'s
          // white-space:nowrap makes that min-content equal the FULL untruncated text width, so
          // without an explicit min-w-0 the span refuses to shrink below that and overflows this
          // column (and the sibling score/team block next to it) instead of ellipsizing.
          'w-full min-w-0 truncate text-base leading-tight font-extrabold sm:text-xl',
          isWinner ? 'text-ink' : 'text-ink-soft',
        )}
        title={label}
      >
        {label}
      </span>
      {/* The team/player's parent club (via team_id.club_id / player_id.club_id) - a club-mode
          entry has no separate parent, so this is only ever shown for team/pair/individual
          entries that actually belong to one. */}
      {clubLabel ? (
        <span className="w-full min-w-0 truncate text-xs font-semibold text-ink-soft" title={clubLabel}>
          {clubLabel}
        </span>
      ) : null}
    </div>
  </div>
)

// AUDIT_UI_UX_CSS/prd redesign: the previous score display was a stacked list with each
// participant's set count on its own row - readable, but not the "Team A [score] Team B" shape
// every sports score page uses, which is the shape a spectator scans fastest. Center column shows
// the actual set score once sets exist, or a plain "vs" pill beforehand rather than a misleading
// "0 - 0" (nobody has scored 0 sets "to nothing" before the match starts).
const ScoreCenter = ({ hasSets, aSetsWon, bSetsWon }: { hasSets: boolean; aSetsWon: number; bSetsWon: number }) => (
  <div className="flex shrink-0 flex-col items-center justify-center px-2">
    {hasSets ? (
      <span className="text-3xl font-extrabold tabular-nums text-ink sm:text-4xl">
        {aSetsWon}
        <span className="mx-1.5 text-ink-soft">–</span>
        {bSetsWon}
      </span>
    ) : (
      <span className="rounded-full border border-line bg-mist px-3 py-1 text-xs font-bold tracking-wide text-ink-soft uppercase">
        vs
      </span>
    )}
  </div>
)

export const ScoreCard = ({
  match,
  matchSets,
  participantAClub,
  participantBClub,
  liveIndicator,
}: {
  match: MatchDetail
  matchSets: MatchSetDetail[]
  participantAClub?: string
  participantBClub?: string
  liveIndicator?: ReactNode
}) => {
  const winnerId = getRelationshipId(match.winner_entry_id)
  const aId = getRelationshipId(match.participant_a_entry_id)
  const bId = getRelationshipId(match.participant_b_entry_id)
  const aIsWinner = winnerId !== undefined && String(winnerId) === String(aId)
  const bIsWinner = winnerId !== undefined && String(winnerId) === String(bId)
  const aSetsWon = matchSets.filter(
    (set) => (set.participant_a_score ?? 0) > (set.participant_b_score ?? 0),
  ).length
  const bSetsWon = matchSets.filter(
    (set) => (set.participant_b_score ?? 0) > (set.participant_a_score ?? 0),
  ).length
  const isLive = LIVE_STATUSES.has(match.status)
  const notStartedYet = NOT_STARTED_STATUSES.has(match.status) && matchSets.length === 0

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-mist/60 px-5 py-2.5">
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
            </span>
          ) : null}
          <StatusBadge tone={getMatchStatusTone(match.status)}>{formatStatus(match.status)}</StatusBadge>
        </div>
        {/* Live-poll indicator is supplementary chrome, not match info - kept small and muted so
            it never competes with the status/score for a spectator's attention. */}
        {liveIndicator}
      </div>
      <div className="flex flex-col gap-4 px-5 pt-6 pb-2 sm:flex-row sm:items-center sm:gap-6 sm:pt-8">
        <ParticipantBlock
          label={getRelationshipLabel(match.participant_a_entry_id)}
          clubLabel={participantAClub}
          isWinner={aIsWinner}
          align="left"
        />
        <ScoreCenter hasSets={matchSets.length > 0} aSetsWon={aSetsWon} bSetsWon={bSetsWon} />
        <ParticipantBlock
          label={getRelationshipLabel(match.participant_b_entry_id)}
          clubLabel={participantBClub}
          isWinner={bIsWinner}
          align="right"
        />
      </div>
      {match.score_summary ? (
        <p className="px-5 pb-6 text-center text-xs font-semibold tabular-nums text-ink-soft sm:pb-8">
          {match.score_summary}
        </p>
      ) : (
        <div className="pb-6 sm:pb-8" />
      )}
      {/* Set-by-set breakdown only earns its place when there's more than one set - with exactly
          one set, `score_summary` above already says the same thing, and repeating it here just
          duplicates the same two numbers a second time (the bug the redesign was meant to fix). */}
      {matchSets.length > 1 ? (
        <div className="border-t border-line bg-mist/40 px-5 py-3">
          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-soft/70">
            Sets
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {matchSets.map((set) => (
              <p key={set.id} className="text-xs text-ink-soft">
                <span className="font-semibold text-ink-soft/80">Set {set.set_number}</span>{' '}
                <span className="font-bold tabular-nums text-ink">
                  {set.participant_a_score ?? '-'}–{set.participant_b_score ?? '-'}
                </span>
              </p>
            ))}
          </div>
        </div>
      ) : notStartedYet ? (
        <p className="border-t border-line px-5 py-3 text-center text-xs text-ink-soft">
          Scores will appear here once the match begins.
        </p>
      ) : null}
    </Card>
  )
}

// Replaces the old separate Schedule/Venue cards - the two were always read together ("when and
// where do I need to be"), so splitting them into two same-weight cards made a spectator do the
// work of mentally merging them back. "Not scheduled" repeated across four dt/dd pairs is also a
// worse "not scheduled" state than one plain sentence saying so.
export const MatchInfoStrip = ({
  match,
  eventPath,
  timezone,
}: {
  match: MatchDetail
  eventPath: string
  timezone: string
}) => {
  const isScheduled = Boolean(match.scheduled_start_at)

  return (
    <Card>
      <CardTitle>Schedule &amp; Venue</CardTitle>
      <div className="mt-3 grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="flex items-start gap-3 py-3 first:pt-0 sm:py-0 sm:pr-4 sm:first:pl-0">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Date</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink">
              {isScheduled ? formatDateLabel(match.scheduled_start_at, timezone) : 'Not scheduled yet'}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 py-3 sm:px-4">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Time</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink">
              {isScheduled
                ? `${formatTimeOnly(match.scheduled_start_at, timezone)} – ${formatTimeOnly(match.scheduled_end_at, timezone)}`
                : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 py-3 last:pb-0 sm:py-0 sm:pl-4 sm:last:pr-0">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Venue</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink">
              {getRelationshipLabel(match.venue_id)} / {getRelationshipLabel(match.court_id)}
            </p>
          </div>
        </div>
      </div>
      {isScheduled ? (
        <a
          href={`${eventPath}/matches/${match.match_number}/calendar.ics`}
          className="mt-4 inline-block text-sm font-bold text-brand-secondary underline underline-offset-2"
        >
          Add to calendar (.ics)
        </a>
      ) : (
        <p className="mt-4 text-xs text-ink-soft">
          This match hasn&apos;t been scheduled yet - check back for updates.
        </p>
      )}
    </Card>
  )
}

// The shared AnnouncementFeed/AnnouncementCard (contentComponents.tsx) is built for a page where
// announcements ARE the content (event home, category page) - full body text, a CTA, an icon
// badge per item. On a match detail page they're a minor supporting fact ("kickoff moved 30
// minutes"), not the reason someone's here, so this renders each one as a single scannable row
// instead: a status dot, the title, the date. No body text, no per-item card border - the whole
// list stays inside one small Card rather than stacking a full card per announcement.
export const MatchUpdatesPanel = ({
  announcements,
  basePath,
  timezone,
}: {
  announcements: PublicAnnouncement[]
  basePath: string
  timezone?: string
}) => {
  if (announcements.length === 0) {
    return null
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>Match Updates</CardTitle>
        <Link href={basePath} className="shrink-0 text-xs font-semibold text-brand-secondary hover:underline">
          View all
        </Link>
      </div>
      <ul className="mt-1 flex flex-col divide-y divide-line">
        {announcements.map((announcement) => (
          <li key={announcement.id} className="flex items-center gap-2.5 py-2 first:pt-2 last:pb-0">
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                announcement.urgency === 'urgent' ? 'bg-gold'
                : announcement.urgency === 'result' ? 'bg-green'
                : 'bg-ink-soft/40',
              )}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {announcement.title}
            </span>
            <span className="shrink-0 text-xs text-ink-soft">
              {formatContentDate(announcement.published_at, timezone)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export const DocumentationGallery = ({ assets }: { assets: DocumentationAssetDetail[] }) => {
  if (assets.length === 0) {
    return <Card className="text-sm text-ink-soft">No documentation uploaded yet.</Card>
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {assets.map((asset) => {
        const isImage = asset.mimeType?.startsWith('image/')

        return (
          <a
            key={asset.id}
            href={asset.url || undefined}
            target="_blank"
            rel="noreferrer"
            className="group block overflow-hidden rounded-card border border-line bg-paper transition-colors hover:border-green"
          >
            <div className="flex aspect-square items-center justify-center overflow-hidden bg-mist">
              {isImage && asset.url ?
                // eslint-disable-next-line @next/next/no-img-element -- user-uploaded asset of unknown dimensions
                <img
                  src={asset.url}
                  alt={asset.caption || asset.filename || 'Match documentation'}
                  className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                />
              : asset.asset_type === 'video' ?
                <Video className="h-8 w-8 text-ink-soft" aria-hidden="true" />
              : <FileText className="h-8 w-8 text-ink-soft" aria-hidden="true" />}
            </div>
            {asset.caption ? (
              <p className="truncate px-2 py-2 text-xs text-ink-soft">{asset.caption}</p>
            ) : null}
          </a>
        )
      })}
    </div>
  )
}

export const PublicCommentList = ({ comments, timezone }: { comments: CommentDetail[]; timezone: string }) => {
  if (comments.length === 0) {
    return <Card className="text-sm text-ink-soft">No comments yet.</Card>
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.map((comment) => (
        <Card key={comment.id} className={cn(comment.is_pinned && 'border-green bg-mist')}>
          <p className="text-sm text-ink">{comment.body}</p>
          <p className="mt-2 text-xs text-ink-soft">
            {comment.author_name || 'Committee'}
            {comment.createdAt ? ` · ${formatDateTime(comment.createdAt, timezone)}` : ''}
          </p>
        </Card>
      ))}
    </div>
  )
}

export const PublicStandingImpactPanel = ({
  impact,
}: {
  impact: StandingImpact | null | undefined
}) => {
  if (!impact) {
    return null
  }

  return (
    <Card>
      <CardTitle>Standing Impact</CardTitle>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
        {impact.scopeLabel}
      </p>
      {impact.rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          {impact.reason || 'Standings are not calculated yet for this match scope.'}
        </p>
      ) : impact.participantRows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          This match's participants are not in the standing cache yet.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {impact.participantRows.map((row) => (
            <div key={row.id} className="rounded-card border border-line px-3 py-2">
              <p className="truncate text-sm font-semibold text-ink">
                {getRelationshipLabel(row.entry_id)}
              </p>
              {row.clubLabel ? (
                <p className="truncate text-xs text-ink-soft">{row.clubLabel}</p>
              ) : null}
              <p className="text-xs text-ink-soft">
                Rank #{row.rank} · {row.points} pts · {row.played} played
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export const PublicBracketImpactPanel = ({
  impact,
}: {
  impact: BracketImpact | null | undefined
}) => {
  if (!impact) {
    return null
  }

  return (
    <Card>
      <CardTitle>Bracket Impact</CardTitle>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Round</dt>
          <dd className="mt-0.5 font-semibold text-ink">{impact.roundName}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Next Match</dt>
          <dd className="mt-0.5 font-semibold text-ink">
            {impact.nextMatchNumber && impact.nextMatchHref ?
              <Link href={impact.nextMatchHref} className="text-blue hover:underline">
                {impact.nextMatchNumber}
              </Link>
            : 'None yet'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Target Slot</dt>
          <dd className="mt-0.5 font-semibold text-ink">
            {impact.nextTargetSlot ? impact.nextTargetSlot.toUpperCase() : 'Not set'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Last Round</dt>
          <dd className="mt-0.5 font-semibold text-ink">{impact.isLastRound ? 'Yes' : 'No'}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-ink-soft">{impact.nextReason}</p>
      {impact.isLastRound && impact.champion ? (
        <div
          className={cn(
            'mt-3 rounded-card border p-3',
            impact.champion.status === 'decided' ? 'border-gold' : 'border-dashed border-line',
          )}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Champion</p>
          <p className="font-extrabold text-ink">
            {impact.champion.status === 'decided' ? impact.champion.label : 'Not decided yet'}
          </p>
          <p className="mt-1 text-sm text-ink-soft">{impact.champion.reason}</p>
        </div>
      ) : null}
    </Card>
  )
}
