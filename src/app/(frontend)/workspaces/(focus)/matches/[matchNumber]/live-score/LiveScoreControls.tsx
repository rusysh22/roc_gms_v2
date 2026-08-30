'use client'

import { useState } from 'react'
import { CloudOff, Loader2, Minus, Plus, RotateCcw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useOfflineScoreSync } from './useOfflineScoreSync'

type ParticipantSide = 'a' | 'b'

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
}

const participantButtonClass =
  'grid min-h-40 flex-1 content-between rounded-panel border p-5 text-left transition-all active:scale-[0.99]'

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md 15.2 "autosave dan offline/retry state": every tap is applied
// to local state immediately (optimistic) and queued in IndexedDB before the network request even
// starts, so scoring never blocks on connectivity. AUDIT_E2E MAT-03's delta-based server update
// (this form used to submit +1/-1, never an absolute score) is what makes that safe to replay
// later - see useOfflineScoreSync.ts. The server's max_score cap isn't mirrored here, so the
// optimistic count can briefly overshoot the cap if someone taps past it while offline; it
// corrects to the server's clamped value as soon as that tap syncs.
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
}: LiveScoreControlsProps) {
  const [selectedSide, setSelectedSide] = useState<ParticipantSide>('a')
  const selectedName = selectedSide === 'a' ? participantAName : participantBName
  const setIdKey = String(matchSetId)

  const { isOnline, syncing, pendingCount, failedCount, addPoint, pendingDeltaForSet, dismissFailed } =
    useOfflineScoreSync(matchNumber)

  const displayScoreA = participantAScore + pendingDeltaForSet(setIdKey, 'a')
  const displayScoreB = participantBScore + pendingDeltaForSet(setIdKey, 'b')

  const tapPoint = (delta: 1 | -1) => {
    if (!scoreable) return
    void addPoint(setIdKey, selectedSide, delta)
  }

  return (
    <section
      className={cn(
        'grid flex-1 gap-4',
        scoreable ? 'grid-rows-[auto_auto_1fr_auto]' : 'grid-rows-[auto_auto_auto_1fr_auto]',
      )}
      aria-label="Live score controls"
    >
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

      <div className="grid min-h-0 grid-cols-1 gap-4 md:grid-cols-2">
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
          <span className="text-7xl font-extrabold tabular-nums md:text-8xl">
            {displayScoreA}
          </span>
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
          <span className="text-7xl font-extrabold tabular-nums md:text-8xl">
            {displayScoreB}
          </span>
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
