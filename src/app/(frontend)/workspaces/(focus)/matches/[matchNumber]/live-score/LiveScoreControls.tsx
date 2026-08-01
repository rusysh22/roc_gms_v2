'use client'

import { useState, type ReactNode } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { addLiveScorePointAction } from '../../../../matches/matchActions'

type ParticipantSide = 'a' | 'b'

type LiveScoreControlsProps = {
  matchNumber: string
  matchSetId: string | number
  setNumber: number
  participantAName: string
  participantBName: string
  participantAScore: number
  participantBScore: number
  returnTo: string
}

const participantButtonClass =
  'grid min-h-40 flex-1 content-between rounded-panel border p-5 text-left transition-all active:scale-[0.99]'

// AUDIT_E2E MAT-03: this form no longer computes or submits an absolute score - it only tells the
// server *which set*, *which side*, and *which direction* (+1/-1). The server re-reads the current
// score and applies the delta as a single atomic SQL UPDATE (see addLiveScorePointAction), so two
// rapid taps or two devices can never silently overwrite each other's point.
function PointForm({
  children,
  matchNumber,
  matchSetId,
  side,
  delta,
  returnTo,
}: {
  children: ReactNode
  matchNumber: string
  matchSetId: string | number
  side: ParticipantSide
  delta: 1 | -1
  returnTo: string
}) {
  return (
    <form action={addLiveScorePointAction} className="contents">
      <input type="hidden" name="matchNumber" value={matchNumber} />
      <input type="hidden" name="matchSetId" value={String(matchSetId)} />
      <input type="hidden" name="side" value={side} />
      <input type="hidden" name="delta" value={delta} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {children}
    </form>
  )
}

export function LiveScoreControls({
  matchNumber,
  matchSetId,
  setNumber,
  participantAName,
  participantBName,
  participantAScore,
  participantBScore,
  returnTo,
}: LiveScoreControlsProps) {
  const [selectedSide, setSelectedSide] = useState<ParticipantSide>('a')
  const selectedName = selectedSide === 'a' ? participantAName : participantBName

  return (
    <section className="grid flex-1 grid-rows-[auto_1fr_auto] gap-4" aria-label="Live score controls">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Current set</p>
          <h2 className="text-2xl font-extrabold text-ink">Set {setNumber}</h2>
        </div>
        <p className="rounded-full border border-line bg-paper px-3 py-1 text-sm font-bold text-ink">
          Selected: {selectedName}
        </p>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setSelectedSide('a')}
          aria-pressed={selectedSide === 'a'}
          className={cn(
            participantButtonClass,
            selectedSide === 'a'
              ? 'border-green bg-mist text-green shadow-md'
              : 'border-line bg-paper text-ink',
          )}
        >
          <span className="text-sm font-bold uppercase tracking-wide">Participant A</span>
          <span className="break-words text-2xl font-extrabold leading-tight">{participantAName}</span>
          <span className="text-7xl font-extrabold tabular-nums md:text-8xl">
            {participantAScore}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedSide('b')}
          aria-pressed={selectedSide === 'b'}
          className={cn(
            participantButtonClass,
            selectedSide === 'b'
              ? 'border-green bg-mist text-green shadow-md'
              : 'border-line bg-paper text-ink',
          )}
        >
          <span className="text-sm font-bold uppercase tracking-wide">Participant B</span>
          <span className="break-words text-2xl font-extrabold leading-tight">{participantBName}</span>
          <span className="text-7xl font-extrabold tabular-nums md:text-8xl">
            {participantBScore}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 md:grid-cols-[112px_minmax(0,1fr)]">
        <PointForm
          matchNumber={matchNumber}
          matchSetId={matchSetId}
          side={selectedSide}
          delta={-1}
          returnTo={returnTo}
        >
          <button
            type="submit"
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-panel border border-line bg-paper text-sm font-extrabold text-ink transition active:scale-95"
          >
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
            Undo
            <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
              <Minus className="h-3 w-3" aria-hidden="true" /> 1
            </span>
          </button>
        </PointForm>

        <PointForm
          matchNumber={matchNumber}
          matchSetId={matchSetId}
          side={selectedSide}
          delta={1}
          returnTo={returnTo}
        >
          <Button
            type="submit"
            className="min-h-24 w-full rounded-panel text-xl font-extrabold md:text-2xl"
          >
            <Plus className="h-7 w-7" aria-hidden="true" />
            Add point to {selectedName}
          </Button>
        </PointForm>
      </div>
    </section>
  )
}
