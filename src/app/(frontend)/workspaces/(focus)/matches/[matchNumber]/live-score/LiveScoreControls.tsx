'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { updateMatchSetScoreAction } from '../../../../matches/matchActions'

type ParticipantSide = 'a' | 'b'

type LiveScoreControlsProps = {
  matchNumber: string
  matchSetId: string | number
  setNumber: number
  participantAName: string
  participantBName: string
  participantAScore: number
  participantBScore: number
  winnerSide: '' | ParticipantSide
  returnTo: string
}

const participantButtonClass =
  'grid min-h-40 flex-1 content-between rounded-panel border p-5 text-left transition-all active:scale-[0.99]'

function ScoreForm({
  children,
  matchNumber,
  matchSetId,
  participantAScore,
  participantBScore,
  winnerSide,
  returnTo,
  notes,
}: {
  children: ReactNode
  matchNumber: string
  matchSetId: string | number
  participantAScore: number
  participantBScore: number
  winnerSide: '' | ParticipantSide
  returnTo: string
  notes: string
}) {
  return (
    <form action={updateMatchSetScoreAction} className="contents">
      <input type="hidden" name="matchNumber" value={matchNumber} />
      <input type="hidden" name="matchSetId" value={String(matchSetId)} />
      <input type="hidden" name="participantAScore" value={participantAScore} />
      <input type="hidden" name="participantBScore" value={participantBScore} />
      <input type="hidden" name="winnerSide" value={winnerSide} />
      <input type="hidden" name="notes" value={notes} />
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
  winnerSide,
  returnTo,
}: LiveScoreControlsProps) {
  const [selectedSide, setSelectedSide] = useState<ParticipantSide>('a')
  const selectedName = selectedSide === 'a' ? participantAName : participantBName
  const addScores = useMemo(
    () => ({
      a: participantAScore + (selectedSide === 'a' ? 1 : 0),
      b: participantBScore + (selectedSide === 'b' ? 1 : 0),
    }),
    [participantAScore, participantBScore, selectedSide],
  )
  const subtractScores = useMemo(
    () => ({
      a: selectedSide === 'a' ? Math.max(0, participantAScore - 1) : participantAScore,
      b: selectedSide === 'b' ? Math.max(0, participantBScore - 1) : participantBScore,
    }),
    [participantAScore, participantBScore, selectedSide],
  )
  const notes = `Live score set ${setNumber}: ${selectedName} adjusted from mobile scoring screen.`

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
        <ScoreForm
          matchNumber={matchNumber}
          matchSetId={matchSetId}
          participantAScore={subtractScores.a}
          participantBScore={subtractScores.b}
          winnerSide={winnerSide}
          returnTo={returnTo}
          notes={notes}
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
        </ScoreForm>

        <ScoreForm
          matchNumber={matchNumber}
          matchSetId={matchSetId}
          participantAScore={addScores.a}
          participantBScore={addScores.b}
          winnerSide={winnerSide}
          returnTo={returnTo}
          notes={notes}
        >
          <Button
            type="submit"
            className="min-h-24 w-full rounded-panel text-xl font-extrabold md:text-2xl"
          >
            <Plus className="h-7 w-7" aria-hidden="true" />
            Add point to {selectedName}
          </Button>
        </ScoreForm>
      </div>
    </section>
  )
}
