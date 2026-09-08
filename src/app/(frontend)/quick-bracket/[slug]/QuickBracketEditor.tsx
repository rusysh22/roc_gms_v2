'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'
import type { BracketMatchCard, BracketRound, SingleEliminationBracketData } from '@/lib/brackets'
import type { DoubleEliminationBracketData } from '@/lib/doubleElimination'
import { assignQuickBracketParticipantAction, updateQuickBracketMatchAction } from './quickBracketEditActions'

// The "run it live without signing up to a full event" piece of prd/design/
// QUICK_BRACKET_TOURNAMENT_DESIGN.md section 11 - a flat "matches ready to score" list rendered
// below the (still read-only, g-loot-rendered) bracket visual, rather than making the SVG tree
// itself clickable-editable. Simpler and lower-risk than teaching BracketTree's dialog about an
// edit mode, at the cost of not being able to click a node directly on the tree - an acceptable
// trade for a first cut of live scoring on a shared, already-complex rendering component.
//
// One number per side (not a single freeform "score" string) - these numbers flow straight into
// BracketParticipant.score (see src/lib/brackets.ts), which BracketTree's compact match card and
// details modal already know how to display, matching how a real per-side result reads everywhere
// else in the app.

type Section = { title: string; rounds: BracketRound[] }
type ScoreState = { a: string; b: string }

const buildSections = (
  format: 'single_elimination' | 'double_elimination',
  bracketData: SingleEliminationBracketData | DoubleEliminationBracketData,
): Section[] => {
  if (format === 'double_elimination') {
    const data = bracketData as DoubleEliminationBracketData
    const grandFinalRound: BracketRound[] = data.grand_final
      ? [{ name: 'Grand Final', order: 0, matches: [data.grand_final] }]
      : []
    return [
      { title: 'Winners bracket', rounds: data.winners_rounds },
      { title: 'Losers bracket', rounds: data.losers_rounds },
      { title: 'Grand final', rounds: grandFinalRound },
    ]
  }
  return [{ title: 'Bracket', rounds: (bracketData as SingleEliminationBracketData).rounds }]
}

// Only round 1 (single elimination) / Winners Round 1 (double elimination) can ever be TBD-with-
// no-id - every other round is always filled by the advancement engine, never named directly. A
// "from participants" bracket already has real ids here, so this is only ever non-empty for a
// "manual size" (blank) bracket - see assignNameToRound0 in quickBracketAdvancement.ts.
const getRound0 = (
  format: 'single_elimination' | 'double_elimination',
  bracketData: SingleEliminationBracketData | DoubleEliminationBracketData,
): BracketRound | undefined =>
  format === 'double_elimination'
    ? (bracketData as DoubleEliminationBracketData).winners_rounds[0]
    : (bracketData as SingleEliminationBracketData).rounds[0]

export function QuickBracketEditor({
  slug,
  format,
  bracketData,
}: {
  slug: string
  format: 'single_elimination' | 'double_elimination'
  bracketData: SingleEliminationBracketData | DoubleEliminationBracketData
}) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, ScoreState>>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const [savingNameKey, setSavingNameKey] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  const sections = buildSections(format, bracketData)
  const playableMatches = sections.flatMap((section) =>
    section.rounds.flatMap((round) =>
      round.matches
        .filter((match) => Boolean(match.participant_a.id && match.participant_b.id))
        .map((match) => ({ match, roundName: round.name, sectionTitle: section.title })),
    ),
  )

  const round0 = getRound0(format, bracketData)
  const unnamedMatches = (round0?.matches ?? [])
    .filter((match) => !match.participant_a.id || !match.participant_b.id)
    .map((match) => ({ match, roundName: round0!.name }))

  const handleSave = async (matchId: string, winnerSlot: 'a' | 'b') => {
    setSavingId(matchId)
    setError(null)
    const current = scores[matchId] || { a: '', b: '' }
    const result = await updateQuickBracketMatchAction(slug, matchId, winnerSlot, current.a, current.b)
    setSavingId(null)
    if (!result.ok) {
      setError(result.reason)
      return
    }
    router.refresh()
  }

  const handleAssignName = async (matchId: string, slot: 'a' | 'b') => {
    const key = `${matchId}:${slot}`
    const value = (names[key] ?? '').trim()
    if (!value) return
    setSavingNameKey(key)
    setNameError(null)
    const result = await assignQuickBracketParticipantAction(slug, matchId, slot, value)
    setSavingNameKey(null)
    if (!result.ok) {
      setNameError(result.reason)
      return
    }
    setNames((prev) => ({ ...prev, [key]: '' }))
    router.refresh()
  }

  if (playableMatches.length === 0 && unnamedMatches.length === 0) {
    return (
      <div className="mt-6 rounded-panel border border-line bg-mist p-4 text-sm text-ink-soft">
        No matches are ready to score yet - once both sides of a match are known, it shows up here.
      </div>
    )
  }

  const bySectionTitle = new Map<string, typeof playableMatches>()
  for (const item of playableMatches) {
    const list = bySectionTitle.get(item.sectionTitle) || []
    list.push(item)
    bySectionTitle.set(item.sectionTitle, list)
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {unnamedMatches.length > 0 ? (
        <div className="rounded-panel border border-line bg-paper p-4">
          <p className="mb-1 text-sm font-bold text-ink">Name your teams</p>
          <p className="mb-3 text-xs text-ink-soft">
            This bracket was generated with a blank slot count - name each side below before you
            can enter its result.
          </p>
          {nameError ? <p className="mb-3 text-xs font-semibold text-danger">{nameError}</p> : null}
          <div className="flex flex-col gap-2">
            {unnamedMatches.map(({ match, roundName }) => (
              <div
                key={match.id}
                className="flex flex-wrap items-center gap-2 rounded-card border border-line p-3"
              >
                <span className="w-28 shrink-0 text-xs font-semibold text-ink-soft">{roundName}</span>
                <NameSlot
                  match={match}
                  slot="a"
                  value={names[`${match.id}:a`] ?? ''}
                  saving={savingNameKey === `${match.id}:a`}
                  onChange={(value) => setNames((prev) => ({ ...prev, [`${match.id}:a`]: value }))}
                  onSave={() => handleAssignName(String(match.id), 'a')}
                />
                <span className="text-xs font-semibold text-ink-soft">vs</span>
                <NameSlot
                  match={match}
                  slot="b"
                  value={names[`${match.id}:b`] ?? ''}
                  saving={savingNameKey === `${match.id}:b`}
                  onChange={(value) => setNames((prev) => ({ ...prev, [`${match.id}:b`]: value }))}
                  onSave={() => handleAssignName(String(match.id), 'b')}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {playableMatches.length > 0 ? (
        <div className="rounded-panel border border-line bg-paper p-4">
          <p className="mb-3 text-sm font-bold text-ink">Enter results</p>
          {error ? <p className="mb-3 text-xs font-semibold text-danger">{error}</p> : null}
          <div className="flex flex-col gap-5">
            {Array.from(bySectionTitle.entries()).map(([sectionTitle, items]) => (
              <div key={sectionTitle}>
                {sections.length > 1 ? (
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">{sectionTitle}</p>
                ) : null}
                <div className="flex flex-col gap-2">
                  {items.map(({ match, roundName }) => (
                    <MatchResultRow
                      key={match.id}
                      match={match}
                      roundName={roundName}
                      saving={savingId === String(match.id)}
                      score={
                        scores[String(match.id)] ?? {
                          a: match.participant_a.score?.toString() ?? '',
                          b: match.participant_b.score?.toString() ?? '',
                        }
                      }
                      onScoreChange={(next) =>
                        setScores((prev) => ({ ...prev, [String(match.id)]: next }))
                      }
                      onSave={(slot) => handleSave(String(match.id), slot)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

const NameSlot = ({
  match,
  slot,
  value,
  saving,
  onChange,
  onSave,
}: {
  match: BracketMatchCard
  slot: 'a' | 'b'
  value: string
  saving: boolean
  onChange: (value: string) => void
  onSave: () => void
}) => {
  const participant = slot === 'a' ? match.participant_a : match.participant_b
  if (participant.id) {
    return (
      <span className="rounded-full border border-green/40 bg-green/10 px-3 py-1 text-sm font-semibold text-ink">
        {participant.label}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onSave()
          }
        }}
        placeholder="Team name"
        maxLength={120}
        className="h-8 w-36 rounded-full border border-line bg-paper px-3 text-xs text-ink focus-visible:border-green focus-visible:outline-none"
      />
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !value.trim()}
        className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-green disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </span>
  )
}

const MatchResultRow = ({
  match,
  roundName,
  saving,
  score,
  onScoreChange,
  onSave,
}: {
  match: BracketMatchCard
  roundName: string
  saving: boolean
  score: ScoreState
  onScoreChange: (score: ScoreState) => void
  onSave: (slot: 'a' | 'b') => void
}) => {
  const decided = match.status === 'result_published'

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-line p-3">
      <span className="w-28 shrink-0 text-xs font-semibold text-ink-soft">{roundName}</span>

      <button
        type="button"
        onClick={() => onSave('a')}
        disabled={saving}
        className={cn(
          'rounded-full border px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50',
          match.participant_a.isWinner
            ? 'border-green bg-green/10 text-ink'
            : 'border-line text-ink hover:border-green',
        )}
      >
        {match.participant_a.label}
      </button>
      <input
        value={score.a}
        onChange={(event) => onScoreChange({ ...score, a: event.target.value })}
        placeholder="0"
        inputMode="numeric"
        className="h-8 w-14 rounded-full border border-line bg-paper px-2 text-center text-xs text-ink focus-visible:border-green focus-visible:outline-none"
      />

      <span className="text-xs font-semibold text-ink-soft">vs</span>

      <input
        value={score.b}
        onChange={(event) => onScoreChange({ ...score, b: event.target.value })}
        placeholder="0"
        inputMode="numeric"
        className="h-8 w-14 rounded-full border border-line bg-paper px-2 text-center text-xs text-ink focus-visible:border-green focus-visible:outline-none"
      />
      <button
        type="button"
        onClick={() => onSave('b')}
        disabled={saving}
        className={cn(
          'rounded-full border px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50',
          match.participant_b.isWinner
            ? 'border-green bg-green/10 text-ink'
            : 'border-line text-ink hover:border-green',
        )}
      >
        {match.participant_b.label}
      </button>

      {decided ? <span className="text-xs font-bold text-green">Saved</span> : null}
      {saving ? <span className="text-xs text-ink-soft">Saving...</span> : null}
    </div>
  )
}
