'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SingleEliminationBracket, SVGViewer } from '@g-loot/react-tournament-brackets'
import { ArrowRight, Calendar, Crown, MapPin, Trophy, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

import type { BracketChampion, BracketMatchCard, BracketParticipant, BracketRound } from '@/lib/brackets'
import { StatusBadge, getMatchStatusTone } from '@/components/ui/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DEFAULT_EVENT_TIMEZONE } from '@/lib/timezone'
// A shared, generic bracket renderer used across real events AND Quick Bracket Tournament - but
// score editing only ever exists for the latter (real matches are edited from the Match Officer /
// Scheduler workspace instead), so this import - and the `quickBracketSlug` prop below that gates
// it - is deliberately Quick-Bracket-specific rather than a generic callback threaded in from
// every caller. See QUICK_BRACKET_DETAIL_HREF/the "no public page" fallback below for the same
// already-accepted pattern of this shared component knowing about Quick Bracket specifically.
import {
  updateQuickBracketMatchAction,
  updateQuickBracketMatchScheduleAction,
} from '../quick-bracket/[slug]/quickBracketEditActions'

// Rebuilt against the library's own default Match/theme rendering instead of fighting it with a
// fully custom match component - the previous build reimplemented our whole card design on top of
// g-loot's positioning engine, which produced a result nobody was happy with. This version supplies
// data in g-loot's native shape and lets its default dark theme and default round headers
// ("Round 1" / "Semi-final" / "Final") render as-is. The one deliberate departure is the match box
// itself (CustomMatch below): the library's default only supports a binary won/lost text color, but
// a per-participant state of white (undetermined) / blue (won) / yellow (lost) / gray (TBD) needs a
// third and fourth state the theme system can't express - so CustomMatch reproduces the default's
// exact layout/spacing/background colors and only replaces the color decision.

const formatMatchDate = (value: string | undefined, timezone: string) => {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(value))
}

// Quick Bracket always displays match times in DEFAULT_EVENT_TIMEZONE (Asia/Jakarta - see
// formatMatchDate's `timezone` prop, which this component never lets vary), so the editable
// <input type="datetime-local"> must round-trip through that SAME fixed zone - not the viewer's
// browser timezone - or a value typed and saved by an organizer outside WIB would silently
// re-display as a different wall-clock time than what they entered. Indonesia has no DST, so a
// fixed +07:00 offset is exact (unlike RescheduleMatchDialog.tsx's own toDateTimeLocalValue, which
// intentionally uses the browser's local zone because the real scheduler's event can be in any
// timezone and that dialog runs entirely client-side against the organizer's own wall clock).
const JAKARTA_UTC_OFFSET = '+07:00'

const toDateTimeLocalValue = (iso?: string) => {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

const fromDateTimeLocalValue = (value: string): string | null =>
  value ? new Date(`${value}:00${JAKARTA_UTC_OFFSET}`).toISOString() : null

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
  // Unformatted ISO, alongside the already-formatted `startTime` display string above - the Match
  // Details modal's editable Schedule tab needs the raw value to prefill/reset its
  // <input type="datetime-local">, which `startTime` (locale/timezone-formatted for display) can't
  // round-trip back into an input value.
  scheduledStartAtRaw?: string
  state: string
  href?: string
  roundName?: string
  scoreSummary?: string
  setScoreText?: string
  venueLabel?: string
  participantAName?: string
  participantBName?: string
  participantASubLabel?: string
  participantBSubLabel?: string
  // Sourced directly from participant_a/participant_b (unconditionally), unlike `participants`
  // below which drops a side entirely when it has no id yet (TBD) - the modal needs A/B-aligned
  // score text that survives that case, not an array that silently shifts when one side is TBD.
  participantAResultText?: string
  participantBResultText?: string
  participantAIsWinner?: boolean
  participantBIsWinner?: boolean
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

// Same "already decided" bucket used elsewhere (schedule page's Results filter, match detail
// page) - a match with this status has a real result to show, not just a "vs" placeholder.
const RESULT_STATUSES = new Set([
  'finished',
  'result_published',
  'under_review',
  'disputed',
  'cancelled',
  'walkover',
])
const LIVE_STATUSES = new Set(['ongoing', 'paused'])

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

// Takes already-normalized rounds (see normalizeBracketRounds) so BracketTree can compute the
// same displayRounds once and reuse it for the round-header names and the round-jump dropdown,
// instead of this function silently normalizing its own private copy.
const transformToGLootData = (displayRounds: BracketRound[], timezone: string): GLootMatch[] => {
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
          startTime: formatMatchDate(realMatch.scheduled_start_at, timezone),
          scheduledStartAtRaw: realMatch.scheduled_start_at,
          state: 'WALK_OVER',
          href: realMatch.detail_href,
          roundName: round?.name,
          venueLabel: realMatch.venue_label,
          participantAName: realMatch.participant_a.label,
          participantBName: realMatch.participant_b.label,
          participantASubLabel: realMatch.participant_a.subLabel,
          participantBSubLabel: realMatch.participant_b.subLabel,
          participantAResultText: hasParticipantA ? 'WO' : undefined,
          participantBResultText: hasParticipantB ? 'WO' : undefined,
          participantAIsWinner: hasParticipantA,
          participantBIsWinner: hasParticipantB,
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
      // Quick Bracket Tournament matches have no structured set_score (no per-set entry, just a
      // simple per-side number) - fall back to BracketParticipant.score, which only quick-bracket
      // data ever sets, so this changes nothing for production matches.
      const sides = [
        { participant: realMatch.participant_a, score: setsWon?.[0] ?? realMatch.participant_a.score },
        { participant: realMatch.participant_b, score: setsWon?.[1] ?? realMatch.participant_b.score },
      ]
      const resultTextFor = (side: (typeof sides)[number]) => {
        const isWalkoverWinner = realMatch.status === 'walkover' && side.participant.isWinner
        if (side.score !== undefined) return String(side.score)
        if (isWalkoverWinner) return 'WO'
        return undefined
      }

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
        startTime: formatMatchDate(realMatch.scheduled_start_at, timezone),
        scheduledStartAtRaw: realMatch.scheduled_start_at,
        state: realMatch.status,
        href: realMatch.detail_href,
        roundName: round?.name,
        scoreSummary: realMatch.score_summary,
        setScoreText: realMatch.set_score,
        venueLabel: realMatch.venue_label,
        participantAResultText: hasParticipantA ? resultTextFor(sides[0]) : undefined,
        participantBResultText: hasParticipantB ? resultTextFor(sides[1]) : undefined,
        participantAIsWinner: hasParticipantA ? sides[0].participant.isWinner : false,
        participantBIsWinner: hasParticipantB ? sides[1].participant.isWinner : false,
        participantAName: realMatch.participant_a.label,
        participantBName: realMatch.participant_b.label,
        // Bug fix: previously only the bye branch set these, so the modal (which reads them
        // directly, not from `participants` below) showed no club/sub-label for any normal match.
        participantASubLabel: realMatch.participant_a.subLabel,
        participantBSubLabel: realMatch.participant_b.subLabel,
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
  // A row with no real participant yet - either a genuine "not decided" TBD slot, or the empty
  // side of a bye/walkover - reads as visually "empty, not broken" (dashed border, no fill, italic
  // label) instead of a normal solid match box. Distinguishing "no game needed" (Bye) from "not
  // decided yet" (TBD) matters: a wall of identical-looking half-filled boxes is exactly what
  // looked broken/cluttered for a bracket with many byes (7/9/12/13-participant brackets).
  const isTopEmpty = !topParty?.id
  const isBottomEmpty = !bottomParty?.id
  const emptyLabel = match.state === 'WALK_OVER' ? 'Bye' : 'TBD'
  const emptyRowStyle = {
    background: 'transparent',
    border: '1px dashed #3A4055',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <p style={{ color: '#707582', margin: '0 0 0.2rem', minHeight: '1.25rem', fontSize: '0.8rem' }}>{topText}</p>
        {match.href ? (
          <Dialog.Trigger asChild>
            <button
              type="button"
              // react-svg-pan-zoom (the pan/pinch-zoom library wrapping this whole tree) attaches
              // its own onTouchStart to the SVG root and calls preventDefault() unconditionally to
              // start a pan gesture on ANY touch inside the canvas - including a tap that lands on
              // this button, since it doesn't check the touch target. That both hijacks the tap
              // (the button's click never fires on a real touchscreen) and throws a benign but
              // noisy "Unable to preventDefault inside passive event listener" console warning.
              // Stopping propagation here keeps the touch from ever reaching that ancestor handler,
              // fixing both - pre-existing library behavior, not specific to this button's content.
              onTouchStart={(event) => event.stopPropagation()}
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
            ...(isTopEmpty ? emptyRowStyle : {}),
          }}
        >
          <div style={{ color: topColor, fontWeight: topWon ? 700 : 400, fontStyle: isTopEmpty ? 'italic' : 'normal', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isTopEmpty ? emptyLabel : topParty?.name}
            {!isTopEmpty && topParty?.subLabel ? (
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
            ...(isBottomEmpty ? emptyRowStyle : {}),
          }}
        >
          <div style={{ color: bottomColor, fontWeight: bottomWon ? 700 : 400, fontStyle: isBottomEmpty ? 'italic' : 'normal', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isBottomEmpty ? emptyLabel : bottomParty?.name}
            {!isBottomEmpty && bottomParty?.subLabel ? (
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

// MSG-01's Bronze Final (3rd place match) is fed by the two SEMIFINAL LOSERS, not by two
// round-N winners like every other match in the tree - splicing it into the same column flow
// g-loot renders (see withBronzeFinal in quickBracketGeneration.ts, and getRoundOrder in
// brackets.ts placing it between semifinal/final for the DB-backed cache) breaks g-loot's
// "every column exactly halves the previous one" assumption. Rendered here as its own detached
// card instead, matching how Challonge treats a 3rd place match: a separate box, not part of the
// championship column flow. `Loser of <match>` is shown in place of a bare "TBD" wherever the
// semifinal that feeds a slot hasn't been played yet - identical in spirit to Challonge's own
// "Loses from N" placeholder.
const ThirdPlaceCard = ({
  match,
  semifinalRound,
  timezone,
}: {
  match: BracketMatchCard
  semifinalRound?: BracketRound
  timezone: string
}) => {
  const selectMatch = React.useContext(BracketDialogContext)
  // Reuses the same per-match transform every other card goes through (bye detection, score
  // fallback, detail_href) instead of reimplementing it here - a single-match "round" is a valid
  // input since the function only ever looks at its own round's name/matches.
  const glootMatch = transformToGLootData([{ name: 'Bronze Final', order: 0, matches: [match] }], timezone)[0]
  const semifinalMatches = semifinalRound?.matches ?? []
  const rows: Array<{ participant: BracketParticipant; sourceIndex: 0 | 1; resultText?: string }> = [
    { participant: match.participant_a, sourceIndex: 0, resultText: glootMatch.participantAResultText },
    { participant: match.participant_b, sourceIndex: 1, resultText: glootMatch.participantBResultText },
  ]

  return (
    <div className="mt-4 rounded-panel border border-line bg-paper p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">3rd Place Match</p>
        {glootMatch.href ? (
          <Dialog.Trigger asChild>
            <button
              type="button"
              onClick={() => selectMatch(glootMatch)}
              className="text-xs font-semibold text-ink-soft transition-colors hover:text-ink"
            >
              Match Details
            </button>
          </Dialog.Trigger>
        ) : null}
      </div>
      <div className="max-w-xs overflow-hidden rounded-card border border-line">
        {rows.map(({ participant, sourceIndex, resultText }) => {
          const isEmpty = !participant.id
          const feederMatch = semifinalMatches[sourceIndex]
          const label = isEmpty
            ? feederMatch
              ? `Loser of ${feederMatch.match_number}`
              : 'TBD'
            : participant.label

          return (
            <div
              key={sourceIndex}
              className={cn(
                'flex items-center justify-between gap-2 px-3 py-2 text-sm',
                sourceIndex === 0 && 'border-b border-line',
                isEmpty ? 'italic text-ink-soft' : participant.isWinner ? 'bg-green/10 font-bold text-ink' : 'text-ink-soft',
              )}
            >
              <span className="truncate">{label}</span>
              {!isEmpty && resultText ? (
                <span
                  className={cn(
                    'shrink-0 tabular-nums',
                    participant.isWinner ? 'font-bold text-ink' : 'text-ink-soft',
                  )}
                >
                  {resultText}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

type MatchDetailTab = 'schedule' | 'venue' | 'score'

const MATCH_DETAIL_TABS: Array<{ key: MatchDetailTab; label: string; icon: typeof Calendar }> = [
  { key: 'schedule', label: 'Schedule', icon: Calendar },
  { key: 'venue', label: 'Venue', icon: MapPin },
  { key: 'score', label: 'Score', icon: Trophy },
]

// A numeric-looking resultText ("21", "0") is safe to drop straight into a score input; a
// non-numeric one ("WO") isn't a score to edit, so the input starts blank instead.
const prefillScore = (resultText: string | null | undefined) =>
  resultText && !Number.isNaN(Number(resultText)) ? resultText : ''

// The modal's content, split from BracketTree itself because it now carries real form state
// (selected tab, in-progress score text) that must reset when a different match is opened but
// persist while the *same* match's modal stays open across a save - the parent renders this with
// `key={match.id}` so a match switch remounts it (fresh tab/inputs) while an in-place score update
// doesn't (keeps whatever tab the organizer was on).
const MatchDetailsPanel = ({
  match,
  isFinished,
  isLive,
  hasScore,
  quickBracketSlug,
  timezone,
  onMatchChange,
}: {
  match: GLootMatch
  isFinished: boolean
  isLive: boolean
  hasScore: boolean
  quickBracketSlug?: string
  timezone: string
  onMatchChange: (next: GLootMatch) => void
}) => {
  const router = useRouter()
  const [tab, setTab] = useState<MatchDetailTab>('score')
  const [scoreA, setScoreA] = useState(() => prefillScore(match.participantAResultText))
  const [scoreB, setScoreB] = useState(() => prefillScore(match.participantBResultText))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scheduleValue, setScheduleValue] = useState(() => toDateTimeLocalValue(match.scheduledStartAtRaw))
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [venueValue, setVenueValue] = useState(() => match.venueLabel ?? '')
  const [savingVenue, setSavingVenue] = useState(false)
  const [venueError, setVenueError] = useState<string | null>(null)

  // Presence of quickBracketSlug alone gates Schedule/Venue editing - unlike scoring (below), a
  // time or venue can be set on a match before both sides are even known.
  const isEditor = Boolean(quickBracketSlug)

  // Only a match with two real, non-walkover sides can ever be scored - a still-TBD side (or the
  // auto-decided winner of a bye) has nothing to declare a winner over.
  const bothSidesReal =
    Boolean(match.participantAName) &&
    match.participantAName !== 'TBD' &&
    Boolean(match.participantBName) &&
    match.participantBName !== 'TBD' &&
    match.state !== 'WALK_OVER'
  const canEditScore = isEditor && bothSidesReal

  const handleSave = async (winnerSlot: 'a' | 'b') => {
    if (!quickBracketSlug) return
    setSaving(true)
    setError(null)
    const result = await updateQuickBracketMatchAction(quickBracketSlug, String(match.id), winnerSlot, scoreA, scoreB)
    setSaving(false)
    if (!result.ok) {
      setError(result.reason)
      return
    }
    // Optimistic local update so the modal reflects the save immediately - router.refresh() below
    // still catches up the bracket tree (and whatever downstream match this one feeds) behind it.
    onMatchChange({
      ...match,
      state: 'result_published',
      participantAResultText: scoreA || match.participantAResultText,
      participantBResultText: scoreB || match.participantBResultText,
      participantAIsWinner: winnerSlot === 'a',
      participantBIsWinner: winnerSlot === 'b',
    })
    router.refresh()
  }

  const handleCancelScore = () => {
    setScoreA(prefillScore(match.participantAResultText))
    setScoreB(prefillScore(match.participantBResultText))
    setError(null)
  }

  const handleSaveSchedule = async () => {
    if (!quickBracketSlug) return
    setSavingSchedule(true)
    setScheduleError(null)
    const iso = fromDateTimeLocalValue(scheduleValue)
    const result = await updateQuickBracketMatchScheduleAction(quickBracketSlug, String(match.id), {
      scheduledStartAt: iso,
    })
    setSavingSchedule(false)
    if (!result.ok) {
      setScheduleError(result.reason)
      return
    }
    onMatchChange({
      ...match,
      startTime: iso ? formatMatchDate(iso, timezone) : '',
      scheduledStartAtRaw: iso ?? undefined,
    })
    router.refresh()
  }

  const handleCancelSchedule = () => {
    setScheduleValue(toDateTimeLocalValue(match.scheduledStartAtRaw))
    setScheduleError(null)
  }

  const handleSaveVenue = async () => {
    if (!quickBracketSlug) return
    setSavingVenue(true)
    setVenueError(null)
    const trimmed = venueValue.trim()
    const result = await updateQuickBracketMatchScheduleAction(quickBracketSlug, String(match.id), {
      venueLabel: trimmed || null,
    })
    setSavingVenue(false)
    if (!result.ok) {
      setVenueError(result.reason)
      return
    }
    onMatchChange({ ...match, venueLabel: trimmed || undefined })
    router.refresh()
  }

  const handleCancelVenue = () => {
    setVenueValue(match.venueLabel ?? '')
    setVenueError(null)
  }

  return (
    <>
      {match.roundName ? (
        <p className="-mt-2 text-xs font-bold tracking-wide text-ink-soft uppercase">{match.roundName}</p>
      ) : null}

      <div className="flex border-b border-line" role="tablist">
        {MATCH_DETAIL_TABS.map((item) => {
          const Icon = item.icon
          const isActive = tab === item.key
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(item.key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-xs font-bold transition-colors',
                isActive
                  ? 'border-brand-primary text-ink'
                  : 'border-transparent text-ink-soft hover:border-line hover:text-ink',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.label}
            </button>
          )
        })}
      </div>

      {tab === 'schedule' ? (
        <div className="rounded-card bg-mist px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                {isFinished ? 'Result' : isLive ? 'Live now' : 'Status'}
              </p>
              <StatusBadge tone={getMatchStatusTone(match.state)} className="mt-1">
                {match.state.replaceAll('_', ' ')}
              </StatusBadge>
            </div>
            {!isEditor && match.startTime ? (
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  {isFinished ? 'Played' : 'Scheduled'}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">{match.startTime}</p>
              </div>
            ) : null}
          </div>
          {!isEditor && !match.startTime ? <p className="mt-3 text-xs text-ink-soft">Not scheduled yet.</p> : null}
          {isEditor ? (
            <div className="mt-3">
              <label htmlFor="qb-schedule-input" className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Match time
              </label>
              <input
                id="qb-schedule-input"
                type="datetime-local"
                value={scheduleValue}
                onChange={(event) => setScheduleValue(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-card border border-line bg-paper px-3 text-sm text-ink focus-visible:border-green focus-visible:outline-none"
              />
              {scheduleError ? <p className="mt-2 text-xs font-semibold text-danger">{scheduleError}</p> : null}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule}
                  className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}
                >
                  {savingSchedule ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelSchedule}
                  disabled={savingSchedule}
                  className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'venue' ? (
        <div className="rounded-card bg-mist px-4 py-4">
          {!isEditor ? (
            match.venueLabel ? (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Venue</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-ink">{match.venueLabel}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-soft">No venue assigned yet.</p>
            )
          ) : (
            <div>
              <label htmlFor="qb-venue-input" className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Venue
              </label>
              <input
                id="qb-venue-input"
                type="text"
                value={venueValue}
                onChange={(event) => setVenueValue(event.target.value)}
                placeholder="e.g. Court 2, Main Hall"
                maxLength={120}
                className="mt-1.5 h-10 w-full rounded-card border border-line bg-paper px-3 text-sm text-ink focus-visible:border-green focus-visible:outline-none"
              />
              {venueError ? <p className="mt-2 text-xs font-semibold text-danger">{venueError}</p> : null}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveVenue}
                  disabled={savingVenue}
                  className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}
                >
                  {savingVenue ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelVenue}
                  disabled={savingVenue}
                  className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'score' ? (
        <div className="rounded-card bg-mist px-4 py-4">
          {canEditScore ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleSave('a')}
                  disabled={saving}
                  className={cn(
                    'min-w-0 flex-1 truncate rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50',
                    match.participantAIsWinner
                      ? 'border-green bg-green/10 text-ink'
                      : 'border-line text-ink hover:border-green',
                  )}
                >
                  {match.participantAName}
                </button>
                <input
                  value={scoreA}
                  onChange={(event) => setScoreA(event.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="h-9 w-14 shrink-0 rounded-full border border-line bg-paper px-2 text-center text-sm text-ink focus-visible:border-green focus-visible:outline-none"
                />
                <span className="shrink-0 text-xs font-semibold text-ink-soft">vs</span>
                <input
                  value={scoreB}
                  onChange={(event) => setScoreB(event.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="h-9 w-14 shrink-0 rounded-full border border-line bg-paper px-2 text-center text-sm text-ink focus-visible:border-green focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSave('b')}
                  disabled={saving}
                  className={cn(
                    'min-w-0 flex-1 truncate rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50',
                    match.participantBIsWinner
                      ? 'border-green bg-green/10 text-ink'
                      : 'border-line text-ink hover:border-green',
                  )}
                >
                  {match.participantBName}
                </button>
              </div>
              {error ? <p className="mt-2 text-xs font-semibold text-danger">{error}</p> : null}
              {saving ? (
                <p className="mt-2 text-xs text-ink-soft">Saving...</p>
              ) : match.state === 'result_published' ? (
                <p className="mt-2 text-xs font-bold text-green">Saved</p>
              ) : (
                <p className="mt-2 text-xs text-ink-soft">Click a team&apos;s name to record it as the winner.</p>
              )}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleCancelScore}
                  disabled={saving}
                  className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-sm',
                      match.participantAIsWinner ? 'font-extrabold text-ink' : 'font-semibold text-ink-soft',
                    )}
                  >
                    {match.participantAName || 'TBD'}
                  </p>
                  {match.participantASubLabel ? (
                    <p className="truncate text-xs text-ink-soft">{match.participantASubLabel}</p>
                  ) : null}
                </div>
                <div className="shrink-0 px-2 text-center">
                  {hasScore ? (
                    <span className="text-xl font-extrabold tabular-nums text-ink">
                      {match.participantAResultText || '–'}
                      <span className="mx-1.5 text-ink-soft">-</span>
                      {match.participantBResultText || '–'}
                    </span>
                  ) : (
                    <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-ink-soft uppercase">
                      vs
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <p
                    className={cn(
                      'truncate text-sm',
                      match.participantBIsWinner ? 'font-extrabold text-ink' : 'font-semibold text-ink-soft',
                    )}
                  >
                    {match.participantBName || 'TBD'}
                  </p>
                  {match.participantBSubLabel ? (
                    <p className="truncate text-xs text-ink-soft">{match.participantBSubLabel}</p>
                  ) : null}
                </div>
              </div>
              {/* Set-by-set breakdown only earns its place when there's more than one set - with
                  exactly one set, the aggregate score above already says the same thing. Each set
                  gets its own chip with the set-winner's score bolded, matching the public match
                  page. */}
              {match.setScoreText && match.setScoreText.split(',').length > 1 ? (
                <div className="mt-3 flex flex-wrap justify-center gap-2 border-t border-line pt-3">
                  {match.setScoreText.split(',').map((set, index) => {
                    const [rawA, rawB] = set.trim().split('-')
                    const aScore = Number(rawA?.trim())
                    const bScore = Number(rawB?.trim())
                    const hasScores = !Number.isNaN(aScore) && !Number.isNaN(bScore)
                    const aWonSet = hasScores && aScore > bScore
                    const bWonSet = hasScores && bScore > aScore
                    return (
                      <div
                        key={index}
                        className="flex min-w-[4.25rem] flex-col items-center gap-0.5 rounded-card border border-line bg-paper px-3 py-1.5"
                      >
                        <span className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-soft/70">
                          Set {index + 1}
                        </span>
                        {hasScores ? (
                          <span className="text-sm font-extrabold tabular-nums">
                            <span className={aWonSet ? 'text-ink' : 'text-ink-soft'}>{rawA.trim()}</span>
                            <span className="mx-1 text-ink-soft/50">–</span>
                            <span className={bWonSet ? 'text-ink' : 'text-ink-soft'}>{rawB.trim()}</span>
                          </span>
                        ) : (
                          <span className="text-sm font-extrabold tabular-nums text-ink">{set.trim()}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : null}
              {!hasScore && !match.startTime ? (
                <p className="mt-3 text-center text-xs text-ink-soft">
                  Scores will appear here once the match begins.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* Real matches are only ever edited from the Match Officer / Scheduler workspace (a single
          authorized mutation path per AUDIT_E2E MAT-01/PUB-03), so this link is the only way out
          of the modal for them. Quick Bracket Tournament matches open this same modal (their
          detail_href is a non-'/' sentinel so the trigger button above still shows) but have no
          real page to link to - checking for a real path here (rather than bare truthiness) keeps
          that case correctly showing the fallback line instead of a broken link. */}
      {match.href?.startsWith('/') ? (
        <Link href={match.href} className={cn(buttonVariants({ variant: 'primary' }), 'w-full')}>
          View match details
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <p className="text-sm text-ink-soft">This match does not have a public page yet.</p>
      )}
    </>
  )
}

export const BracketTree = ({
  rounds,
  champion,
  timezone = DEFAULT_EVENT_TIMEZONE,
  quickBracketSlug,
}: {
  rounds: BracketRound[]
  champion?: BracketChampion | null
  timezone?: string
  // Presence alone enables the Match Details modal's Score tab as an editable score-entry form
  // (calling updateQuickBracketMatchAction directly) instead of a read-only summary - only ever
  // passed by the Quick Bracket result page, and only while the viewer is a signed-in editor.
  quickBracketSlug?: string
}) => {
  const [isMounted, setIsMounted] = useState(false)
  const [containerRef, containerWidth] = useContainerWidth()
  const [selectedMatch, setSelectedMatch] = useState<GLootMatch | null>(null)
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (rounds.length === 0) {
    return null
  }

  const bronzeRoundIndex = rounds.findIndex((round) => round.name.toLowerCase().includes('bronze'))
  const bronzeRound = bronzeRoundIndex >= 0 ? rounds[bronzeRoundIndex] : null
  const mainRounds = bronzeRound ? rounds.filter((_, index) => index !== bronzeRoundIndex) : rounds

  const displayRounds = normalizeBracketRounds(mainRounds)
  const roundNamesByColumn = displayRounds.map((round) => round.name)
  const semifinalRound = displayRounds[displayRounds.length - 2]

  const matches = transformToGLootData(displayRounds, timezone)
  const isFinished = Boolean(selectedMatch && RESULT_STATUSES.has(selectedMatch.state))
  const isLive = Boolean(selectedMatch && LIVE_STATUSES.has(selectedMatch.state))
  const hasScore = Boolean(
    selectedMatch?.participantAResultText || selectedMatch?.participantBResultText,
  )

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
              <MatchDetailsPanel
                key={selectedMatch.id}
                match={selectedMatch}
                isFinished={isFinished}
                isLive={isLive}
                hasScore={hasScore}
                quickBracketSlug={quickBracketSlug}
                timezone={timezone}
                onMatchChange={setSelectedMatch}
              />
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      {displayRounds.length > 1 ? (
        <div className="mb-3 flex items-center justify-end gap-2">
          <label htmlFor="bracket-round-jump" className="text-xs font-semibold text-ink-soft">
            Jump to round
          </label>
          <select
            id="bracket-round-jump"
            value={selectedRoundIndex}
            onChange={(event) => setSelectedRoundIndex(Number(event.target.value))}
            className="h-8 rounded-full border border-line bg-paper px-3 text-xs font-semibold text-ink focus-visible:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/20"
          >
            {displayRounds.map((round, index) => (
              <option key={`${round.name}-${index}`} value={index}>
                {round.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div ref={containerRef} className="overflow-hidden rounded-panel border border-line">
        {isMounted && containerWidth > 0 ? (
          <SingleEliminationBracket
            // Forces SVGViewer (g-loot's pan/zoom wrapper) to remount when the selected round
            // changes - its initial-pan effect only ever runs once per mount (see
            // node_modules/@g-loot/react-tournament-brackets's svg-viewer.js), so a plain prop
            // change on an already-mounted instance would silently do nothing.
            key={selectedRoundIndex}
            matches={matches}
            matchComponent={CustomMatch}
            currentRound={String(selectedRoundIndex)}
            options={{
              style: {
                roundHeader: {
                  // Overrides g-loot's own default header text ("Round 1" / "Semi-final" /
                  // "Final", hardcoded by column position) with the names this app actually
                  // computes (Round of 16 / Quarterfinal / Semifinal / Final - see
                  // roundNameForRemaining in matchGeneration.ts). columnIndex here is 1-based.
                  roundTextGenerator: (columnIndex: number) =>
                    roundNamesByColumn[columnIndex - 1] || `Round ${columnIndex}`,
                },
              },
            }}
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
      {bronzeRound?.matches[0] ? (
        <ThirdPlaceCard match={bronzeRound.matches[0]} semifinalRound={semifinalRound} timezone={timezone} />
      ) : null}
    </div>
    </BracketDialogContext.Provider>
    </Dialog.Root>
  )
}
