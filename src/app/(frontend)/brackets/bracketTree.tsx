import Link from 'next/link'
import { Crown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { StatusBadge, getMatchStatusTone } from '@/components/ui/status-badge'
import type { BracketChampion, BracketMatchCard, BracketRound } from '@/lib/brackets'
import { formatStatus } from '../workspaces/workspaceComponents'
import { MobileRoundIndicator } from './mobile-round-indicator'

const GAP_PX = 48
const NODE_WIDTH = 'min(260px, 82vw)'

// The bracket cache (src/lib/brackets.ts) sorts matches within a round by match_number but has no
// explicit parent/child edges (see decision-log D016/D018). Assuming a perfect binary bracket
// (round r+1 match i is fed by round r matches 2i and 2i+1) is the same assumption the winner
// advancement module already makes - reused here purely for layout math, not for any mutation.
const parseSetsWon = (setScore?: string): [number, number] | null => {
  if (!setScore) {
    return null
  }

  let a = 0
  let b = 0
  for (const set of setScore.split(',')) {
    const [rawA, rawB] = set.trim().split('-').map((value) => Number(value.trim()))
    if (Number.isNaN(rawA) || Number.isNaN(rawB)) {
      continue
    }
    if (rawA > rawB) a += 1
    else if (rawB > rawA) b += 1
  }

  return a === 0 && b === 0 ? null : [a, b]
}

// Champion path is derived from participant identity (who actually won which match), not from
// round-order/index assumptions - this part is exact, not approximate, given the data available.
const getChampionMatchIds = (
  rounds: BracketRound[],
  champion?: BracketChampion | null,
): Set<string> => {
  const ids = new Set<string>()
  if (!champion || champion.status !== 'decided' || champion.entry_id === undefined) {
    return ids
  }

  const championId = String(champion.entry_id)
  for (const round of rounds) {
    for (const match of round.matches) {
      const aIsChampion =
        match.participant_a.isWinner && String(match.participant_a.id ?? '') === championId
      const bIsChampion =
        match.participant_b.isWinner && String(match.participant_b.id ?? '') === championId
      if (aIsChampion || bIsChampion) {
        ids.add(String(match.id))
      }
    }
  }

  return ids
}

const ParticipantRow = ({
  participant,
  score,
}: {
  participant: BracketMatchCard['participant_a']
  score?: number
}) => {
  if (participant.isPlaceholder) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-dashed border-line px-2 py-1.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-[0.6rem] text-ink-soft">
          ?
        </span>
        <span className="text-sm italic text-ink-soft">TBD</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-full border px-2 py-1.5',
        participant.isWinner ? 'border-green bg-mist' : 'border-line bg-paper',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold tabular-nums',
            participant.isWinner ? 'bg-green text-paper' : 'bg-mist text-ink-soft',
          )}
        >
          {participant.seed ?? '-'}
        </span>
        <span
          className={cn(
            'truncate text-sm',
            participant.isWinner ? 'font-bold text-ink' : 'text-ink-soft',
          )}
        >
          {participant.label}
        </span>
      </span>
      {score !== undefined ? (
        <span
          className={cn(
            'shrink-0 text-sm tabular-nums',
            participant.isWinner ? 'font-bold text-ink' : 'text-ink-soft',
          )}
        >
          {score}
        </span>
      ) : null}
    </div>
  )
}

const Connector = ({ championPath }: { championPath: boolean }) => (
  <div
    aria-hidden="true"
    className={cn(
      'absolute top-1/4 h-1/2 border-t border-b border-r',
      championPath ? 'border-green border-2' : 'border-line',
    )}
    style={{ left: -GAP_PX, width: GAP_PX }}
  />
)

const TerminalConnector = ({ championPath }: { championPath: boolean }) => (
  <div
    aria-hidden="true"
    className={cn('absolute top-1/2 border-t', championPath ? 'border-green border-2' : 'border-line')}
    style={{ left: -GAP_PX, width: GAP_PX }}
  />
)

const BracketNode = ({
  match,
  championPath,
  hasIncomingConnector,
}: {
  match: BracketMatchCard
  championPath: boolean
  hasIncomingConnector: boolean
}) => {
  const setsWon = parseSetsWon(match.set_score)

  return (
    <div className="relative flex h-full items-center">
      {hasIncomingConnector ? <Connector championPath={championPath} /> : null}
      <Link
        href={match.detail_href}
        className={cn(
          'block shrink-0 rounded-card border bg-paper p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-green',
          championPath ? 'border-green' : 'border-line',
        )}
        style={{ width: NODE_WIDTH }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate font-sans text-xs font-bold text-ink-soft">
            {match.match_number}
          </span>
          <StatusBadge tone={getMatchStatusTone(match.status)}>
            {formatStatus(match.status)}
          </StatusBadge>
        </div>
        <div className="flex flex-col gap-1.5">
          <ParticipantRow participant={match.participant_a} score={setsWon?.[0]} />
          <ParticipantRow participant={match.participant_b} score={setsWon?.[1]} />
        </div>
      </Link>
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
  if (rounds.length === 0) {
    return null
  }

  const leafCount = Math.max(rounds[0].matches.length, 1)
  const totalRows = leafCount * 2
  const championMatchIds = getChampionMatchIds(rounds, champion)
  const finalRound = rounds[rounds.length - 1]
  const finalMatch = finalRound.matches[0]
  const columnCount = rounds.length + (finalMatch ? 1 : 0)
  const gridTemplateColumns = `repeat(${columnCount}, ${NODE_WIDTH})`

  const allRounds = [...rounds.map((r) => r.name)]
  if (finalMatch) allRounds.push('Champion')

  return (
    <div className="relative">
      <MobileRoundIndicator rounds={allRounds} />
      <div id="bracket-scroll-container" className="overflow-x-auto pb-4 [scrollbar-gutter:stable] snap-x snap-mandatory">
        <div
          className="sticky top-20 z-30 mb-3 grid gap-x-12 bg-paper/95 py-2 backdrop-blur"
          style={{ gridTemplateColumns }}
        >
          {rounds.map((round, index) => (
            <p
              key={round.name}
              data-round-index={index}
              className="bracket-round-header snap-start truncate text-xs font-bold uppercase tracking-wide text-ink-soft"
            >
              {round.name}
            </p>
          ))}
          {finalMatch ? (
            <p
              data-round-index={rounds.length}
              className="bracket-round-header snap-start truncate text-xs font-bold uppercase tracking-wide text-ink-soft"
            >
              Champion
            </p>
          ) : null}
        </div>

      <div
        className="grid gap-x-12"
        style={{
          gridTemplateColumns,
          gridTemplateRows: `repeat(${totalRows}, minmax(72px, auto))`,
        }}
      >
        {rounds.map((round, roundIndex) => {
          const rowSpan = Math.pow(2, roundIndex + 1)

          return round.matches.map((match, matchIndex) => {
            const rowStart = matchIndex * rowSpan + 1

            return (
              <div
                key={match.id}
                style={{
                  gridColumn: roundIndex + 1,
                  gridRow: `${rowStart} / span ${rowSpan}`,
                }}
              >
                <BracketNode
                  match={match}
                  championPath={championMatchIds.has(String(match.id))}
                  hasIncomingConnector={roundIndex > 0}
                />
              </div>
            )
          })
        })}

        {finalMatch ? (
          <div
            style={{
              gridColumn: columnCount,
              gridRow: `1 / span ${totalRows}`,
            }}
            className="relative flex h-full items-center"
          >
            <TerminalConnector championPath={champion?.status === 'decided'} />
            <div
              className={cn(
                'flex shrink-0 items-center gap-3 rounded-panel border p-4',
                champion?.status === 'decided' ?
                  'border-gold bg-paper shadow-md'
                : 'border-dashed border-line bg-paper',
              )}
              style={{ width: NODE_WIDTH }}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  champion?.status === 'decided' ? 'bg-gold text-paper' : 'bg-mist text-ink-soft',
                )}
              >
                <Crown className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Champion</p>
                {champion?.status === 'decided' ? (
                  <p className="truncate text-sm font-extrabold text-ink">{champion.label}</p>
                ) : (
                  <p
                    className="truncate text-sm font-semibold italic text-ink-soft"
                    title={champion?.reason}
                  >
                    Not decided yet
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      </div>
    </div>
  )
}
