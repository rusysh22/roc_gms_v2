import type { Payload } from 'payload'

type Id = string | number

type RelationshipDoc = { id?: Id; name?: string; display_name?: string }

const getRelationshipId = (value: RelationshipDoc | Id | null | undefined): Id | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }
  if (value && typeof value === 'object' && value.id !== undefined) {
    return value.id
  }
  return undefined
}

export type MedalType = 'gold' | 'silver' | 'bronze'
export type MedalSource =
  | 'final_match'
  | 'bronze_match'
  | 'shared_bronze'
  | 'standings_rank'
  | 'ranking_result'

export type DerivedMedal = {
  entryId: Id
  medal: MedalType
  source: MedalSource
  sourceMatchId?: Id
}

export type MedalDerivationResult = {
  // Empty (with finished: false) until the category has a decided result to derive medals from -
  // recalculateMedalsForCategory treats that as "nothing to write yet", not an error.
  finished: boolean
  medals: DerivedMedal[]
  // True when a top-3 standings position was still tied after every configured tie-breaker
  // (Standings.tie_note - see src/lib/standings.ts's compareRows). Medals are deliberately NOT
  // derived in this case - the system must not invent a placement the tie-breakers themselves
  // couldn't resolve alphabetically and present it as a real result.
  blockedByTie: boolean
}

type CategoryDoc = {
  id: Id
  event_id?: RelationshipDoc | Id | null
  format_type?: string | null
  third_place_policy?: 'none' | 'match' | 'shared' | null
  medal_eligible?: boolean | null
}

type MatchDoc = {
  id: Id
  round_name?: string | null
  status: string
  winner_entry_id?: RelationshipDoc | Id | null
  participant_a_entry_id?: RelationshipDoc | Id | null
  participant_b_entry_id?: RelationshipDoc | Id | null
}

const RESULT_STATUSES = new Set(['result_published', 'walkover'])

// MSG-01/MSG-02: mirrors src/lib/brackets.ts's getRoundOrder closely enough for the two names this
// module actually looks for ("final" and "bronze") - kept separate rather than imported so this
// module has no dependency on the bracket-rendering module's full round-ordering behavior.
const isFinalRound = (roundName: string | null | undefined) =>
  (roundName || '').toLowerCase().includes('final') && !(roundName || '').toLowerCase().includes('bronze')
const isBronzeRound = (roundName: string | null | undefined) => (roundName || '').toLowerCase().includes('bronze')

// Strategy A: single_elimination (including a promoted group_stage_to_knockout's knockout stage).
// Gold/silver come from the Final; bronze comes from the Bronze Final (or is shared between both
// semifinal losers) according to the category's third_place_policy (MSG-01).
const deriveFromSingleElimination = async (
  payload: Payload,
  categoryId: Id,
  stageId: Id,
  thirdPlacePolicy: 'none' | 'match' | 'shared',
): Promise<MedalDerivationResult> => {
  const matchesResult = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 200,
    where: { stage_id: { equals: stageId } },
  })
  const matches = matchesResult.docs as unknown as MatchDoc[]

  const finalMatch = matches.find((match) => isFinalRound(match.round_name))
  if (!finalMatch || !RESULT_STATUSES.has(finalMatch.status) || !finalMatch.winner_entry_id) {
    return { finished: false, medals: [], blockedByTie: false }
  }

  const winnerId = getRelationshipId(finalMatch.winner_entry_id)
  const participantAId = getRelationshipId(finalMatch.participant_a_entry_id)
  const participantBId = getRelationshipId(finalMatch.participant_b_entry_id)
  const runnerUpId = String(participantAId) === String(winnerId) ? participantBId : participantAId
  if (!winnerId || !runnerUpId) {
    return { finished: false, medals: [], blockedByTie: false }
  }

  const medals: DerivedMedal[] = [
    { entryId: winnerId, medal: 'gold', source: 'final_match', sourceMatchId: finalMatch.id },
    { entryId: runnerUpId, medal: 'silver', source: 'final_match', sourceMatchId: finalMatch.id },
  ]

  if (thirdPlacePolicy === 'match') {
    const bronzeMatch = matches.find((match) => isBronzeRound(match.round_name))
    if (bronzeMatch && RESULT_STATUSES.has(bronzeMatch.status) && bronzeMatch.winner_entry_id) {
      const bronzeWinnerId = getRelationshipId(bronzeMatch.winner_entry_id)
      if (bronzeWinnerId) {
        medals.push({ entryId: bronzeWinnerId, medal: 'bronze', source: 'bronze_match', sourceMatchId: bronzeMatch.id })
      }
    }
    // Bronze Final not yet decided - gold/silver are still reported (the category isn't blocked
    // waiting on third place), bronze is simply absent from `medals` until it publishes.
  } else if (thirdPlacePolicy === 'shared') {
    const semifinals = matches.filter((match) => (match.round_name || '').toLowerCase().includes('semi'))
    for (const semifinal of semifinals) {
      if (!RESULT_STATUSES.has(semifinal.status) || !semifinal.winner_entry_id) continue
      const semiWinnerId = getRelationshipId(semifinal.winner_entry_id)
      const semiAId = getRelationshipId(semifinal.participant_a_entry_id)
      const semiBId = getRelationshipId(semifinal.participant_b_entry_id)
      const semiLoserId = String(semiAId) === String(semiWinnerId) ? semiBId : semiAId
      if (semiLoserId) {
        medals.push({ entryId: semiLoserId, medal: 'bronze', source: 'shared_bronze', sourceMatchId: semifinal.id })
      }
    }
  }

  return { finished: true, medals, blockedByTie: false }
}

// Strategy B: round_robin / league / a group_stage category with no knockout (format_type stays
// group_stage-flavored but never promotes) - ranked by the standings cache's `rank` field. Only
// treated as "finished" once every match in the stage has a result, matching the spirit of
// src/lib/standings.ts's own finishedMatchCount bookkeeping.
const deriveFromStandingsRank = async (
  payload: Payload,
  eventId: Id,
  categoryId: Id,
  stageId: Id,
): Promise<MedalDerivationResult> => {
  const [matchesResult, standingsResult] = await Promise.all([
    payload.find({
      collection: 'matches',
      depth: 0,
      limit: 500,
      where: { stage_id: { equals: stageId } },
    }),
    payload.find({
      collection: 'standings',
      depth: 0,
      limit: 500,
      sort: 'rank',
      where: { and: [{ category_id: { equals: categoryId } }, { stage_id: { equals: stageId } }] },
    }),
  ])

  const allMatches = matchesResult.docs as unknown as MatchDoc[]
  if (allMatches.length === 0 || !allMatches.every((match) => RESULT_STATUSES.has(match.status))) {
    return { finished: false, medals: [], blockedByTie: false }
  }

  const topThree = standingsResult.docs.slice(0, 3) as unknown as Array<{
    entry_id: RelationshipDoc | Id
    rank: number
    tie_note?: string | null
  }>
  if (topThree.length === 0) {
    return { finished: false, medals: [], blockedByTie: false }
  }
  if (topThree.some((row) => row.tie_note)) {
    return { finished: true, medals: [], blockedByTie: true }
  }

  const medalByRank: MedalType[] = ['gold', 'silver', 'bronze']
  const medals: DerivedMedal[] = topThree
    .map((row, index): DerivedMedal | null => {
      const entryId = getRelationshipId(row.entry_id)
      return entryId ? { entryId, medal: medalByRank[index], source: 'standings_rank' } : null
    })
    .filter((medal): medal is DerivedMedal => medal !== null)

  return { finished: true, medals, blockedByTie: false }
}

// Strategy C: time_trial / score_ranking - same standings cache, but calculateRankingStandingsForScope
// never sets tie_note (see its own comments), so ties there resolve to the system's existing
// deterministic alphabetical order rather than blocking - that's the established behavior for this
// format already, not something new introduced here.
const deriveFromRankingResult = async (
  payload: Payload,
  categoryId: Id,
  stageId: Id,
): Promise<MedalDerivationResult> => {
  const standingsResult = await payload.find({
    collection: 'standings',
    depth: 0,
    limit: 500,
    sort: 'rank',
    where: { and: [{ category_id: { equals: categoryId } }, { stage_id: { equals: stageId } }] },
  })

  const matchesResult = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 500,
    where: { stage_id: { equals: stageId } },
  })
  const allMatches = matchesResult.docs as unknown as MatchDoc[]
  if (allMatches.length === 0 || !allMatches.every((match) => RESULT_STATUSES.has(match.status))) {
    return { finished: false, medals: [], blockedByTie: false }
  }

  // `won: 1` on a standings row is calculateRankingStandingsForScope's internal "has a comparable
  // result" flag (see its own comment) - an entry that DNS/DNF/DSQ'd has won: 0 and must not
  // receive a medal even if it sorted into the top 3 by tiebreak order.
  const topThree = (
    standingsResult.docs as unknown as Array<{ entry_id: RelationshipDoc | Id; won: number }>
  )
    .filter((row) => row.won === 1)
    .slice(0, 3)

  const medalByRank: MedalType[] = ['gold', 'silver', 'bronze']
  const medals: DerivedMedal[] = topThree
    .map((row, index): DerivedMedal | null => {
      const entryId = getRelationshipId(row.entry_id)
      return entryId ? { entryId, medal: medalByRank[index], source: 'ranking_result' } : null
    })
    .filter((medal): medal is DerivedMedal => medal !== null)

  return { finished: true, medals, blockedByTie: false }
}

export const deriveMedalsForCategory = async (
  payload: Payload,
  categoryId: Id,
): Promise<MedalDerivationResult & { eventId?: Id; stageId?: Id }> => {
  const category = (await payload.findByID({
    collection: 'competition-categories',
    id: categoryId,
    depth: 0,
  }).catch(() => null)) as CategoryDoc | null
  if (!category) {
    return { finished: false, medals: [], blockedByTie: false }
  }

  const eventId = getRelationshipId(category.event_id)
  const formatType = category.format_type || ''
  const thirdPlacePolicy = category.third_place_policy || 'none'

  const stagesResult = await payload.find({
    collection: 'stages',
    depth: 0,
    limit: 10,
    sort: '-order',
    where: { category_id: { equals: categoryId } },
  })
  const stages = stagesResult.docs as unknown as Array<{ id: Id; stage_type?: string | null; order: number }>
  if (stages.length === 0) {
    return { finished: false, medals: [], blockedByTie: false }
  }

  // group_stage_to_knockout only produces medals once promoted to its knockout stage (order 2) -
  // the group stage alone (order 1) is not a final classification, it's qualifying. Every other
  // format has exactly one stage, which is by definition its "last" one.
  const lastStage =
    formatType === 'group_stage_to_knockout'
      ? stages.find((stage) => stage.stage_type === 'single_elimination')
      : stages[0]
  if (!lastStage) {
    return { finished: false, medals: [], blockedByTie: false }
  }

  let result: MedalDerivationResult
  if (lastStage.stage_type === 'single_elimination') {
    result = await deriveFromSingleElimination(payload, categoryId, lastStage.id, thirdPlacePolicy)
  } else if (lastStage.stage_type === 'round_robin' || lastStage.stage_type === 'league' || lastStage.stage_type === 'group_stage') {
    result = await deriveFromStandingsRank(payload, eventId ?? categoryId, categoryId, lastStage.id)
  } else if (lastStage.stage_type === 'time_trial' || lastStage.stage_type === 'score_ranking') {
    result = await deriveFromRankingResult(payload, categoryId, lastStage.id)
  } else {
    // double_elimination, friendly, final_only, swiss: no medal derivation strategy yet (see
    // MULTI_SPORT_GAMES_ENHANCEMENTS_DESIGN.md MSG-02's scope note) - such categories simply never
    // produce medals until a future pass adds their strategy.
    result = { finished: false, medals: [], blockedByTie: false }
  }

  return { ...result, eventId, stageId: lastStage.id }
}

type EntryDoc = {
  id: Id
  entry_type?: string | null
  club_id?: RelationshipDoc | Id | null
  team_id?: (RelationshipDoc & { club_id?: RelationshipDoc | Id | null }) | Id | null
  player_id?: (RelationshipDoc & { club_id?: RelationshipDoc | Id | null }) | Id | null
}

// A medal's contingent comes from the entry's club (club entries), its team's club (team/pair
// entries), or its player's club (individual entries) - the same three-way mapping
// src/lib/brackets.ts's collectEntryClubLabels uses for display labels, but returning the id
// (needed to write MedalRecords.club_id) rather than a display label.
export const resolveEntryClubIds = async (
  payload: Payload,
  entryIds: Id[],
): Promise<Map<string, Id>> => {
  const clubIdByEntryId = new Map<string, Id>()
  if (entryIds.length === 0) {
    return clubIdByEntryId
  }

  const entriesResult = await payload.find({
    collection: 'competition-entries',
    depth: 2,
    limit: entryIds.length,
    where: { id: { in: entryIds } },
  })

  for (const entry of entriesResult.docs as unknown as EntryDoc[]) {
    let clubId: Id | undefined
    if (entry.entry_type === 'club') {
      clubId = getRelationshipId(entry.club_id)
    } else if (entry.entry_type === 'pair' || entry.entry_type === 'team') {
      const team = entry.team_id
      clubId = team && typeof team === 'object' ? getRelationshipId(team.club_id) : undefined
    } else if (entry.entry_type === 'individual') {
      const player = entry.player_id
      clubId = player && typeof player === 'object' ? getRelationshipId(player.club_id) : undefined
    }
    if (clubId) {
      clubIdByEntryId.set(String(entry.id), clubId)
    }
  }

  return clubIdByEntryId
}

export type RecalculateMedalsResult = {
  written: number
  skippedManual: number
  finished: boolean
  blockedByTie: boolean
}

// Recalculates and persists every non-manual medal-records row for one category (MSG-02). Mirrors
// src/lib/standings.ts's recalculateStandingsForScope shape: derive -> resolve -> write, with a
// manual override (is_manual: true) for a (category, medal) combination always winning over
// whatever recalculation would otherwise produce for that slot.
export const recalculateMedalsForCategory = async (
  payload: Payload,
  categoryId: Id,
): Promise<RecalculateMedalsResult> => {
  const derived = await deriveMedalsForCategory(payload, categoryId)

  const existingResult = await payload.find({
    collection: 'medal-records',
    depth: 0,
    limit: 20,
    where: { category_id: { equals: categoryId } },
  })
  const existing = existingResult.docs as unknown as Array<{
    id: Id
    medal: MedalType
    is_manual: boolean
  }>
  const manualMedals = new Set(existing.filter((row) => row.is_manual).map((row) => row.medal))

  // Not finished (or blocked by an unresolved tie): remove any stale non-manual rows and stop -
  // there is nothing new to write. A category that regresses from "finished" back to unfinished
  // (e.g. a result gets reverted) must not keep showing medals for a result that no longer holds.
  if (!derived.finished || derived.blockedByTie) {
    for (const row of existing) {
      if (!row.is_manual) {
        await payload.delete({ collection: 'medal-records', id: row.id }).catch(() => {})
      }
    }
    return { written: 0, skippedManual: manualMedals.size, finished: derived.finished, blockedByTie: derived.blockedByTie }
  }

  const clubIdByEntryId = await resolveEntryClubIds(
    payload,
    derived.medals.map((medal) => medal.entryId),
  )

  const wantedMedals = new Set(derived.medals.filter((medal) => !manualMedals.has(medal.medal)).map((medal) => medal.medal))
  let written = 0

  for (const row of existing) {
    if (!row.is_manual && !wantedMedals.has(row.medal)) {
      await payload.delete({ collection: 'medal-records', id: row.id }).catch(() => {})
    }
  }

  for (const medal of derived.medals) {
    if (manualMedals.has(medal.medal)) {
      continue
    }

    const data = {
      event_id: Number(derived.eventId),
      category_id: Number(categoryId),
      stage_id: derived.stageId ? Number(derived.stageId) : undefined,
      entry_id: Number(medal.entryId),
      club_id: clubIdByEntryId.has(String(medal.entryId)) ? Number(clubIdByEntryId.get(String(medal.entryId))) : undefined,
      medal: medal.medal,
      source: medal.source,
      source_match_id: medal.sourceMatchId ? Number(medal.sourceMatchId) : undefined,
      is_manual: false,
    }

    const existingRow = existing.find((row) => row.medal === medal.medal && !row.is_manual)
    if (existingRow) {
      await payload.update({ collection: 'medal-records', id: existingRow.id, data })
    } else {
      await payload.create({ collection: 'medal-records', data })
    }
    written += 1
  }

  return { written, skippedManual: manualMedals.size, finished: true, blockedByTie: false }
}

// --- Pure aggregation (no Payload dependency - unit tested directly) ---

export type MedalTallyRecord = {
  clubId: Id
  clubLabel: string
  medal: MedalType
  weight: number
}

export type MedalTallyRow = {
  clubId: Id
  clubLabel: string
  gold: number
  silver: number
  bronze: number
  total: number
  points: number
  rank: number
}

export type MedalRankingMethod = 'gold_first' | 'weighted_points'

export const buildMedalTally = (
  records: MedalTallyRecord[],
  options: { method: MedalRankingMethod; pointsGold: number; pointsSilver: number; pointsBronze: number },
): MedalTallyRow[] => {
  const rowByClubId = new Map<string, MedalTallyRow>()

  for (const record of records) {
    const key = String(record.clubId)
    const row =
      rowByClubId.get(key) ??
      ({ clubId: record.clubId, clubLabel: record.clubLabel, gold: 0, silver: 0, bronze: 0, total: 0, points: 0, rank: 1 } as MedalTallyRow)

    if (record.medal === 'gold') row.gold += record.weight
    else if (record.medal === 'silver') row.silver += record.weight
    else row.bronze += record.weight
    row.total = row.gold + row.silver + row.bronze
    row.points = row.gold * options.pointsGold + row.silver * options.pointsSilver + row.bronze * options.pointsBronze

    rowByClubId.set(key, row)
  }

  const rows = Array.from(rowByClubId.values())

  // Two comparators, deliberately different: `rankCompare` decides whether two rows are
  // *genuinely* tied (same medal counts / points - a real tie that should share a rank number).
  // `sortCompare` adds the alphabetical name as a final tiebreak purely to give equally-ranked
  // rows a stable, deterministic display order - that tiebreak must NOT feed into the tie
  // detection below, or two differently-named clubs with identical medal counts would incorrectly
  // get different rank numbers just because their names differ.
  const rankCompare =
    options.method === 'weighted_points'
      ? (left: MedalTallyRow, right: MedalTallyRow) => right.points - left.points || right.gold - left.gold
      : (left: MedalTallyRow, right: MedalTallyRow) =>
          right.gold - left.gold || right.silver - left.silver || right.bronze - left.bronze

  const sortCompare = (left: MedalTallyRow, right: MedalTallyRow) =>
    rankCompare(left, right) || left.clubLabel.localeCompare(right.clubLabel, 'en')

  rows.sort(sortCompare)

  // Ties share the same rank - the next distinct row's rank still reflects its position in the
  // list (1, 1, 3 - not 1, 1, 2), the standard "competition ranking" convention.
  let previousRow: MedalTallyRow | null = null
  rows.forEach((row, index) => {
    if (previousRow && rankCompare(previousRow, row) === 0) {
      row.rank = previousRow.rank
    } else {
      row.rank = index + 1
    }
    previousRow = row
  })

  return rows
}
