import type { Payload, RequiredDataFromCollectionSlug } from 'payload'

import {
  type BracketChampion,
  type BracketMatch,
  type BracketMatchCard,
  type BracketMatchSet,
  type BracketRound,
  type BracketSeedConfig,
  type RelationshipDoc,
  buildParticipant,
  buildSetScore,
  collectEntryClubLabels,
  getRelationshipId,
  getRelationshipLabel,
} from './brackets'
import {
  type MatchGenerationEntry,
  buildSingleEliminationBracketPlan,
  getSchedulableEntries,
  roundNameForRemaining,
  roundPrefixForRemaining,
} from './matchGeneration'

type Id = string | number

// ADMIN_EVENT_CREATION_NUSANTARA_GRAND_GAMES_2026.md F-14: double elimination needs a losers-
// bracket advancement graph the single next_match_id/next_match_slot pair can't express (a match's
// LOSER also needs somewhere to go, until they're eliminated for good). This module is the
// double-elimination counterpart to matchGeneration.ts + brackets.ts + winnerAdvancement.ts,
// deliberately kept separate rather than branching those files internally - single-elimination's
// generator/advancement/bracket-cache code is already hardened against real historical bugs
// (AUDIT_E2E BRK-01/02/03) and mixing an experimental new format's control flow into it risks
// regressing something that currently works.
//
// Scope decision: the auto-generator below only supports an EXACT power-of-two schedulable entry
// count (4, 8, 16, 32, ...). Single-elimination byes are well-understood (see
// buildSingleEliminationBracketPlan), but a bye in the winners bracket means that winners-bracket
// match produces no loser at all - the losers bracket would need a "dynamic bye" resolved only
// once the winners match is actually played, which is a materially harder problem this feature
// does not need to solve for its first version (Nusantara Grand Games 2026's MLBB Open, the
// concrete case this was built for, already has exactly 8 teams). Non-power-of-two entry counts
// are rejected up front by the caller (generateActions.ts) with a clear, actionable error instead
// of silently producing a subtly wrong bracket.

export const isExactPowerOfTwo = (value: number) => value >= 2 && (value & (value - 1)) === 0

export type LoserSource =
  | { kind: 'wb_loser'; round: number; matchIndex: number }
  | { kind: 'lb_winner'; round: number; matchIndex: number }

export type LoserBracketRoundMatchPlan = {
  round: number
  matchIndex: number
  sourceA: LoserSource
  sourceB: LoserSource
}

// Builds the losers-bracket topology for a winners bracket with `winnersRounds` rounds (n =
// log2(bracketSize)). Standard double-elimination shape: 2n-2 rounds, alternating "minor" rounds
// (pair up the previous round's survivors among themselves) and "major" rounds (previous
// survivors vs the next winners-bracket round's losers dropping in). Round sizes:
// bracketSize/4, bracketSize/4, bracketSize/8, bracketSize/8, ..., 1, 1. Verified by hand against
// the textbook 4-team and 8-team losers-bracket shapes (see matchGeneration.test.ts-style cases
// in doubleElimination.test.ts). Pairing within a round is always adjacent-index (2i, 2i+1) - like
// computeCrossGroupQualifierOrder's cross-group limitation, this is simple and always
// structurally valid but does not try to avoid an early losers-bracket rematch of two entries who
// already played each other in the winners bracket.
export const buildLosersBracketPlan = (winnersRounds: number): LoserBracketRoundMatchPlan[] => {
  if (winnersRounds < 2) {
    // A 2-entry (or smaller) bracket has no losers bracket at all: the single winners-bracket
    // match's loser goes straight to the Grand Final (handled directly in
    // createDoubleEliminationBracketMatches).
    return []
  }

  const totalLoserRounds = 2 * (winnersRounds - 1)
  const plans: LoserBracketRoundMatchPlan[] = []

  for (let round = 0; round < totalLoserRounds; round += 1) {
    const level = Math.floor(round / 2)
    const matchCount = 2 ** (winnersRounds - level - 2)
    const isMinorRound = round % 2 === 0

    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      if (isMinorRound) {
        plans.push({
          round,
          matchIndex,
          sourceA:
            round === 0
              ? { kind: 'wb_loser', round: 0, matchIndex: matchIndex * 2 }
              : { kind: 'lb_winner', round: round - 1, matchIndex: matchIndex * 2 },
          sourceB:
            round === 0
              ? { kind: 'wb_loser', round: 0, matchIndex: matchIndex * 2 + 1 }
              : { kind: 'lb_winner', round: round - 1, matchIndex: matchIndex * 2 + 1 },
        })
      } else {
        plans.push({
          round,
          matchIndex,
          sourceA: { kind: 'lb_winner', round: round - 1, matchIndex },
          sourceB: { kind: 'wb_loser', round: level + 1, matchIndex },
        })
      }
    }
  }

  return plans
}

export type CreateDoubleEliminationBracketMatchesInput = {
  payload: Payload
  eventId: Id
  eventSlug: string
  sportId: Id | { id: Id }
  categoryId: Id
  categorySlug: string
  stageId: Id
  entries: MatchGenerationEntry[]
  nextMatchNumber: (prefix: string) => string
}

export type CreateDoubleEliminationBracketMatchesResult = {
  createdCount: number
  failedCount: number
}

const findExistingMatchId = async (payload: Payload, generationKey: string): Promise<number | null> => {
  const existing = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 1,
    where: { generation_key: { equals: generationKey } },
  })
  return existing.docs[0]?.id ?? null
}

// Builds every winners-bracket, losers-bracket, Grand Final, and Grand Final Reset match for a
// double-elimination stage, and wires next_match_id/next_match_slot (winner routing, reused as-is
// for both brackets) and next_loser_match_id/next_loser_match_slot (loser routing, winners-bracket
// matches only - a losers-bracket loss is a final elimination with nowhere further to route).
export const createDoubleEliminationBracketMatches = async ({
  payload,
  eventId,
  eventSlug,
  sportId,
  categoryId,
  categorySlug,
  stageId,
  entries,
  nextMatchNumber,
}: CreateDoubleEliminationBracketMatchesInput): Promise<CreateDoubleEliminationBracketMatchesResult> => {
  const sportIdValue = Number(typeof sportId === 'object' ? sportId.id : sportId)
  const schedulableEntries = getSchedulableEntries(entries)
  const entryCount = schedulableEntries.length

  if (!isExactPowerOfTwo(entryCount)) {
    throw new Error(
      `Double elimination requires an exact power-of-two entry count (4, 8, 16, ...). Got ${entryCount}.`,
    )
  }

  const totalWbRounds = Math.log2(entryCount)
  const wbPlan = buildSingleEliminationBracketPlan(schedulableEntries)
  const wbMatchIdByRoundAndIndex = new Map<string, number>()
  const lbMatchIdByRoundAndIndex = new Map<string, number>()
  const keyPrefix = `${eventSlug}:${categorySlug}:${stageId}:double_elimination`

  let createdCount = 0
  let failedCount = 0

  // Every create() call below shares this idempotent find-or-create shape (mirroring
  // createSingleEliminationBracketMatches's own inline pattern) but each is written out at its
  // call site with a literal `data` object rather than through a shared generic helper - a
  // generic `data: Record<string, unknown>` parameter erases the structural type Payload needs
  // to validate a create() call against, which defeated typechecking entirely.
  const createMatch = async (
    generationKey: string,
    data: RequiredDataFromCollectionSlug<'matches'>,
  ): Promise<number | null> => {
    const existingId = await findExistingMatchId(payload, generationKey)
    if (existingId) {
      return existingId
    }
    try {
      const created = await payload.create({ collection: 'matches', data })
      createdCount += 1
      return created.id
    } catch {
      failedCount += 1
      return null
    }
  }

  // --- Winners bracket (structurally identical to single elimination: no byes, entryCount is an
  // exact power of two) ---
  for (let round = 0; round < totalWbRounds; round += 1) {
    const roundsRemaining = totalWbRounds - 1 - round
    const roundName = `Winners ${roundNameForRemaining(roundsRemaining)}`
    const roundPrefix = `w${roundPrefixForRemaining(roundsRemaining)}`
    const roundPlans = wbPlan.filter((plan) => plan.round === round)

    for (const plan of roundPlans) {
      const generationKey = `${keyPrefix}:wb:r${round}:m${plan.matchIndex}`
      const matchId = await createMatch(generationKey, {
        event_id: Number(eventId),
        sport_id: sportIdValue,
        category_id: Number(categoryId),
        stage_id: Number(stageId),
        round_name: roundName,
        match_number: nextMatchNumber(roundPrefix),
        participant_a_entry_id: plan.participantA != null ? Number(plan.participantA.id) : undefined,
        participant_b_entry_id: plan.participantB != null ? Number(plan.participantB.id) : undefined,
        status: 'ready_for_scheduling',
        generation_source: 'double_elimination',
        generation_key: generationKey,
        is_public: true,
        documentation_status: 'not_started',
      })
      if (!matchId) continue
      wbMatchIdByRoundAndIndex.set(`${round}:${plan.matchIndex}`, matchId)

      if (round > 0) {
        const parentRound = round - 1
        const parentASlotId = wbMatchIdByRoundAndIndex.get(`${parentRound}:${plan.matchIndex * 2}`)
        const parentBSlotId = wbMatchIdByRoundAndIndex.get(`${parentRound}:${plan.matchIndex * 2 + 1}`)
        if (parentASlotId) {
          await payload.update({
            collection: 'matches',
            id: parentASlotId,
            data: { next_match_id: matchId, next_match_slot: 'a' },
          })
        }
        if (parentBSlotId) {
          await payload.update({
            collection: 'matches',
            id: parentBSlotId,
            data: { next_match_id: matchId, next_match_slot: 'b' },
          })
        }
      }
    }
  }

  // --- Losers bracket ---
  const lbPlan = buildLosersBracketPlan(totalWbRounds)
  const totalLoserRounds = lbPlan.length > 0 ? Math.max(...lbPlan.map((plan) => plan.round)) + 1 : 0

  const resolveSourceMatchId = (source: LoserSource) =>
    source.kind === 'wb_loser'
      ? wbMatchIdByRoundAndIndex.get(`${source.round}:${source.matchIndex}`)
      : lbMatchIdByRoundAndIndex.get(`${source.round}:${source.matchIndex}`)

  for (let round = 0; round < totalLoserRounds; round += 1) {
    const roundsRemaining = totalLoserRounds - 1 - round
    const roundName = roundsRemaining === 0 ? 'Losers Final' : `Losers Round ${round + 1}`
    const roundPrefix = roundsRemaining === 0 ? 'lfinal' : `l${round + 1}`
    const roundPlans = lbPlan.filter((plan) => plan.round === round)

    for (const plan of roundPlans) {
      const generationKey = `${keyPrefix}:lb:r${round}:m${plan.matchIndex}`
      const matchId = await createMatch(generationKey, {
        event_id: Number(eventId),
        sport_id: sportIdValue,
        category_id: Number(categoryId),
        stage_id: Number(stageId),
        round_name: roundName,
        match_number: nextMatchNumber(roundPrefix),
        // Every losers-bracket slot is fed by another match's future winner/loser - never known
        // at generation time (entryCount being an exact power of two rules out WB byes, so even
        // LB round 0 has no statically-known participant).
        status: 'ready_for_scheduling',
        generation_source: 'double_elimination',
        generation_key: generationKey,
        is_public: true,
        documentation_status: 'not_started',
      })
      if (!matchId) continue
      lbMatchIdByRoundAndIndex.set(`${round}:${plan.matchIndex}`, matchId)

      for (const [slot, source] of [
        ['a', plan.sourceA],
        ['b', plan.sourceB],
      ] as const) {
        const sourceMatchId = resolveSourceMatchId(source)
        if (!sourceMatchId) continue
        await payload.update({
          collection: 'matches',
          id: sourceMatchId,
          data:
            source.kind === 'wb_loser'
              ? { next_loser_match_id: matchId, next_loser_match_slot: slot }
              : { next_match_id: matchId, next_match_slot: slot },
        })
      }
    }
  }

  // --- Grand Final + Grand Final Reset ---
  const wbFinalId = wbMatchIdByRoundAndIndex.get(`${totalWbRounds - 1}:0`)
  const lbFinalId =
    totalLoserRounds > 0 ? lbMatchIdByRoundAndIndex.get(`${totalLoserRounds - 1}:0`) : undefined

  const grandFinalKey = `${keyPrefix}:grand_final`
  const grandFinalId = await createMatch(grandFinalKey, {
    event_id: Number(eventId),
    sport_id: sportIdValue,
    category_id: Number(categoryId),
    stage_id: Number(stageId),
    round_name: 'Grand Final',
    match_number: nextMatchNumber('gf'),
    status: 'ready_for_scheduling',
    generation_source: 'double_elimination',
    generation_key: grandFinalKey,
    is_public: true,
    documentation_status: 'not_started',
  })

  const grandFinalResetKey = `${keyPrefix}:grand_final_reset`
  // Only actually needed if the losers-bracket finalist wins the Grand Final outright - created
  // up front (draft, hidden) so its match_number/generation_key are reserved and idempotent, and
  // attemptDoubleEliminationAdvancement only has to activate it rather than create it on demand.
  await createMatch(grandFinalResetKey, {
    event_id: Number(eventId),
    sport_id: sportIdValue,
    category_id: Number(categoryId),
    stage_id: Number(stageId),
    round_name: 'Grand Final Reset',
    match_number: nextMatchNumber('gfr'),
    status: 'draft',
    generation_source: 'double_elimination',
    generation_key: grandFinalResetKey,
    is_public: false,
    documentation_status: 'not_required',
  })

  if (wbFinalId && grandFinalId) {
    await payload.update({
      collection: 'matches',
      id: wbFinalId,
      data: { next_match_id: grandFinalId, next_match_slot: 'a' },
    })
  }
  if (grandFinalId) {
    if (lbFinalId) {
      await payload.update({
        collection: 'matches',
        id: lbFinalId,
        data: { next_match_id: grandFinalId, next_match_slot: 'b' },
      })
    } else if (wbFinalId) {
      // 2-entry bracket: no losers bracket at all, so the winners-bracket final's loser IS the
      // losers-bracket finalist and goes straight into Grand Final slot B.
      await payload.update({
        collection: 'matches',
        id: wbFinalId,
        data: { next_loser_match_id: grandFinalId, next_loser_match_slot: 'b' },
      })
    }
  }

  return { createdCount, failedCount }
}

// --- Winner/loser advancement (mirrors src/lib/winnerAdvancement.ts's safety model) ---

const PUBLISHED_RESULT_STATUSES = new Set(['result_published', 'walkover'])
// Matches that have not been touched downstream yet - safe to overwrite a slot on. Mirrors
// winnerAdvancement.ts's UNSTARTED_TARGET_STATUSES exactly (kept as a separate copy rather than a
// shared import so this module has no runtime dependency on the single-elimination-specific file).
const UNSTARTED_TARGET_STATUSES = new Set([
  'draft',
  'ready_for_scheduling',
  'scheduled',
  'published',
  'check_in_open',
  'ready_to_start',
])

type AdvancementMatch = {
  id: Id
  match_number: string
  status: string
  generation_key?: string | null
  stage_id?: (RelationshipDoc & { stage_type?: string | null }) | Id | null
  participant_a_entry_id?: RelationshipDoc | Id | null
  participant_b_entry_id?: RelationshipDoc | Id | null
  winner_entry_id?: RelationshipDoc | Id | null
  next_match_id?: RelationshipDoc | Id | null
  next_match_slot?: 'a' | 'b' | null
  next_loser_match_id?: RelationshipDoc | Id | null
  next_loser_match_slot?: 'a' | 'b' | null
}

const idsEqual = (left: Id | undefined, right: Id | undefined) =>
  left !== undefined && right !== undefined && String(left) === String(right)

const getMatchById = async (payload: Payload, matchId: Id) =>
  (await payload.findByID({ collection: 'matches', id: matchId, depth: 0 })) as AdvancementMatch

const advanceIntoSlot = async (
  payload: Payload,
  targetMatchId: Id,
  targetSlot: 'a' | 'b',
  entryId: Id,
): Promise<'advanced' | 'already_advanced' | 'skipped_target_occupied'> => {
  const targetMatch = await getMatchById(payload, targetMatchId)
  const currentOccupantId = getRelationshipId(
    targetSlot === 'a' ? targetMatch.participant_a_entry_id : targetMatch.participant_b_entry_id,
  )

  if (idsEqual(currentOccupantId, entryId)) {
    return 'already_advanced'
  }
  if (currentOccupantId && !UNSTARTED_TARGET_STATUSES.has(targetMatch.status)) {
    return 'skipped_target_occupied'
  }

  await payload.update({
    collection: 'matches',
    id: targetMatchId,
    data:
      targetSlot === 'a'
        ? { participant_a_entry_id: Number(entryId) }
        : { participant_b_entry_id: Number(entryId) },
  })
  return 'advanced'
}

export type DoubleEliminationAdvancementResult = {
  outcome: string
  sourceMatchId: Id
  sourceMatchNumber: string
  details: string[]
}

// Called after a double-elimination match's result is published. Routes the winner forward
// (next_match_id/slot - winners bracket, losers bracket, or into the Grand Final) and, for
// winners-bracket matches only, routes the loser into the losers bracket
// (next_loser_match_id/slot). The Grand Final itself is special-cased: if the winner is the
// losers-bracket finalist (participant_b, by the fixed convention set at generation time), the
// pre-created Grand Final Reset match is activated instead of eliminating anyone.
export const attemptDoubleEliminationAdvancement = async (
  payload: Payload,
  matchId: Id,
): Promise<DoubleEliminationAdvancementResult> => {
  const match = await getMatchById(payload, matchId)
  const details: string[] = []

  if (!PUBLISHED_RESULT_STATUSES.has(match.status)) {
    return { outcome: 'skipped_not_result_published', sourceMatchId: match.id, sourceMatchNumber: match.match_number, details }
  }

  const winnerEntryId = getRelationshipId(match.winner_entry_id)
  if (!winnerEntryId) {
    return { outcome: 'skipped_missing_winner', sourceMatchId: match.id, sourceMatchNumber: match.match_number, details }
  }

  // Grand Final special case.
  if (String(match.generation_key || '').endsWith(':grand_final')) {
    const participantAId = getRelationshipId(match.participant_a_entry_id)
    const winnersSideWon = idsEqual(participantAId, winnerEntryId)
    const resetKey = String(match.generation_key).replace(/:grand_final$/, ':grand_final_reset')
    const resetResult = await payload.find({
      collection: 'matches',
      depth: 0,
      limit: 1,
      where: { generation_key: { equals: resetKey } },
    })
    const resetMatch = resetResult.docs[0]

    if (winnersSideWon) {
      details.push('Winners-bracket finalist won the grand final outright - no reset needed.')
      if (resetMatch && resetMatch.status === 'draft') {
        await payload.update({
          collection: 'matches',
          id: resetMatch.id,
          data: { status: 'cancelled', score_summary: 'Not needed - winners bracket champion won the grand final.' },
        })
      }
      return { outcome: 'champion_decided', sourceMatchId: match.id, sourceMatchNumber: match.match_number, details }
    }

    details.push('Losers-bracket finalist won the grand final - activating the reset match.')
    if (resetMatch) {
      await payload.update({
        collection: 'matches',
        id: resetMatch.id,
        data: {
          participant_a_entry_id: Number(getRelationshipId(match.participant_a_entry_id)),
          participant_b_entry_id: Number(getRelationshipId(match.participant_b_entry_id)),
          status: 'ready_for_scheduling',
          is_public: true,
          documentation_status: 'not_started',
        },
      })
    }
    return { outcome: 'reset_activated', sourceMatchId: match.id, sourceMatchNumber: match.match_number, details }
  }

  // Grand Final Reset: whoever wins is the champion outright. No further routing.
  if (String(match.generation_key || '').endsWith(':grand_final_reset')) {
    details.push('Grand final reset decided the champion.')
    return { outcome: 'champion_decided', sourceMatchId: match.id, sourceMatchNumber: match.match_number, details }
  }

  // Regular winners/losers-bracket match: advance the winner forward.
  const nextMatchId = getRelationshipId(match.next_match_id)
  const nextMatchSlot = match.next_match_slot || undefined
  if (nextMatchId && nextMatchSlot) {
    const outcome = await advanceIntoSlot(payload, nextMatchId, nextMatchSlot, winnerEntryId)
    details.push(`Winner ${outcome} into match ${nextMatchId} slot ${nextMatchSlot}.`)
  }

  // Winners-bracket match only: route the loser into the losers bracket.
  const nextLoserMatchId = getRelationshipId(match.next_loser_match_id)
  const nextLoserMatchSlot = match.next_loser_match_slot || undefined
  const participantAId = getRelationshipId(match.participant_a_entry_id)
  const participantBId = getRelationshipId(match.participant_b_entry_id)
  const loserEntryId = idsEqual(participantAId, winnerEntryId) ? participantBId : participantAId

  if (nextLoserMatchId && nextLoserMatchSlot && loserEntryId) {
    const outcome = await advanceIntoSlot(payload, nextLoserMatchId, nextLoserMatchSlot, loserEntryId)
    details.push(`Loser ${outcome} into match ${nextLoserMatchId} slot ${nextLoserMatchSlot}.`)
  }

  return { outcome: 'advanced', sourceMatchId: match.id, sourceMatchNumber: match.match_number, details }
}

// --- Bracket cache (winners bracket / losers bracket / grand final / reset) ---

export type DoubleEliminationBracketData = {
  format: 'double_elimination'
  winners_rounds: BracketRound[]
  losers_rounds: BracketRound[]
  grand_final: BracketMatchCard | null
  grand_final_reset: BracketMatchCard | null
  champion: BracketChampion
  generated_at: string
}

const getRoundOrder = (roundName: string) => {
  const normalized = roundName.toLowerCase()
  if (normalized.includes('first')) return 10
  const roundOfMatch = normalized.match(/round of (\d+)/)
  if (roundOfMatch) return Math.max(1, 20 - (Math.log2(Number(roundOfMatch[1])) - 4) * 5)
  if (normalized.includes('quarter')) return 30
  if (normalized.includes('semi')) return 40
  if (normalized.includes('final')) return 50
  const roundNumberMatch = normalized.match(/round (\d+)/)
  if (roundNumberMatch) return Number(roundNumberMatch[1])
  return 100
}

const buildBracketMatchCard = (match: BracketMatch, matchSets: BracketMatchSet[], clubLabelByEntryId: Map<string, string>): BracketMatchCard => {
  const winnerId = getRelationshipId(match.winner_entry_id)
  return {
    id: match.id,
    match_number: match.match_number,
    round_name: match.round_name || '',
    scheduled_start_at: match.scheduled_start_at || undefined,
    status: match.status,
    winner_entry_id: winnerId,
    score_summary: match.score_summary || undefined,
    set_score: buildSetScore(matchSets),
    venue_label:
      match.venue_id || match.court_id ?
        `${getRelationshipLabel(match.venue_id)} / ${getRelationshipLabel(match.court_id)}`
      : undefined,
    detail_href: `/matches/${match.match_number}`,
    participant_a: buildParticipant(match.participant_a_entry_id, winnerId, clubLabelByEntryId),
    participant_b: buildParticipant(match.participant_b_entry_id, winnerId, clubLabelByEntryId),
  }
}

const detectDoubleEliminationChampion = (
  grandFinal: BracketMatchCard | null,
  grandFinalReset: BracketMatchCard | null,
): BracketChampion => {
  if (!grandFinal) {
    return { status: 'pending', reason: 'The grand final has not been generated yet.' }
  }

  if (grandFinalReset && PUBLISHED_RESULT_STATUSES.has(grandFinalReset.status)) {
    const winner =
      grandFinalReset.participant_a.isWinner ? grandFinalReset.participant_a
      : grandFinalReset.participant_b.isWinner ? grandFinalReset.participant_b
      : null
    if (winner?.id) {
      return {
        status: 'decided',
        entry_id: winner.id,
        label: winner.label,
        seed: winner.seed,
        match_id: grandFinalReset.id,
        match_number: grandFinalReset.match_number,
        round_name: 'Grand Final Reset',
        reason: 'Champion decided in the grand final reset match.',
      }
    }
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

  if (grandFinal.participant_a.isWinner && grandFinal.participant_a.id) {
    return {
      status: 'decided',
      entry_id: grandFinal.participant_a.id,
      label: grandFinal.participant_a.label,
      seed: grandFinal.participant_a.seed,
      match_id: grandFinal.id,
      match_number: grandFinal.match_number,
      round_name: 'Grand Final',
      reason: 'Winners-bracket finalist won the grand final outright.',
    }
  }

  return {
    status: 'pending',
    match_id: grandFinalReset?.id,
    match_number: grandFinalReset?.match_number,
    round_name: 'Grand Final Reset',
    reason: 'The losers-bracket finalist forced a grand final reset - champion is pending that result.',
  }
}

export const buildDoubleEliminationBracketLayout = async (
  payload: Payload,
  stageId: Id,
): Promise<{
  bracketData: DoubleEliminationBracketData
  seedConfig: BracketSeedConfig
  eventId: Id
  categoryId: Id
  stageId: Id
}> => {
  const stage = (await payload.findByID({ collection: 'stages', id: stageId, depth: 1 })) as RelationshipDoc & {
    stage_type?: string | null
    event_id?: RelationshipDoc | Id | null
    category_id?: RelationshipDoc | Id | null
  }

  if (stage.stage_type !== 'double_elimination') {
    throw new Error('Only double_elimination stages are supported by this bracket builder.')
  }

  const eventId = getRelationshipId(stage.event_id)
  const categoryId = getRelationshipId(stage.category_id)
  if (!eventId || !categoryId || stage.id === undefined) {
    throw new Error('Bracket stage is missing event or category relationship.')
  }

  const matchesResult = await payload.find({
    collection: 'matches',
    depth: 1,
    limit: 200,
    sort: ['scheduled_start_at', 'match_number'],
    where: { stage_id: { equals: stageId } },
  })
  const matches = matchesResult.docs as (BracketMatch & { generation_key?: string | null })[]
  const entryIds = new Set<string>()
  const matchesWithSets = await Promise.all(
    matches.map(async (match) => {
      const matchSets = await payload.find({
        collection: 'match-sets',
        depth: 0,
        limit: 50,
        sort: 'set_number',
        where: { match_id: { equals: match.id } },
      })
      const participantAId = getRelationshipId(match.participant_a_entry_id)
      const participantBId = getRelationshipId(match.participant_b_entry_id)
      if (participantAId) entryIds.add(String(participantAId))
      if (participantBId) entryIds.add(String(participantBId))
      return { match, matchSets: matchSets.docs as unknown as BracketMatchSet[] }
    }),
  )

  const clubLabelByEntryId = await collectEntryClubLabels(payload, Array.from(entryIds))

  const winnersRoundsMap = new Map<string, BracketMatchCard[]>()
  const losersRoundsMap = new Map<string, BracketMatchCard[]>()
  let grandFinal: BracketMatchCard | null = null
  let grandFinalReset: BracketMatchCard | null = null

  for (const { match, matchSets } of matchesWithSets) {
    const card = buildBracketMatchCard(match, matchSets, clubLabelByEntryId)
    const generationKey = String(match.generation_key || '')

    if (generationKey.endsWith(':grand_final_reset')) {
      grandFinalReset = card
    } else if (generationKey.endsWith(':grand_final')) {
      grandFinal = card
    } else if (generationKey.includes(':lb:')) {
      const roundName = match.round_name || 'Losers Bracket'
      const roundMatches = losersRoundsMap.get(roundName) || []
      roundMatches.push(card)
      losersRoundsMap.set(roundName, roundMatches)
    } else {
      const roundName = match.round_name || 'Winners Bracket'
      const roundMatches = winnersRoundsMap.get(roundName) || []
      roundMatches.push(card)
      winnersRoundsMap.set(roundName, roundMatches)
    }
  }

  const sortRounds = (roundsMap: Map<string, BracketMatchCard[]>): BracketRound[] =>
    Array.from(roundsMap.entries())
      .map(([name, roundMatches]) => ({
        name,
        order: getRoundOrder(name),
        matches: roundMatches.sort((left, right) => left.match_number.localeCompare(right.match_number, 'en')),
      }))
      .sort((left, right) => (left.order !== right.order ? left.order - right.order : left.name.localeCompare(right.name, 'en')))

  const winnersRounds = sortRounds(winnersRoundsMap)
  const losersRounds = sortRounds(losersRoundsMap)

  return {
    eventId,
    categoryId,
    stageId: stage.id,
    bracketData: {
      format: 'double_elimination',
      winners_rounds: winnersRounds,
      losers_rounds: losersRounds,
      grand_final: grandFinal,
      grand_final_reset: grandFinalReset,
      champion: detectDoubleEliminationChampion(grandFinal, grandFinalReset),
      generated_at: new Date().toISOString(),
    },
    seedConfig: {
      entry_count: entryIds.size,
      match_count: matches.length,
      round_count: winnersRounds.length + losersRounds.length,
      stage_type: stage.stage_type,
    },
  }
}

export type RecalculateDoubleEliminationBracketResult = {
  bracketId: Id
  matchCount: number
  roundCount: number
}

export const recalculateDoubleEliminationBracket = async (
  payload: Payload,
  input: { stageId: Id },
): Promise<RecalculateDoubleEliminationBracketResult> => {
  const layout = await buildDoubleEliminationBracketLayout(payload, input.stageId)
  const bracketKey = `${layout.eventId}:${layout.categoryId}:${layout.stageId}:double_elimination`
  const existing = await payload.find({
    collection: 'brackets',
    depth: 0,
    limit: 1,
    where: { bracket_key: { equals: bracketKey } },
  })
  const data = {
    bracket_key: bracketKey,
    event_id: Number(layout.eventId),
    category_id: Number(layout.categoryId),
    stage_id: Number(layout.stageId),
    name: 'Double Elimination Bracket',
    format: 'double_elimination' as const,
    seed_config: layout.seedConfig,
    bracket_data: layout.bracketData,
    status: (layout.bracketData.winners_rounds.length > 0 ? 'published' : 'draft') as 'published' | 'draft',
  }
  const bracket =
    existing.docs[0]
      ? await payload.update({ collection: 'brackets', id: existing.docs[0].id, data })
      : await payload.create({ collection: 'brackets', data })

  return {
    bracketId: bracket.id,
    matchCount: layout.seedConfig.match_count,
    roundCount: layout.seedConfig.round_count,
  }
}
