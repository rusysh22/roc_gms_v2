import Link from 'next/link'
import { FileText, Video } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardTitle } from '@/components/ui/card'
import { StatusBadge, getMatchStatusTone } from '@/components/ui/status-badge'
import type {
  BracketImpact,
  CommentDetail,
  DocumentationAssetDetail,
  MatchDetail,
  MatchSetDetail,
  StandingImpact,
} from '../../matchDetailData'
import { formatDateTime, formatStatus, getRelationshipId, getRelationshipLabel } from '../../workspaces/workspaceComponents'

// Public-only presentational pieces for the redesigned match detail page. Deliberately not shared
// with src/app/(frontend)/workspaces/workspaceComponents.tsx (used by the workspace match detail
// page) so restyling the public page in R2 cannot change workspace page rendering.

const ParticipantScoreRow = ({
  label,
  isWinner,
  setsWon,
  hasSets,
}: {
  label: string
  isWinner: boolean
  setsWon: number
  hasSets: boolean
}) => (
  <div className={cn('flex items-center justify-between gap-3 px-5 py-4', isWinner && 'bg-mist')}>
    <span
      className={cn('text-lg', isWinner ? 'font-extrabold text-ink' : 'font-semibold text-ink-soft')}
    >
      {label}
    </span>
    {hasSets ? (
      <span
        className={cn(
          'text-3xl tabular-nums',
          isWinner ? 'font-extrabold text-green' : 'font-bold text-ink-soft',
        )}
      >
        {setsWon}
      </span>
    ) : null}
  </div>
)

export const ScoreCard = ({
  match,
  matchSets,
}: {
  match: MatchDetail
  matchSets: MatchSetDetail[]
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

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
        <StatusBadge tone={getMatchStatusTone(match.status)}>{formatStatus(match.status)}</StatusBadge>
        {match.score_summary ? (
          <p className="text-sm font-semibold text-ink-soft">{match.score_summary}</p>
        ) : null}
      </div>
      <div className="flex flex-col divide-y divide-line">
        <ParticipantScoreRow
          label={getRelationshipLabel(match.participant_a_entry_id)}
          isWinner={aIsWinner}
          setsWon={aSetsWon}
          hasSets={matchSets.length > 0}
        />
        <ParticipantScoreRow
          label={getRelationshipLabel(match.participant_b_entry_id)}
          isWinner={bIsWinner}
          setsWon={bSetsWon}
          hasSets={matchSets.length > 0}
        />
      </div>
      {matchSets.length > 0 ? (
        <div className="border-t border-line px-5 py-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Set by set</p>
          <div className="flex flex-wrap gap-2">
            {matchSets.map((set) => (
              <div
                key={set.id}
                className="rounded-card border border-line px-3 py-2 text-center text-sm"
              >
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-soft">
                  Set {set.set_number}
                </p>
                <p className="font-bold tabular-nums text-ink">
                  {set.participant_a_score ?? '-'} - {set.participant_b_score ?? '-'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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

export const PublicCommentList = ({ comments }: { comments: CommentDetail[] }) => {
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
            {comment.createdAt ? ` · ${formatDateTime(comment.createdAt)}` : ''}
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
