'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'
import type { BracketMatchCard, BracketRound, SingleEliminationBracketData } from '@/lib/brackets'
import type { DoubleEliminationBracketData } from '@/lib/doubleElimination'
import { updateQuickBracketMatchAction } from './quickBracketEditActions'

// The "run it live without signing up to a full event" piece of prd/design/
// QUICK_BRACKET_TOURNAMENT_DESIGN.md section 11 - a flat "matches ready to score" list rendered
// below the (still read-only, g-loot-rendered) bracket visual, rather than making the SVG tree
// itself clickable-editable. Simpler and lower-risk than teaching BracketTree's dialog about an
// edit mode, at the cost of not being able to click a node directly on the tree - an acceptable
// trade for a first cut of live scoring on a shared, already-complex rendering component.

type Section = { title: string; rounds: BracketRound[] }

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
  const [scores, setScores] = useState<Record<string, string>>({})

  const sections = buildSections(format, bracketData)
  const playableMatches = sections.flatMap((section) =>
    section.rounds.flatMap((round) =>
      round.matches
        .filter((match) => Boolean(match.participant_a.id && match.participant_b.id))
        .map((match) => ({ match, roundName: round.name, sectionTitle: section.title })),
    ),
  )

  const handleSave = async (matchId: string, winnerSlot: 'a' | 'b') => {
    setSavingId(matchId)
    setError(null)
    const result = await updateQuickBracketMatchAction(slug, matchId, winnerSlot, scores[matchId] || '')
    setSavingId(null)
    if (!result.ok) {
      setError(result.reason)
      return
    }
    router.refresh()
  }

  if (playableMatches.length === 0) {
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
    <div className="mt-6 rounded-panel border border-line bg-paper p-4">
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
                  score={scores[String(match.id)] ?? match.score_summary ?? ''}
                  onScoreChange={(value) => setScores((prev) => ({ ...prev, [String(match.id)]: value }))}
                  onSave={(slot) => handleSave(String(match.id), slot)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
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
  score: string
  onScoreChange: (value: string) => void
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
      <span className="text-xs font-semibold text-ink-soft">vs</span>
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
      <input
        value={score}
        onChange={(event) => onScoreChange(event.target.value)}
        placeholder="Score (optional)"
        className="h-8 w-32 rounded-full border border-line bg-paper px-3 text-xs text-ink focus-visible:border-green focus-visible:outline-none"
      />
      {decided ? <span className="text-xs font-bold text-green">Saved</span> : null}
      {saving ? <span className="text-xs text-ink-soft">Saving...</span> : null}
    </div>
  )
}
