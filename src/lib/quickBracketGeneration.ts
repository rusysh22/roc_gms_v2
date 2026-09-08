import {
  type BracketMatchCard,
  type BracketParticipant,
  type BracketRound,
  type SingleEliminationBracketData,
  detectSingleEliminationChampion,
} from './brackets'
import {
  type DoubleEliminationBracketData,
  buildLosersBracketPlan,
  detectDoubleEliminationChampion,
  isExactPowerOfTwo,
} from './doubleElimination'
import {
  type MatchGenerationEntry,
  buildSingleEliminationBracketPlan,
  getNextPowerOfTwo,
  roundNameForRemaining,
  roundPrefixForRemaining,
} from './matchGeneration'

// Quick Bracket Tournament (prd/design/QUICK_BRACKET_TOURNAMENT_DESIGN.md) generates a bracket
// entirely in memory, once, at submit time - no `matches`/`stages`/`competition-entries` rows are
// ever created. This module reuses the same pure planning functions the authenticated wizard uses
// (buildSingleEliminationBracketPlan, buildLosersBracketPlan, the champion-detection rules) but
// skips straight from a plan to the BracketTree-ready BracketRound[]/BracketMatchCard[] shape,
// instead of going through the Payload-writing wrappers in matchGeneration.ts/doubleElimination.ts
// (createSingleEliminationBracketMatches/createDoubleEliminationBracketMatches), which require a
// real event/category/stage and write real database rows - the wrong tool for an anonymous,
// read-only, never-played bracket preview.

export const QUICK_BRACKET_MIN_PARTICIPANTS = 2
export const QUICK_BRACKET_MAX_PARTICIPANTS = 64

const blankParticipant = (): BracketParticipant => ({
  label: 'TBD',
  isWinner: false,
  isPlaceholder: true,
})

const participantFromEntry = (
  entry: MatchGenerationEntry | null,
  winnerId?: string | number,
): BracketParticipant => {
  if (!entry) {
    return blankParticipant()
  }
  return {
    id: entry.id,
    label: entry.display_name,
    seed: entry.seed_number ?? undefined,
    isWinner: winnerId !== undefined && String(entry.id) === String(winnerId),
    isPlaceholder: false,
  }
}

// No real `/matches/[matchNumber]` page exists for a guest bracket's matches - a non-'/' sentinel
// (rather than an empty string) still unlocks BracketTree's "Match Details" trigger button and
// details modal (both matter now that matches carry real winners/scores from live editing), while
// the modal's own "View match details" external-link section checks for a leading '/' and falls
// back to "This match does not have a public page yet." instead of navigating anywhere broken.
// Exported so quickBracketAdvancement.ts's fillSlot can set the same sentinel once a previously
// blank downstream match (Final, a losers-bracket slot, ...) receives its first real participant.
export const QUICK_BRACKET_DETAIL_HREF = 'quick-bracket-match'

const buildMatchCard = ({
  id,
  matchNumber,
  roundName,
  participantA,
  participantB,
  isBye,
}: {
  id: string
  matchNumber: string
  roundName: string
  participantA: BracketParticipant
  participantB: BracketParticipant
  isBye: boolean
}): BracketMatchCard => ({
  id,
  match_number: matchNumber,
  round_name: roundName,
  // Only worth a details modal once at least one side is real - a fully TBD-vs-TBD slot (a blank
  // bracket, or a round not reached yet) has nothing to show, so it keeps the empty href that
  // suppresses BracketTree's "Match Details" trigger entirely.
  detail_href: participantA.id || participantB.id ? QUICK_BRACKET_DETAIL_HREF : '',
  status: isBye ? 'walkover' : 'ready_for_scheduling',
  winner_entry_id: isBye ? (participantA.isWinner ? participantA.id : participantB.id) : undefined,
  score_summary: isBye ? 'Bye' : undefined,
  participant_a: participantA,
  participant_b: participantB,
})

// Real participants (from the "use the number of participants provided below" mode) via the same
// standard-seed-placement plan the authenticated wizard uses - byes are handled identically
// (spread across quarters, auto-resolved as a walkover) since buildSingleEliminationBracketPlan
// already solves that.
const buildEliminationRoundsFromEntries = (
  entries: MatchGenerationEntry[],
  { namePrefix = '', idPrefix = '' }: { namePrefix?: string; idPrefix?: string } = {},
): BracketRound[] => {
  const bracketSize = getNextPowerOfTwo(entries.length)
  const totalRounds = Math.log2(bracketSize)
  const plan = buildSingleEliminationBracketPlan(entries)
  const rounds: BracketRound[] = []

  for (let round = 0; round < totalRounds; round += 1) {
    const roundsRemaining = totalRounds - 1 - round
    const roundName = `${namePrefix}${roundNameForRemaining(roundsRemaining)}`
    const roundPrefix = `${idPrefix}${roundPrefixForRemaining(roundsRemaining)}`
    const roundPlans = plan
      .filter((matchPlan) => matchPlan.round === round)
      .sort((left, right) => left.matchIndex - right.matchIndex)

    const matches = roundPlans.map((matchPlan) => {
      const byeWinnerId = matchPlan.isBye
        ? (matchPlan.participantA ?? matchPlan.participantB)?.id
        : undefined
      return buildMatchCard({
        id: `${roundPrefix}-${matchPlan.matchIndex}`,
        matchNumber: `${roundPrefix.toUpperCase()}${matchPlan.matchIndex + 1}`,
        roundName,
        participantA: participantFromEntry(matchPlan.participantA, byeWinnerId),
        participantB: participantFromEntry(matchPlan.participantB, byeWinnerId),
        isBye: matchPlan.isBye,
      })
    })

    rounds.push({ name: roundName, order: round, matches })
  }

  return rounds
}

// Blank preview bracket (the "enter a number and generate a blank bracket" mode) - every slot is
// TBD, purely structural. No bye concept applies since there are no real entries to be short of.
const buildBlankEliminationRounds = (
  bracketSize: number,
  { namePrefix = '', idPrefix = '' }: { namePrefix?: string; idPrefix?: string } = {},
): BracketRound[] => {
  const totalRounds = Math.log2(bracketSize)
  const rounds: BracketRound[] = []

  for (let round = 0; round < totalRounds; round += 1) {
    const roundsRemaining = totalRounds - 1 - round
    const roundName = `${namePrefix}${roundNameForRemaining(roundsRemaining)}`
    const roundPrefix = `${idPrefix}${roundPrefixForRemaining(roundsRemaining)}`
    const matchCount = bracketSize / 2 ** (round + 1)

    const matches = Array.from({ length: matchCount }, (_, matchIndex) =>
      buildMatchCard({
        id: `${roundPrefix}-${matchIndex}`,
        matchNumber: `${roundPrefix.toUpperCase()}${matchIndex + 1}`,
        roundName,
        participantA: blankParticipant(),
        participantB: blankParticipant(),
        isBye: false,
      }),
    )

    rounds.push({ name: roundName, order: round, matches })
  }

  return rounds
}

// Losers-bracket rounds are always 100% TBD in Quick Bracket - real losers-bracket participants
// only ever exist once a winners-bracket match is actually played, which never happens here.
// buildLosersBracketPlan is purely structural (round/match counts, not participants), so this is
// the same shape regardless of whether the winners bracket used real names or a blank preview.
const buildBlankLosersRounds = (winnersRounds: number): BracketRound[] => {
  const lbPlan = buildLosersBracketPlan(winnersRounds)
  const totalLoserRounds = lbPlan.length > 0 ? Math.max(...lbPlan.map((plan) => plan.round)) + 1 : 0
  const rounds: BracketRound[] = []

  for (let round = 0; round < totalLoserRounds; round += 1) {
    const roundsRemaining = totalLoserRounds - 1 - round
    const roundName = roundsRemaining === 0 ? 'Losers Final' : `Losers Round ${round + 1}`
    const roundPrefix = roundsRemaining === 0 ? 'lfinal' : `l${round + 1}`
    const roundMatchCount = lbPlan.filter((plan) => plan.round === round).length

    const matches = Array.from({ length: roundMatchCount }, (_, matchIndex) =>
      buildMatchCard({
        id: `${roundPrefix}-${matchIndex}`,
        matchNumber: `${roundPrefix.toUpperCase()}${matchIndex + 1}`,
        roundName,
        participantA: blankParticipant(),
        participantB: blankParticipant(),
        isBye: false,
      }),
    )

    rounds.push({ name: roundName, order: round, matches })
  }

  return rounds
}

export type QuickBracketSource =
  | { mode: 'from_participants'; entries: MatchGenerationEntry[] }
  | { mode: 'manual_size'; bracketSize: number }

export const resolveQuickBracketSize = (source: QuickBracketSource): number =>
  source.mode === 'from_participants'
    ? getNextPowerOfTwo(source.entries.length)
    : getNextPowerOfTwo(source.bracketSize)

// MSG-01's Bronze Final, reproduced without a real semifinal match to route losers into (there is
// none - nothing here is ever played) - spliced in between Semifinal and Final, matching where the
// authenticated bracket cache places it (brackets.ts's getRoundOrder: bronze=45, between
// semifinal=40 and final=50).
const withBronzeFinal = (rounds: BracketRound[]): BracketRound[] => {
  if (rounds.length < 2) {
    return rounds
  }
  const bronzeRound: BracketRound = {
    name: 'Bronze Final',
    order: rounds.length - 1,
    matches: [
      buildMatchCard({
        id: 'bronze',
        matchNumber: 'BRONZE',
        roundName: 'Bronze Final',
        participantA: blankParticipant(),
        participantB: blankParticipant(),
        isBye: false,
      }),
    ],
  }
  const withBronze = [...rounds]
  withBronze.splice(withBronze.length - 1, 0, bronzeRound)
  return withBronze
}

export const buildQuickSingleEliminationBracket = (
  source: QuickBracketSource,
  { thirdPlace }: { thirdPlace: boolean },
): SingleEliminationBracketData => {
  const bracketSize = resolveQuickBracketSize(source)
  let rounds =
    source.mode === 'from_participants'
      ? buildEliminationRoundsFromEntries(source.entries)
      : buildBlankEliminationRounds(bracketSize)

  if (thirdPlace) {
    rounds = withBronzeFinal(rounds)
  }

  return {
    format: 'single_elimination',
    rounds,
    champion: detectSingleEliminationChampion(rounds),
    generated_at: new Date().toISOString(),
  }
}

export const buildQuickDoubleEliminationBracket = (
  source: QuickBracketSource,
): DoubleEliminationBracketData => {
  const bracketSize = resolveQuickBracketSize(source)
  const totalWinnersRounds = Math.log2(bracketSize)

  const winnersRounds =
    source.mode === 'from_participants'
      ? buildEliminationRoundsFromEntries(source.entries, { namePrefix: 'Winners ', idPrefix: 'w' })
      : buildBlankEliminationRounds(bracketSize, { namePrefix: 'Winners ', idPrefix: 'w' })
  const losersRounds = buildBlankLosersRounds(totalWinnersRounds)
  const grandFinal = buildMatchCard({
    id: 'grand-final',
    matchNumber: 'GF',
    roundName: 'Grand Final',
    participantA: blankParticipant(),
    participantB: blankParticipant(),
    isBye: false,
  })

  return {
    format: 'double_elimination',
    winners_rounds: winnersRounds,
    losers_rounds: losersRounds,
    grand_final: grandFinal,
    grand_final_reset: null,
    champion: detectDoubleEliminationChampion(grandFinal, null),
    generated_at: new Date().toISOString(),
  }
}

export { isExactPowerOfTwo, getNextPowerOfTwo }
