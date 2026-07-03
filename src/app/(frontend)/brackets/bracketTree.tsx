'use client'

import React, { useEffect, useRef, useState } from 'react'
import { SingleEliminationBracket, SVGViewer } from '@g-loot/react-tournament-brackets'
import { Crown } from 'lucide-react'

import type { BracketChampion, BracketRound } from '@/lib/brackets'
import { cn } from '@/lib/utils'

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
  participants: GLootParticipant[]
}

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

const transformToGLootData = (rounds: BracketRound[]): GLootMatch[] => {
  const numRounds = rounds.length
  const flattened: GLootMatch[] = []

  for (let r = 0; r < numRounds; r += 1) {
    const round = rounds[r]
    const matchCount = Math.pow(2, numRounds - 1 - r)

    for (let m = 0; m < matchCount; m += 1) {
      const realMatch = round.matches[m]
      const matchId = realMatch ? String(realMatch.id) : `dummy-r${r}-m${m}`

      let nextMatchId: string | null = null
      if (r < numRounds - 1) {
        const nextIndex = Math.floor(m / 2)
        const nextRealMatch = rounds[r + 1]?.matches[nextIndex]
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
          participants: [
            {
              id: String(byeParticipant.id),
              name: byeParticipant.label,
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
        participants,
      })
    }
  }

  return flattened
}

type GLootPartyProp = {
  id?: string | number
  name?: string
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
  match: { href?: string }
  onMatchClick?: (payload: { match: unknown; topWon: boolean; bottomWon: boolean; event: React.MouseEvent }) => void
  topParty: GLootPartyProp
  bottomParty: GLootPartyProp
  topWon: boolean
  bottomWon: boolean
  topText?: string
  bottomText?: string
}) => {
  const matchDecided = Boolean(topWon || bottomWon)
  const topColor = getPartyColor(topParty, topWon, matchDecided)
  const bottomColor = getPartyColor(bottomParty, bottomWon, matchDecided)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <p style={{ color: '#707582', margin: '0 0 0.2rem', minHeight: '1.25rem', fontSize: '0.8rem' }}>{topText}</p>
        {match.href ? (
          <a
            href={match.href}
            onClick={(event) => onMatchClick?.({ match, topWon, bottomWon, event })}
            style={{ color: '#BEC0C6', fontSize: '0.8rem', textDecoration: 'none', cursor: 'pointer' }}
          >
            Match Details
          </a>
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

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (rounds.length === 0) {
    return null
  }

  const matches = transformToGLootData(rounds)

  return (
    <div>
      <ChampionBanner champion={champion} />
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
  )
}
