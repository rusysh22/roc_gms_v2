'use client'

import React, { useEffect, useRef, useState } from 'react'
import { SingleEliminationBracket, SVGViewer } from '@g-loot/react-tournament-brackets'
import { Crown, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

import type { BracketChampion, BracketRound } from '@/lib/brackets'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { updateBracketMatchAction } from './bracketModalActions'

// Rebuilt against the library's own default Match/theme rendering instead of fighting it with a
// fully custom match component - the previous build reimplemented our whole card design on top of
// g-loot's positioning engine, which produced a result nobody was happy with. This version supplies
// data in g-loot's native shape and lets its default dark theme and default round headers
// ("Round 1" / "Semi-final" / "Final") render as-is. The one deliberate departure is the match box
// itself (CustomMatch below): the library's default only supports a binary won/lost text color, but
// a per-participant state of white (undetermined) / blue (won) / yellow (lost) / gray (TBD) needs a
// third and fourth state the theme system can't express - so CustomMatch reproduces the default's
// exact layout/spacing/background colors and only replaces the color decision.

const formatMatchDate = (value?: string) => {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value))
}

type GLootParticipant = {
  id: string
  name: string
  subLabel?: string
  isWinner: boolean
  status: 'PLAYED' | null
  resultText: string | null
}

type GLootMatch = {
  id: string
  name: string
  nextMatchId: string | null
  tournamentRoundText: string
  startTime: string
  state: string
  href?: string
  participantAName?: string
  participantBName?: string
  participantASubLabel?: string
  participantBSubLabel?: string
  participants: GLootParticipant[]
}

const BracketDialogContext = React.createContext<(match: GLootMatch) => void>(() => undefined)

// The bracket cache (src/lib/brackets.ts) has no explicit parent/child edges between rounds (see
// D016/D018) - assuming a perfect binary bracket (round r+1 match i is fed by round r matches
// 2i/2i+1) is the same assumption the winner-advancement module already makes, reused here purely
// to wire up g-loot's required nextMatchId chain.
const parseSetsWon = (setScore?: string): [number, number] | null => {
  if (!setScore) {
    return null
  }

  let a = 0
  let b = 0
  let parsed = 0
  for (const set of setScore.split(',')) {
    const [rawA, rawB] = set.trim().split('-').map((value) => Number(value.trim()))
    if (Number.isNaN(rawA) || Number.isNaN(rawB)) {
      continue
    }
    parsed += 1
    if (rawA > rawB) a += 1
    else if (rawB > rawA) b += 1
  }

  return parsed === 0 ? null : [a, b]
}

const getInferredRoundName = (roundsRemaining: number) => {
  if (roundsRemaining === 0) return 'Final'
  if (roundsRemaining === 1) return 'Semifinal'
  if (roundsRemaining === 2) return 'Quarterfinal'
  return `Round of ${2 ** (roundsRemaining + 1)}`
}

// Old wizard runs created the opening fixtures but not the downstream TBD fixtures. Retain every
// real match and infer empty rounds for display, so an incomplete cache cannot collapse a whole
// opening round into one box labelled "Final". New wizard runs persist those downstream matches.
const normalizeBracketRounds = (rounds: BracketRound[]) => {
  const firstRoundMatchCount = rounds[0]?.matches.length || 0
  const inferredRoundCount = firstRoundMatchCount > 1 ? Math.ceil(Math.log2(firstRoundMatchCount)) + 1 : 1
  const roundCount = Math.max(rounds.length, inferredRoundCount)

  return Array.from({ length: roundCount }, (_, index) => {
    const existing = rounds[index]
    return existing || {
      name: getInferredRoundName(roundCount - index - 1),
      order: index,
      matches: [],
    }
  })
}

const transformToGLootData = (rounds: BracketRound[]): GLootMatch[] => {
  const displayRounds = normalizeBracketRounds(rounds)
  const numRounds = displayRounds.length
  const flattened: GLootMatch[] = []

  for (let r = 0; r < numRounds; r += 1) {
    const round = displayRounds[r]
    // Never discard real matches when legacy data has fewer persisted rounds than its shape.
    const matchCount = Math.max(round.matches.length, Math.pow(2, numRounds - 1 - r))

    for (let m = 0; m < matchCount; m += 1) {
      const realMatch = round.matches[m]
      const matchId = realMatch ? String(realMatch.id) : `dummy-r${r}-m${m}`

      let nextMatchId: string | null = null
      if (r < numRounds - 1) {
        const nextIndex = Math.floor(m / 2)
        const nextRealMatch = displayRounds[r + 1]?.matches[nextIndex]
        nextMatchId = nextRealMatch ? String(nextRealMatch.id) : `dummy-r${r + 1}-m${nextIndex}`
      }

      if (!realMatch) {
        flattened.push({
          id: matchId,
          name: round?.name || `Round ${r + 1}`,
          nextMatchId,
          tournamentRoundText: String(r + 1),
          startTime: '',
          state: 'unscheduled',
          participants: [],
        })
        continue
      }

      // A bye: exactly one side is a real participant and the match is marked 'walkover' (see
      // demoScenario.ts D024 comments). g-loot has a native representation for this - a
      // single-participant match with match-level state 'WALK_OVER' - which auto-styles that
      // participant as the winner and tags them 'WO', instead of showing a misleading "vs TBD".
      const hasParticipantA = Boolean(realMatch.participant_a.id)
      const hasParticipantB = Boolean(realMatch.participant_b.id)
      const isBye = realMatch.status === 'walkover' && hasParticipantA !== hasParticipantB

      if (isBye) {
        const byeParticipant = hasParticipantA ? realMatch.participant_a : realMatch.participant_b
        flattened.push({
          id: matchId,
          name: realMatch.match_number,
          nextMatchId,
          tournamentRoundText: String(r + 1),
          startTime: formatMatchDate(realMatch.scheduled_start_at),
          state: 'WALK_OVER',
          href: realMatch.detail_href,
          participantAName: realMatch.participant_a.label,
          participantBName: realMatch.participant_b.label,
          participantASubLabel: realMatch.participant_a.subLabel,
          participantBSubLabel: realMatch.participant_b.subLabel,
          participants: [
            {
              id: String(byeParticipant.id),
              name: byeParticipant.label,
              subLabel: byeParticipant.subLabel,
              isWinner: true,
              status: null,
              resultText: null,
            },
          ],
        })
        continue
      }

      const setsWon = parseSetsWon(realMatch.set_score)
      const participants: GLootParticipant[] = []
      const sides = [
        { participant: realMatch.participant_a, score: setsWon?.[0] },
        { participant: realMatch.participant_b, score: setsWon?.[1] },
      ]

      for (const { participant, score } of sides) {
        if (!participant.id) {
          continue
        }

        const isWalkoverWinner = realMatch.status === 'walkover' && participant.isWinner
        participants.push({
          id: String(participant.id),
          name: participant.label,
          subLabel: participant.subLabel,
          isWinner: participant.isWinner,
          status: score !== undefined || participant.isWinner ? 'PLAYED' : null,
          resultText:
            score !== undefined ? String(score)
            : isWalkoverWinner ? 'WO'
            : null,
        })
      }

      flattened.push({
        id: matchId,
        name: realMatch.match_number,
        nextMatchId,
        tournamentRoundText: String(r + 1),
        startTime: formatMatchDate(realMatch.scheduled_start_at),
        state: realMatch.status,
        href: realMatch.detail_href,
        participantAName: realMatch.participant_a.label,
        participantBName: realMatch.participant_b.label,
        participants,
      })
    }
  }

  return flattened
}

type GLootPartyProp = {
  id?: string | number
  name?: string
  subLabel?: string
  resultText?: string | null
}

// White (undetermined) / blue (won) / yellow (lost) / gray (TBD) - four states the library's own
// binary won/lost theme color can't express (a scheduled-but-unplayed match and a genuine loss both
// map to the same "not won" flag upstream), so the color decision is made explicitly here instead.
const PARTY_TEXT_COLOR = {
  tbd: '#9CA3AF',
  pending: '#FFFFFF',
  winner: '#60A5FA',
  loser: '#FACC15',
} as const

const getPartyColor = (party: GLootPartyProp, isWinner: boolean, matchDecided: boolean) => {
  if (!party?.id) return PARTY_TEXT_COLOR.tbd
  if (isWinner) return PARTY_TEXT_COLOR.winner
  if (matchDecided) return PARTY_TEXT_COLOR.loser
  return PARTY_TEXT_COLOR.pending
}

// Reproduces the default Match component's exact structure and spacing (see
// @g-loot/react-tournament-brackets components/match) - same top caption + "Match Details" link,
// same two-row layout with a divider, same bottom caption - only the text color logic differs.
const CustomMatch = ({
  match,
  onMatchClick,
  topParty,
  bottomParty,
  topWon,
  bottomWon,
  topText,
  bottomText,
}: {
  match: GLootMatch
  onMatchClick?: (payload: { match: unknown; topWon: boolean; bottomWon: boolean; event: React.MouseEvent }) => void
  topParty: GLootPartyProp
  bottomParty: GLootPartyProp
  topWon: boolean
  bottomWon: boolean
  topText?: string
  bottomText?: string
}) => {
  const selectMatch = React.useContext(BracketDialogContext)
  const matchDecided = Boolean(topWon || bottomWon)
  const topColor = getPartyColor(topParty, topWon, matchDecided)
  const bottomColor = getPartyColor(bottomParty, bottomWon, matchDecided)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <p style={{ color: '#707582', margin: '0 0 0.2rem', minHeight: '1.25rem', fontSize: '0.8rem' }}>{topText}</p>
        {match.href ? (
          <Dialog.Trigger asChild>
            <button
              type="button"
              onClick={(event) => {
                selectMatch(match)
                onMatchClick?.({ match, topWon, bottomWon, event })
              }}
              style={{ color: '#BEC0C6', fontSize: '0.8rem', textDecoration: 'none', cursor: 'pointer' }}
            >
              Match Details
            </button>
          </Dialog.Trigger>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 0 0 1rem',
            background: '#1D2232',
            border: '1px solid #22293B',
            borderLeftWidth: 4,
            borderRightWidth: 4,
            borderBottom: 'none',
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
          }}
        >
          <div style={{ color: topColor, fontWeight: topWon ? 700 : 400, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {topParty?.name}
            {topParty?.subLabel ? (
              <span style={{ marginLeft: 6, fontSize: '0.7rem', fontWeight: 400, opacity: 0.65 }}>
                {topParty.subLabel}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', height: '100%', padding: '0 1rem', alignItems: 'center', justifyContent: 'center', width: '20%', color: topColor, fontWeight: 700 }}>
            {topParty?.resultText}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 0 0 1rem',
            background: '#141822',
            border: '1px solid #22293B',
            borderLeftWidth: 4,
            borderRightWidth: 4,
            borderBottomLeftRadius: 3,
            borderBottomRightRadius: 3,
          }}
        >
          <div style={{ color: bottomColor, fontWeight: bottomWon ? 700 : 400, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {bottomParty?.name}
            {bottomParty?.subLabel ? (
              <span style={{ marginLeft: 6, fontSize: '0.7rem', fontWeight: 400, opacity: 0.65 }}>
                {bottomParty.subLabel}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', height: '100%', padding: '0 1rem', alignItems: 'center', justifyContent: 'center', width: '20%', color: bottomColor, fontWeight: 700 }}>
            {bottomParty?.resultText}
          </div>
        </div>
      </div>
      <p style={{ color: '#707582', textAlign: 'center', margin: '0.2rem 0 0', minHeight: '1.25rem', fontSize: '0.75rem' }}>
        {bottomText ?? ' '}
      </p>
    </div>
  )
}

// Measures its own width so the pan/zoom viewport matches the available column instead of a
// hardcoded pixel size - the bracket canvas itself still renders at its natural (often much wider)
// size and can be panned/zoomed into, satisfying prd/README.md section 13's "allow zoom/pan on
// small screens" requirement.
const useContainerWidth = () => {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!ref.current) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setWidth(entry.contentRect.width)
      }
    })
    observer.observe(ref.current)

    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}

const ChampionBanner = ({ champion }: { champion?: BracketChampion | null }) => {
  const isDecided = champion?.status === 'decided'

  return (
    <div
      className={cn(
        'mb-4 flex items-center gap-3 rounded-panel border p-4',
        isDecided ? 'border-gold bg-paper shadow-md' : 'border-dashed border-line bg-paper',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          isDecided ? 'bg-gold text-paper' : 'bg-mist text-ink-soft',
        )}
      >
        <Crown className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Champion</p>
        {isDecided ? (
          <p className="truncate text-sm font-extrabold text-ink">{champion.label}</p>
        ) : (
          <p className="truncate text-sm font-semibold italic text-ink-soft">
            {champion?.reason || 'Not decided yet'}
          </p>
        )}
      </div>
    </div>
  )
}

export const BracketTree = ({
  rounds,
  champion,
}: {
  rounds: BracketRound[]
  champion?: BracketChampion | null
}) => {
  const [isMounted, setIsMounted] = useState(false)
  const [containerRef, containerWidth] = useContainerWidth()
  const [selectedMatch, setSelectedMatch] = useState<GLootMatch | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (rounds.length === 0) {
    return null
  }

  const matches = transformToGLootData(rounds)

  return (
    <Dialog.Root open={Boolean(selectedMatch)} onOpenChange={(open) => !open && setSelectedMatch(null)}>
    <BracketDialogContext.Provider value={setSelectedMatch}>
    <div>
      <ChampionBanner champion={champion} />
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed inset-x-4 top-1/2 z-50 mx-auto flex max-h-[85vh] w-auto max-w-xl -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-panel border border-line bg-paper p-6 shadow-xl outline-none"
            aria-describedby={undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Match details</p>
                <Dialog.Title className="mt-0.5 truncate text-xl font-extrabold text-ink">
                  {selectedMatch?.name || 'Match'}
                </Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-mist hover:text-ink"
                >
                  <X className="h-4.5 w-4.5" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>

            {selectedMatch ? (
              <>
                <div className="flex items-center justify-between gap-3 rounded-card bg-mist px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {selectedMatch.participantAName || 'TBD'}
                    </p>
                    {selectedMatch.participantASubLabel ? (
                      <p className="truncate text-xs text-ink-soft">{selectedMatch.participantASubLabel}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs font-bold text-ink-soft">vs</span>
                  <div className="min-w-0 text-right">
                    <p className="truncate text-sm font-bold text-ink">
                      {selectedMatch.participantBName || 'TBD'}
                    </p>
                    {selectedMatch.participantBSubLabel ? (
                      <p className="truncate text-xs text-ink-soft">{selectedMatch.participantBSubLabel}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <form
                    action={updateBracketMatchAction}
                    className="flex flex-col gap-3 rounded-card border border-line p-4"
                  >
                    <input type="hidden" name="intent" value="score" />
                    <input type="hidden" name="matchId" value={selectedMatch.id} />
                    <input type="hidden" name="matchNumber" value={selectedMatch.name} />
                    <div>
                      <h3 className="text-sm font-extrabold text-ink">Update result</h3>
                      <p className="text-xs text-ink-soft">
                        Winner is determined automatically from the higher score.
                      </p>
                    </div>
                    <Field label={selectedMatch.participantAName || 'Participant A'}>
                      <Input name="scoreA" type="number" min="0" required />
                    </Field>
                    <Field label={selectedMatch.participantBName || 'Participant B'}>
                      <Input name="scoreB" type="number" min="0" required />
                    </Field>
                    <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <input
                        name="addSet"
                        type="checkbox"
                        className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
                      />
                      Add a new set
                    </label>
                    <Button type="submit" className="mt-1">
                      Save result
                    </Button>
                  </form>

                  <form
                    action={updateBracketMatchAction}
                    className="flex flex-col gap-3 rounded-card border border-line p-4"
                  >
                    <input type="hidden" name="intent" value="schedule" />
                    <input type="hidden" name="matchId" value={selectedMatch.id} />
                    <input type="hidden" name="matchNumber" value={selectedMatch.name} />
                    <h3 className="text-sm font-extrabold text-ink">Set schedule</h3>
                    <Field label="Start">
                      <Input name="scheduledStart" type="datetime-local" required />
                    </Field>
                    <Field label="End">
                      <Input name="scheduledEnd" type="datetime-local" required />
                    </Field>
                    <Button type="submit" variant="secondary" className="mt-auto">
                      Save schedule
                    </Button>
                  </form>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      <div ref={containerRef} className="overflow-hidden rounded-panel border border-line">
        {isMounted && containerWidth > 0 ? (
          <SingleEliminationBracket
            matches={matches}
            matchComponent={CustomMatch}
            svgWrapper={({ children, ...props }: React.ComponentProps<typeof SVGViewer>) => (
              <SVGViewer {...props} width={containerWidth} height={600}>
                {children}
              </SVGViewer>
            )}
          />
        ) : (
          <div className="h-[600px] w-full animate-pulse bg-mist" />
        )}
      </div>
    </div>
    </BracketDialogContext.Provider>
    </Dialog.Root>
  )
}
