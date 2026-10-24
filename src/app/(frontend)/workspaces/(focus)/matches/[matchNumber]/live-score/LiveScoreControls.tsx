'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CloudOff, Loader2, Minus, Plus, RotateCcw, Trophy, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { deriveMatchOutcome, deriveSetWinnerSide, type MatchRuleset, type Side } from '@/lib/matchResult'
import { ConfirmSubmitButton } from '../../../../matches/ConfirmSubmitButton'
import { addMatchSetAction, finishAndPublishMatchAction } from '../../../../matches/matchActions'
import { useOfflineScoreSync } from './useOfflineScoreSync'

export type PriorSet = {
  setNumber: number
  a: number
  b: number
  // Stored winner (score-derived, manual override or walkover) - takes precedence over the score.
  winnerSide: Side | null
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
  // Rendered inside the "not scoreable" notice (e.g. the Start Match form) so the officer doesn't
  // have to scroll to the Match flow panel - on a phone that panel sits below the scoreboard.
  notScoreableAction?: ReactNode
  // Ruleset + earlier sets let the scoreboard derive set point / set won / match complete from the
  // optimistic score instantly, with the exact same rules the server applies on every tap.
  ruleset: MatchRuleset | null
  priorSets: PriorSet[]
  // Only event_admin/super_admin can publish a result; a match officer's tap finishes the match
  // with the winner recorded and leaves publishing to an admin.
  canPublish: boolean
  returnTo: string
}

// Dark scoreboard tiles: high contrast for a tablet courtside in daylight, and the side colour
// (green = A, blue = B) carried by the top bar, glow and pips rather than by low-contrast text.
const SIDE_STYLES: Record<Side, { panel: string; accent: string; glow: string; pip: string; text: string }> = {
  a: {
    panel: 'bg-ink hover:bg-[#123029] active:bg-[#163a32] focus-visible:ring-green',
    accent: 'bg-green',
    glow: 'from-green/25',
    pip: 'border-green bg-green',
    text: 'text-green',
  },
  b: {
    panel: 'bg-ink hover:bg-[#122a33] active:bg-[#16323d] focus-visible:ring-blue',
    accent: 'bg-blue',
    glow: 'from-blue/30',
    pip: 'border-blue bg-blue',
    text: 'text-blue',
  },
}

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.closest('[role="dialog"]') !== null
  )
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md 15.2 "autosave dan offline/retry state": every tap is applied to
// local state immediately (optimistic) and queued in IndexedDB before the network request even
// starts, so scoring never blocks on connectivity. The server returns the authoritative score with
// every OK response - `confirmedScoreForSet` holds the latest so the big number stays correct after
// a tap syncs (it used to snap back to the stale server prop until a manual refresh).
//
// Scoreboard model: one tap on a side's panel = +1 for that side (it used to be "select a side, then
// tap Add point", which made it easy to score for the wrong player). "Undo last" reverses the most
// recent tap whichever side it was; the per-side -1 is for correcting older mistakes.
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
  notScoreableAction,
  ruleset,
  priorSets,
  canPublish,
  returnTo,
}: LiveScoreControlsProps) {
  const setIdKey = String(matchSetId)
  // Taps made on this device for the current set, newest last - drives "Undo last".
  const [history, setHistory] = useState<Array<{ setId: string; side: Side }>>([])
  const scoreRefs = useRef<Record<Side, HTMLSpanElement | null>>({ a: null, b: null })

  const { isOnline, syncing, pendingCount, failedCount, addPoint, pendingDeltaForSet, confirmedScoreForSet, dismissFailed } =
    useOfflineScoreSync(matchNumber)

  const clampScore = (score: number) => {
    const max = ruleset?.max_score
    const floored = Math.max(0, score)
    return max !== null && max !== undefined ? Math.min(max, floored) : floored
  }
  const baseA = confirmedScoreForSet(setIdKey, 'a') ?? participantAScore
  const baseB = confirmedScoreForSet(setIdKey, 'b') ?? participantBScore
  const score: Record<Side, number> = {
    a: clampScore(baseA + pendingDeltaForSet(setIdKey, 'a')),
    b: clampScore(baseB + pendingDeltaForSet(setIdKey, 'b')),
  }
  const names: Record<Side, string> = { a: participantAName, b: participantBName }

  const currentSetWinner = deriveSetWinnerSide(ruleset, score.a, score.b)
  const outcome = deriveMatchOutcome(ruleset, [
    ...priorSets.map((set) => ({ participant_a_score: set.a, participant_b_score: set.b, winner_side: set.winnerSide })),
    { participant_a_score: score.a, participant_b_score: score.b },
  ])
  const setsWon: Record<Side, number> = { a: outcome.setsWonA, b: outcome.setsWonB }
  const isMultiSet = outcome.neededWins > 1 || priorSets.length > 0

  // "Set point" = one more point for this side would decide the set under the ruleset.
  const pointState = (side: Side): 'match' | 'set' | 'won' | null => {
    if (currentSetWinner === side) return 'won'
    if (currentSetWinner || outcome.decided) return null
    const next = side === 'a' ? deriveSetWinnerSide(ruleset, score.a + 1, score.b) : deriveSetWinnerSide(ruleset, score.a, score.b + 1)
    if (next !== side) return null
    return setsWon[side] + 1 >= outcome.neededWins ? 'match' : 'set'
  }

  const bump = useCallback((side: Side) => {
    if (prefersReducedMotion()) return
    scoreRefs.current[side]?.animate(
      [{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
      { duration: 180, easing: 'ease-out' },
    )
  }, [])

  const scorePoint = useCallback(
    (side: Side) => {
      if (!scoreable) return
      void addPoint(setIdKey, side, 1)
      setHistory((prev) => [...prev, { setId: setIdKey, side }])
      bump(side)
      if (typeof navigator !== 'undefined') navigator.vibrate?.(15)
    },
    [scoreable, addPoint, setIdKey, bump],
  )

  const removePoint = (side: Side) => {
    if (!scoreable || score[side] === 0) return
    void addPoint(setIdKey, side, -1)
    bump(side)
  }

  const lastTapIndex = history.map((entry) => entry.setId).lastIndexOf(setIdKey)
  const lastTap = lastTapIndex === -1 ? undefined : history[lastTapIndex]

  const undoLast = useCallback(() => {
    if (!scoreable || !lastTap) return
    void addPoint(setIdKey, lastTap.side, -1)
    setHistory((prev) => prev.filter((_, i) => i !== lastTapIndex))
    bump(lastTap.side)
  }, [scoreable, lastTap, lastTapIndex, addPoint, setIdKey, bump])

  // Desktop/keyboard scoring: ← / A for the left side, → / L for the right, Z or Backspace to undo.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'arrowleft' || key === 'a') {
        event.preventDefault()
        scorePoint('a')
      } else if (key === 'arrowright' || key === 'l') {
        event.preventDefault()
        scorePoint('b')
      } else if (key === 'z' || key === 'backspace') {
        event.preventDefault()
        undoLast()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [scorePoint, undoLast])

  const rulesSummary = [
    ruleset?.best_of && ruleset.best_of > 1 ? `Best of ${ruleset.best_of}` : null,
    ruleset?.target_score ? `to ${ruleset.target_score}${ruleset.max_score ? ` (max ${ruleset.max_score})` : ''}` : null,
    ruleset?.target_score ? (ruleset.deuce_enabled ? 'win by 2' : null) : null,
  ].filter(Boolean)

  const syncPill = (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold',
        !isOnline
          ? 'border-gold/40 bg-gold/10 text-gold'
          : pendingCount > 0
            ? 'border-line bg-mist text-ink-soft'
            : 'border-green/30 bg-paper text-green',
      )}
    >
      {!isOnline ? (
        <>
          <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
          Offline &middot; {pendingCount} queued
        </>
      ) : pendingCount > 0 ? (
        <>
          <Loader2 className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} aria-hidden="true" />
          Saving {pendingCount}&hellip;
        </>
      ) : (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Saved
        </>
      )}
    </span>
  )

  const winnerSide = outcome.winnerSide
  const nextStepBanner =
    !scoreable ? null : outcome.decided && winnerSide ? (
      <form
        id="finish-and-publish-form"
        action={finishAndPublishMatchAction}
        className="flex flex-col gap-3 rounded-panel border border-green/40 bg-green/[0.06] p-4 sm:flex-row sm:items-center"
      >
        <input type="hidden" name="matchNumber" value={matchNumber} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-extrabold text-green">
            <Trophy className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">
              {names[winnerSide]} wins
              {isMultiSet ? ` ${Math.max(outcome.setsWonA, outcome.setsWonB)}–${Math.min(outcome.setsWonA, outcome.setsWonB)}` : ''}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {canPublish
              ? 'Winner is taken from the score and the ruleset. Publishing advances the bracket.'
              : 'This records the winner and finishes the match. An event admin publishes the final result.'}
          </p>
        </div>
        <ConfirmSubmitButton
          formId="finish-and-publish-form"
          tone="default"
          disabled={pendingCount > 0}
          className="justify-center sm:w-auto"
          confirmMessage={
            canPublish
              ? 'Publish this result? It becomes the final public result and advances the bracket.'
              : 'Finish this match and record the winner? An event admin will publish it.'
          }
        >
          <Trophy className="h-4 w-4" aria-hidden="true" />
          {pendingCount > 0 ? 'Saving points…' : canPublish ? 'Finish & publish' : 'Finish match'}
        </ConfirmSubmitButton>
      </form>
    ) : currentSetWinner ? (
      <form
        action={addMatchSetAction}
        className="flex flex-col gap-3 rounded-panel border border-line bg-mist p-4 sm:flex-row sm:items-center"
      >
        <input type="hidden" name="matchNumber" value={matchNumber} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <p className="min-w-0 flex-1 font-bold text-ink">
          <CheckCircle2 className={cn('mr-2 inline h-5 w-5 align-[-4px]', SIDE_STYLES[currentSetWinner].text)} aria-hidden="true" />
          Set {setNumber} to {names[currentSetWinner]}{' '}
          <span className="tabular-nums text-ink-soft">
            ({score.a}–{score.b})
          </span>
        </p>
        <SubmitButton disabled={pendingCount > 0} className="justify-center">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Start Set {setNumber + 1}
        </SubmitButton>
      </form>
    ) : null

  const sidePanel = (side: Side) => {
    const state = pointState(side)
    const styles = SIDE_STYLES[side]
    return (
      <div className="flex min-h-0 flex-col gap-2">
        <button
          type="button"
          onClick={() => scorePoint(side)}
          disabled={!scoreable}
          aria-label={`Add point to ${names[side]} (currently ${score[side]})`}
          className={cn(
            'relative flex min-h-56 flex-1 select-none flex-col overflow-hidden rounded-panel p-4 text-left text-white shadow-md transition-[background-color,transform] duration-100 touch-manipulation active:scale-[0.985] sm:p-5',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
            styles.panel,
          )}
        >
          <span className={cn('pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-linear-to-b to-transparent', styles.glow)} aria-hidden="true" />
          <span className={cn('absolute inset-x-0 top-0 h-1.5', styles.accent)} aria-hidden="true" />
          <span className="relative flex items-start justify-between gap-2 pt-1">
            <span className="line-clamp-2 min-w-0 break-words text-lg font-extrabold leading-tight text-white sm:text-2xl">
              {names[side]}
            </span>
            {isMultiSet ? (
              <span className="mt-1 flex shrink-0 gap-1" aria-label={`${setsWon[side]} sets won`}>
                {Array.from({ length: outcome.neededWins }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-2.5 w-2.5 rounded-full border',
                      i < setsWon[side] ? styles.pip : 'border-white/40 bg-transparent',
                    )}
                  />
                ))}
              </span>
            ) : null}
          </span>

          <span className="relative grid flex-1 place-items-center py-2">
            <span
              ref={(el) => {
                scoreRefs.current[side] = el
              }}
              className="text-[clamp(5rem,20vw,11rem)] font-extrabold leading-none tabular-nums text-white"
            >
              {score[side]}
            </span>
          </span>

          <span className="relative flex min-h-7 items-center justify-between gap-2">
            {state ? (
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide',
                  state === 'won' ? cn(styles.accent, 'text-white') : 'bg-gold text-white',
                )}
              >
                {state === 'won' ? 'Set won' : state === 'match' ? 'Match point' : 'Set point'}
              </span>
            ) : (
              <span />
            )}
            {scoreable ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-white/70">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Tap to score</span>
                <kbd className="ml-1 hidden rounded border border-current/30 px-1.5 font-mono text-[10px] lg:inline">
                  {side === 'a' ? '←' : '→'}
                </kbd>
              </span>
            ) : null}
          </span>
        </button>

        <Button
          variant="secondary"
          onClick={() => removePoint(side)}
          disabled={!scoreable || score[side] === 0}
          aria-label={`Remove a point from ${names[side]}`}
          className="h-11 touch-manipulation"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />1
        </Button>
      </div>
    )
  }

  return (
    <section className="flex flex-1 flex-col gap-4" aria-label="Live score controls">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold text-ink">Set {setNumber}</h2>
          {rulesSummary.length > 0 ? (
            <p className="text-xs font-semibold text-ink-soft">{rulesSummary.join(' · ')}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {priorSets.map((set) => (
            <span
              key={set.setNumber}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-bold text-ink-soft"
            >
              S{set.setNumber}
              <span className="tabular-nums text-ink">
                {set.a}–{set.b}
              </span>
              {set.winnerSide ? (
                <span className={cn('h-2 w-2 rounded-full', SIDE_STYLES[set.winnerSide].accent)} aria-hidden="true" />
              ) : null}
            </span>
          ))}
          {syncPill}
        </div>
      </div>

      {failedCount > 0 ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-card border border-danger/30 bg-danger-surface px-3 py-2 text-xs font-bold text-danger"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          {failedCount} point{failedCount === 1 ? '' : 's'} couldn&apos;t be applied &mdash; the match or set
          changed. Check the score.
          <Button variant="ghost" size="sm" onClick={dismissFailed} className="ml-auto h-auto px-2 py-0.5 text-danger">
            <X className="h-3 w-3" aria-hidden="true" />
            Dismiss
          </Button>
        </div>
      ) : null}

      {!scoreable ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-panel border border-gold/40 bg-gold/[0.06] p-4 sm:flex-row sm:items-center"
        >
          <p className="min-w-0 flex-1 text-sm font-semibold text-ink-soft">
            {notScoreableAction ? (
              <>
                <span className="font-extrabold text-ink">Scoring is locked.</span> This match is{' '}
                {matchStatusLabel.toLowerCase()} &mdash; start it to enter points.
              </>
            ) : (
              <>
                <span className="font-extrabold text-ink">Scoring is closed.</span> This match is{' '}
                {matchStatusLabel.toLowerCase()}.
              </>
            )}
          </p>
          {notScoreableAction}
        </div>
      ) : null}

      {nextStepBanner}

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 sm:gap-4">
        {sidePanel('a')}
        {sidePanel('b')}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          onClick={undoLast}
          disabled={!scoreable || !lastTap}
          className="h-12 touch-manipulation px-4"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {lastTap ? (
            <span className="truncate">
              Undo last <span className="font-semibold text-ink-soft">(+1 {names[lastTap.side]})</span>
            </span>
          ) : (
            'Undo last'
          )}
        </Button>
        <p className="hidden text-xs text-ink-soft lg:block">
          Keyboard: <kbd className="font-mono">←</kbd>/<kbd className="font-mono">A</kbd> left &middot;{' '}
          <kbd className="font-mono">→</kbd>/<kbd className="font-mono">L</kbd> right &middot;{' '}
          <kbd className="font-mono">Z</kbd> undo
        </p>
      </div>
    </section>
  )
}
