import {
  type BracketChampion,
  type BracketMatchCard,
  type BracketParticipant,
  type BracketRound,
  type SingleEliminationBracketData,
  detectSingleEliminationChampion,
} from './brackets'
import { type DoubleEliminationBracketData, buildLosersBracketPlan } from './doubleElimination'

// Live scoring for a Quick Bracket Tournament (prd/design/QUICK_BRACKET_TOURNAMENT_DESIGN.md
// section 11) - a self-contained advancement engine that mirrors the rules in
// src/lib/winnerAdvancement.ts / attemptDoubleEliminationAdvancement (doubleElimination.ts) but
// operates directly on a `quick-brackets` row's own `bracket_data` JSON, in memory, with no
// `matches`/`stages`/`events` rows involved at all - there aren't any, by design, until (if ever)
// the bracket is upgraded into a real event.
//
// Known simplification vs. the full app: no result-reversal/cascade-undo (recording a different
// winner for an already-decided match just overwrites forward - it does not walk back and clear
// anything already advanced from the old winner, unlike matchLifecycle.ts's guarded reversal). A
// quick bracket is meant to be corrected by re-clicking the right winner, not audited like a real
// event's match history.

export type QuickMatchResultInput = {
  matchId: string
  winnerSlot: 'a' | 'b'
  scoreSummary?: string
}

export type QuickMatchResultOutcome<T> = { data: T; error?: string }

const cloneParticipant = (participant: BracketParticipant): BracketParticipant => ({ ...participant })
const cloneMatch = (match: BracketMatchCard): BracketMatchCard => ({
  ...match,
  participant_a: cloneParticipant(match.participant_a),
  participant_b: cloneParticipant(match.participant_b),
})
const cloneRound = (round: BracketRound): BracketRound => ({
  ...round,
  matches: round.matches.map(cloneMatch),
})

const applyResult = (
  match: BracketMatchCard,
  winnerSlot: 'a' | 'b',
  scoreSummary?: string,
): { winner: BracketParticipant; loser: BracketParticipant } | null => {
  const winner = winnerSlot === 'a' ? match.participant_a : match.participant_b
  const loser = winnerSlot === 'a' ? match.participant_b : match.participant_a
  if (!winner.id) {
    return null
  }
  match.status = 'result_published'
  match.winner_entry_id = winner.id
  match.score_summary = scoreSummary
  match.participant_a.isWinner = String(match.participant_a.id ?? '') === String(winner.id)
  match.participant_b.isWinner = String(match.participant_b.id ?? '') === String(winner.id)
  return { winner, loser }
}

const PUBLISHED_RESULT_STATUSES = new Set(['result_published', 'walkover'])

// doubleElimination.ts's own detectDoubleEliminationChampion assumes a bracket-reset match exists
// (a losers-bracket finalist winning the grand final only reports 'pending, activating the
// reset' - the champion isn't decided until the reset match resolves). Quick Bracket deliberately
// never generates a grand_final_reset (see quickBracketGeneration.ts), so reusing that function
// here would leave the champion stuck on 'pending' forever whenever the losers-bracket side wins.
// This is the quick-bracket-specific rule instead: whichever side wins the grand final is
// champion outright, no reset - an accepted simplification for a quick, no-login tool.
const detectQuickDoubleEliminationChampion = (grandFinal: BracketMatchCard | null): BracketChampion => {
  if (!grandFinal) {
    return { status: 'pending', reason: 'The grand final has not been generated yet.' }
  }
  if (!PUBLISHED_RESULT_STATUSES.has(grandFinal.status)) {
    return {
      status: 'pending',
      match_id: grandFinal.id,
      match_number: grandFinal.match_number,
      round_name: 'Grand Final',
      reason: 'Champion is pending until the grand final result is published.',
    }
  }
  const winner = grandFinal.participant_a.isWinner
    ? grandFinal.participant_a
    : grandFinal.participant_b.isWinner
      ? grandFinal.participant_b
      : null
  if (!winner?.id) {
    return {
      status: 'pending',
      match_id: grandFinal.id,
      match_number: grandFinal.match_number,
      round_name: 'Grand Final',
      reason: 'Champion is pending because the grand final has no winner yet.',
    }
  }
  return {
    status: 'decided',
    entry_id: winner.id,
    label: winner.label,
    seed: winner.seed,
    match_id: grandFinal.id,
    match_number: grandFinal.match_number,
    round_name: 'Grand Final',
    reason: 'Champion decided in the grand final (Quick Bracket Tournament has no bracket reset).',
  }
}

const fillSlot = (match: BracketMatchCard, slot: 'a' | 'b', participant: BracketParticipant) => {
  const target = slot === 'a' ? match.participant_a : match.participant_b
  target.id = participant.id
  target.label = participant.label
  target.seed = participant.seed
  target.isPlaceholder = false
  target.isWinner = false
}

export const applyQuickSingleEliminationResult = (
  data: SingleEliminationBracketData,
  input: QuickMatchResultInput,
): QuickMatchResultOutcome<SingleEliminationBracketData> => {
  const rounds = data.rounds.map(cloneRound)

  // MSG-01's Bronze Final is fed by the two SEMIFINAL LOSERS, not by a previous round's winner -
  // it needs its own routing rule, and (per bracketTree.tsx's rendering fix) it never counts
  // toward champion detection, which only ever looks at the actual championship path.
  const bronzeRoundIndex = rounds.findIndex((round) => round.name.toLowerCase().includes('bronze'))
  const championshipIndices = rounds.map((_, index) => index).filter((index) => index !== bronzeRoundIndex)

  let targetRoundIndex = -1
  let targetMatchIndex = -1
  for (const roundIndex of rounds.map((_, index) => index)) {
    const matchIndex = rounds[roundIndex].matches.findIndex((match) => String(match.id) === input.matchId)
    if (matchIndex >= 0) {
      targetRoundIndex = roundIndex
      targetMatchIndex = matchIndex
      break
    }
  }
  if (targetRoundIndex === -1) {
    return { data, error: 'Match not found.' }
  }

  const match = rounds[targetRoundIndex].matches[targetMatchIndex]
  const outcome = applyResult(match, input.winnerSlot, input.scoreSummary)
  if (!outcome) {
    return { data, error: 'Cannot set a winner for an empty slot.' }
  }
  const { winner, loser } = outcome

  const isBronze = targetRoundIndex === bronzeRoundIndex
  if (!isBronze) {
    const championshipPosition = championshipIndices.indexOf(targetRoundIndex)
    const isSemifinal = championshipPosition === championshipIndices.length - 2
    const isFinal = championshipPosition === championshipIndices.length - 1

    if (!isFinal) {
      const nextRoundIndex = championshipIndices[championshipPosition + 1]
      const nextMatch = rounds[nextRoundIndex]?.matches[Math.floor(targetMatchIndex / 2)]
      if (nextMatch) {
        fillSlot(nextMatch, targetMatchIndex % 2 === 0 ? 'a' : 'b', winner)
      }
    }

    if (isSemifinal && bronzeRoundIndex >= 0 && loser.id) {
      const bronzeMatch = rounds[bronzeRoundIndex].matches[0]
      if (bronzeMatch) {
        fillSlot(bronzeMatch, targetMatchIndex === 0 ? 'a' : 'b', loser)
      }
    }
  }

  const championshipRounds = championshipIndices.map((index) => rounds[index])
  const champion = detectSingleEliminationChampion(championshipRounds)

  return { data: { ...data, rounds, champion, generated_at: new Date().toISOString() } }
}

export const applyQuickDoubleEliminationResult = (
  data: DoubleEliminationBracketData,
  input: QuickMatchResultInput,
): QuickMatchResultOutcome<DoubleEliminationBracketData> => {
  const winnersRounds = data.winners_rounds.map(cloneRound)
  const losersRounds = data.losers_rounds.map(cloneRound)
  const grandFinal = data.grand_final ? cloneMatch(data.grand_final) : null
  const totalWbRounds = winnersRounds.length

  type Location = { section: 'wb' | 'lb' | 'gf'; roundIndex: number; matchIndex: number }
  let location: Location | null = null

  for (let roundIndex = 0; roundIndex < winnersRounds.length && !location; roundIndex += 1) {
    const matchIndex = winnersRounds[roundIndex].matches.findIndex((match) => String(match.id) === input.matchId)
    if (matchIndex >= 0) location = { section: 'wb', roundIndex, matchIndex }
  }
  for (let roundIndex = 0; roundIndex < losersRounds.length && !location; roundIndex += 1) {
    const matchIndex = losersRounds[roundIndex].matches.findIndex((match) => String(match.id) === input.matchId)
    if (matchIndex >= 0) location = { section: 'lb', roundIndex, matchIndex }
  }
  if (!location && grandFinal && String(grandFinal.id) === input.matchId) {
    location = { section: 'gf', roundIndex: 0, matchIndex: 0 }
  }
  if (!location) {
    return { data, error: 'Match not found.' }
  }

  if (location.section === 'wb') {
    const match = winnersRounds[location.roundIndex].matches[location.matchIndex]
    const outcome = applyResult(match, input.winnerSlot, input.scoreSummary)
    if (!outcome) return { data, error: 'Cannot set a winner for an empty slot.' }
    const { winner, loser } = outcome

    const isWbFinal = location.roundIndex === winnersRounds.length - 1
    if (isWbFinal) {
      if (grandFinal) fillSlot(grandFinal, 'a', winner)
    } else {
      const nextMatch = winnersRounds[location.roundIndex + 1]?.matches[Math.floor(location.matchIndex / 2)]
      if (nextMatch) fillSlot(nextMatch, location.matchIndex % 2 === 0 ? 'a' : 'b', winner)
    }

    if (loser.id) {
      // A 2-entrant bracket has no losers bracket at all (buildLosersBracketPlan's own early
      // return) - the winners final's loser goes straight into the grand final instead.
      if (losersRounds.length === 0 && isWbFinal) {
        if (grandFinal) fillSlot(grandFinal, 'b', loser)
      } else {
        const lbPlan = buildLosersBracketPlan(totalWbRounds)
        const destination = lbPlan.find(
          (plan) =>
            (plan.sourceA.kind === 'wb_loser' &&
              plan.sourceA.round === location!.roundIndex &&
              plan.sourceA.matchIndex === location!.matchIndex) ||
            (plan.sourceB.kind === 'wb_loser' &&
              plan.sourceB.round === location!.roundIndex &&
              plan.sourceB.matchIndex === location!.matchIndex),
        )
        if (destination) {
          const slot =
            destination.sourceA.kind === 'wb_loser' &&
            destination.sourceA.round === location.roundIndex &&
            destination.sourceA.matchIndex === location.matchIndex
              ? 'a'
              : 'b'
          const destinationMatch = losersRounds[destination.round]?.matches[destination.matchIndex]
          if (destinationMatch) fillSlot(destinationMatch, slot, loser)
        }
      }
    }
  } else if (location.section === 'lb') {
    const match = losersRounds[location.roundIndex].matches[location.matchIndex]
    const outcome = applyResult(match, input.winnerSlot, input.scoreSummary)
    if (!outcome) return { data, error: 'Cannot set a winner for an empty slot.' }
    const { winner } = outcome

    const isLbFinal = location.roundIndex === losersRounds.length - 1
    if (isLbFinal) {
      if (grandFinal) fillSlot(grandFinal, 'b', winner)
    } else {
      const lbPlan = buildLosersBracketPlan(totalWbRounds)
      const destination = lbPlan.find(
        (plan) =>
          (plan.sourceA.kind === 'lb_winner' &&
            plan.sourceA.round === location!.roundIndex &&
            plan.sourceA.matchIndex === location!.matchIndex) ||
          (plan.sourceB.kind === 'lb_winner' &&
            plan.sourceB.round === location!.roundIndex &&
            plan.sourceB.matchIndex === location!.matchIndex),
      )
      if (destination) {
        const slot =
          destination.sourceA.kind === 'lb_winner' &&
          destination.sourceA.round === location.roundIndex &&
          destination.sourceA.matchIndex === location.matchIndex
            ? 'a'
            : 'b'
        const destinationMatch = losersRounds[destination.round]?.matches[destination.matchIndex]
        if (destinationMatch) fillSlot(destinationMatch, slot, winner)
      }
    }
  } else if (grandFinal) {
    // No bracket-reset support (see the design doc's Phase 1 risk note - quick brackets never
    // generate a grand_final_reset card) - whichever side wins the grand final is champion
    // outright, including a losers-bracket finalist who "should" force a reset in strict
    // double-elimination rules. An accepted simplification for a quick, no-login tool.
    const outcome = applyResult(grandFinal, input.winnerSlot, input.scoreSummary)
    if (!outcome) return { data, error: 'Cannot set a winner for an empty slot.' }
  }

  const champion = detectQuickDoubleEliminationChampion(grandFinal)

  return {
    data: {
      ...data,
      winners_rounds: winnersRounds,
      losers_rounds: losersRounds,
      grand_final: grandFinal,
      champion,
      generated_at: new Date().toISOString(),
    },
  }
}
