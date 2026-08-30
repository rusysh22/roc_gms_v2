'use client'

import { useState } from 'react'
import { CheckCircle2, CloudOff, Loader2, Minus, Plus, RotateCcw, Trophy, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConfirmSubmitButton } from '../../../../matches/ConfirmSubmitButton'
import { finishAndPublishMatchAction } from '../../../../matches/matchActions'
import { useOfflineScoreSync } from './useOfflineScoreSync'

type ParticipantSide = 'a' | 'b'

export type LiveMatchOutcome = {
  decided: boolean
  winnerSide: ParticipantSide | null
  setsWonA: number
  setsWonB: number
}

type LiveScoreControlsProps = {
  matchNumber: string
  matchSetId: string | number
  setNumber: number
  participantAName: string
  participantBName: string
  participantAScore: number
  participantBScore: number
  // Point entry is only accepted while the match is ongoing/paused/under review. When it isn't,
  // disable the controls here instead of letting every tap round-trip and fail server-side with
  // "match/set state changed".
  scoreable: boolean
  matchStatusLabel: string
  // Ruleset-derived match state, computed server-side on load; the sync hook refreshes it live as
  // points come in so the "match complete" prompt appears without waiting for a page refresh.
  matchOutcome: LiveMatchOutcome
  // Only event_admin/super_admin can publish a result; a match officer's tap finishes the match
  // with the winner recorded and leaves publishing to an admin.
  canPublish: boolean
  returnTo: string
}

const participantButtonClass =
  'grid min-h-40 flex-1 content-between rounded-panel border p-5 text-left transition-all active:scale-[0.99]'

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md 15.2 "autosave dan offline/retry state": every tap is applied to
// local state immediately (optimistic) and queued in IndexedDB before the network request even
// starts, so scoring never blocks on connectivity. The server returns the authoritative score with
// every OK response - `confirmedScoreForSet` holds the latest so the big number stays correct after
// a tap syncs (it used to snap back to the stale server prop until a manual refresh).
export function LiveScoreControls({
  matchNumber,
  matchSetId,
  setNumber,
  participantAName,
  participantBName,
  participantAScore,
  participantBScore,
  scoreable,
  matchStatusLabel,
  matchOutcome,
  canPublish,
  returnTo,
}: LiveScoreControlsProps) {
  const [selectedSide, setSelectedSide] = useState<ParticipantSide>('a')
  const selectedName = selectedSide === 'a' ? participantAName : participantBName
  const setIdKey = String(matchSetId)

  const {
    isOnline,
    syncing,
    pendingCount,
    failedCount,
    addPoint,
    pendingDeltaForSet,
    confirmedScoreForSet,
    lastSyncOutcome,
    dismissFailed,
  } = useOfflineScoreSync(matchNumber)

  const baseA = confirmedScoreForSet(setIdKey, 'a') ?? participantAScore
  const baseB = confirmedScoreForSet(setIdKey, 'b') ?? participantBScore
  const displayScoreA = baseA + pendingDeltaForSet(setIdKey, 'a')
  const displayScoreB = baseB + pendingDeltaForSet(setIdKey, 'b')

  const outcome: LiveMatchOutcome = lastSyncOutcome
    ? {
        decided: lastSyncOutcome.decided,
        winnerSide: lastSyncOutcome.winner_side,
        setsWonA: lastSyncOutcome.sets_won_a,
        setsWonB: lastSyncOutcome.sets_won_b,
      }
    : matchOutcome

  const tapPoint = (delta: 1 | -1) => {
    if (!scoreable) return
    void addPoint(setIdKey, selectedSide, delta)
  }

  const matchCompleteBanner =
    outcome.decided && outcome.winnerSide ? (
      <form
        id="finish-and-publish-form"
        action={finishAndPublishMatchAction}
        className="flex flex-col gap-2 rounded-card border border-green/40 bg-paper px-4 py-3"
      >
        <input type="hidden" name="matchNumber" value={matchNumber} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <p className="flex items-center gap-2 text-sm font-extrabold text-green">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Match complete &mdash;{' '}
          {outcome.winnerSide === 'a' ? participantAName : participantBName} wins {Math.max(
            outcome.setsWonA,
            outcome.setsWonB,
          )}
          &ndash;{Math.min(outcome.setsWonA, outcome.setsWonB)}
        </p>
        <p className="text-xs text-ink-soft">
          {canPublish
            ? 'The winner is taken from the score and the ruleset — no need to pick it.'
            : 'This records the winner and finishes the match. An event admin publishes the final result.'}
        </p>
        <ConfirmSubmitButton
          formId="finish-and-publish-form"
          tone="default"
          className="mt-1 w-full justify-center"
          confirmMessage={
            canPublish
              ? 'Publish this result? It becomes the final public result and advances the bracket.'
              : 'Finish this match and record the winner? An event admin will publish it.'
          }
        >
          <Trophy className="h-4 w-4" aria-hidden="true" />
          {canPublish ? 'Finish & publish result' : 'Finish match'}
        </ConfirmSubmitButton>
      </form>
    ) : null

  return (
    <section className="flex flex-1 flex-col gap-4" aria-label="Live score controls">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Current set</p>
          <h2 className="text-2xl font-extrabold text-ink">Set {setNumber}</h2>
        </div>
        <p className="rounded-full border border-line bg-paper px-3 py-1 text-sm font-bold text-ink">
          Selected: {selectedName}
        </p>
      </div>

      <div
        role="status"
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-card border px-3 py-2 text-xs font-bold',
          !isOnline
            ? 'border-gold/40 bg-paper text-gold'
            : pendingCount > 0
              ? 'border-line bg-mist text-ink-soft'
              : 'border-green/30 bg-paper text-green',
        )}
      >
        {!isOnline ? (
          <>
            <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
            Offline - {pendingCount} point{pendingCount === 1 ? '' : 's'} queued, will sync automatically.
          </>
        ) : pendingCount > 0 ? (
          <>
            <Loader2 className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} aria-hidden="true" />
            Syncing {pendingCount} point{pendingCount === 1 ? '' : 's'}...
          </>
        ) : (
          'Online - all points synced.'
        )}
        {failedCount > 0 ? (
          <span className="ml-auto inline-flex items-center gap-2 text-danger">
            {failedCount} point{failedCount === 1 ? '' : 's'} could not be applied (match/set state changed)
            <Button variant="ghost" size="sm" onClick={dismissFailed} className="h-auto px-2 py-0.5 text-danger">
              <X className="h-3 w-3" aria-hidden="true" />
              Dismiss
            </Button>
          </span>
        ) : null}
      </div>

      {!scoreable ? (
        <div
          role="status"
          className="rounded-card border border-gold/40 bg-mist px-3 py-2 text-xs font-bold text-ink-soft"
        >
          This match is {matchStatusLabel}. Tap <strong className="text-ink">Start Match</strong> in
          Match flow before entering points &mdash; scoring is disabled until then.
        </div>
      ) : null}

      {scoreable ? matchCompleteBanner : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setSelectedSide('a')}
          aria-pressed={selectedSide === 'a'}
          className={cn(
            participantButtonClass,
            selectedSide === 'a'
              ? 'border-green bg-paper text-green shadow-md'
              : 'border-line bg-paper text-ink',
          )}
        >
          <span className="text-sm font-bold uppercase tracking-wide">Participant A</span>
          <span className="break-words text-2xl font-extrabold leading-tight">{participantAName}</span>
          <span className="text-7xl font-extrabold tabular-nums md:text-8xl">{displayScoreA}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedSide('b')}
          aria-pressed={selectedSide === 'b'}
          className={cn(
            participantButtonClass,
            selectedSide === 'b'
              ? 'border-green bg-paper text-green shadow-md'
              : 'border-line bg-paper text-ink',
          )}
        >
          <span className="text-sm font-bold uppercase tracking-wide">Participant B</span>
          <span className="break-words text-2xl font-extrabold leading-tight">{participantBName}</span>
          <span className="text-7xl font-extrabold tabular-nums md:text-8xl">{displayScoreB}</span>
        </button>
      </div>

      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 md:grid-cols-[112px_minmax(0,1fr)]">
        <Button
          variant="secondary"
          onClick={() => tapPoint(-1)}
          disabled={!scoreable}
          className="flex h-auto min-h-24 flex-col items-center justify-center gap-2 rounded-panel text-sm"
        >
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
          Undo
          <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
            <Minus className="h-3 w-3" aria-hidden="true" /> 1
          </span>
        </Button>

        <Button
          onClick={() => tapPoint(1)}
          disabled={!scoreable}
          className="h-auto min-h-24 w-full rounded-panel text-xl md:text-2xl"
        >
          <Plus className="h-7 w-7" aria-hidden="true" />
          Add point to {selectedName}
        </Button>
      </div>
    </section>
  )
}
