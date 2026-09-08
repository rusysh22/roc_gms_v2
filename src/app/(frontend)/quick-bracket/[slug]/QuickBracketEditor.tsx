'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import type { BracketMatchCard, BracketRound, SingleEliminationBracketData } from '@/lib/brackets'
import type { DoubleEliminationBracketData } from '@/lib/doubleElimination'
import { assignQuickBracketParticipantAction } from './quickBracketEditActions'

// Scoring itself now happens inline in BracketTree's "Match Details" modal (its Score tab, wired
// up via the `quickBracketSlug` prop - see bracketTree.tsx) rather than in a separate flat list
// here, so a match's tree card and its score-entry form are the same click target. This component
// is left with just "Name your teams" (see getRound0 below) - a step the modal can't absorb
// because a fully-blank round-1 match has no detail_href yet, so there's no tree card to click to
// open it.

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
  const [names, setNames] = useState<Record<string, string>>({})
  const [savingNameKey, setSavingNameKey] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  const round0 = getRound0(format, bracketData)
  const unnamedMatches = (round0?.matches ?? [])
    .filter((match) => !match.participant_a.id || !match.participant_b.id)
    .map((match) => ({ match, roundName: round0!.name }))

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

  if (unnamedMatches.length === 0) {
    return null
  }

  return (
    <div className="mt-6 rounded-panel border border-line bg-paper p-4">
      <p className="mb-1 text-sm font-bold text-ink">Name your teams</p>
      <p className="mb-3 text-xs text-ink-soft">
        This bracket was generated with a blank slot count - name each side below before you can
        enter its result.
      </p>
      {nameError ? <p className="mb-3 text-xs font-semibold text-danger">{nameError}</p> : null}
      <div className="flex flex-col gap-2">
        {unnamedMatches.map(({ match, roundName }) => (
          <div key={match.id} className="flex flex-wrap items-center gap-2 rounded-card border border-line p-3">
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
