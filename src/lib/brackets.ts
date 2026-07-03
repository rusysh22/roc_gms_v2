import type { Payload } from 'payload'

type Id = string | number

type RelationshipDoc = {
  id?: Id
  name?: string
  display_name?: string
  seed_number?: number | null
}

type BracketStage = RelationshipDoc & {
  stage_type?: string | null
  event_id?: RelationshipDoc | Id | null
  category_id?: RelationshipDoc | Id | null
}

type BracketMatch = {
  id: Id
  match_number: string
  round_name?: string | null
  scheduled_start_at?: string | null
  status: string
  score_summary?: string | null
  event_id?: RelationshipDoc | Id | null
  category_id?: RelationshipDoc | Id | null
  stage_id?: RelationshipDoc | Id | null
  participant_a_entry_id?: RelationshipDoc | Id | null
  participant_b_entry_id?: RelationshipDoc | Id | null
  winner_entry_id?: RelationshipDoc | Id | null
}

type BracketMatchSet = {
  set_number: number
  participant_a_score?: number | null
  participant_b_score?: number | null
}

export type BracketParticipant = {
  id?: Id
  label: string
  seed?: number
  isWinner: boolean
  isPlaceholder: boolean
}

export type BracketMatchCard = {
  id: Id
  match_number: string
  round_name: string
  scheduled_start_at?: string
  status: string
  winner_entry_id?: Id
  score_summary?: string
  set_score?: string
  detail_href: string
  participant_a: BracketParticipant
  participant_b: BracketParticipant
}

export type BracketRound = {
  name: string
  order: number
  matches: BracketMatchCard[]
}

export type BracketChampion = {
  status: 'decided' | 'pending'
  entry_id?: Id
  label?: string
  seed?: number
  match_id?: Id
  match_number?: string
  round_name?: string
  reason: string
}

export type SingleEliminationBracketData = {
  format: 'single_elimination'
  rounds: BracketRound[]
  champion: BracketChampion
  generated_at: string
}

export type BracketSeedConfig = {
  entry_count: number
  match_count: number
  round_count: number
  stage_type: string
}

export type RecalculateBracketInput = {
  stageId: Id
}

export type RecalculateBracketResult = {
  bracketId: Id
  matchCount: number
  roundCount: number
}

export const getRelationshipId = (
  value: RelationshipDoc | Id | null | undefined,
): Id | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  if (value && typeof value === 'object' && value.id) {
    return value.id
  }

  return undefined
}

const getRelationshipLabel = (
  value: RelationshipDoc | Id | null | undefined,
  fallback = 'TBD',
) => {
  if (!value || typeof value === 'string' || typeof value === 'number') {
    return fallback
  }

  return value.display_name || value.name || fallback
}

const getRelationshipSeed = (value: RelationshipDoc | Id | null | undefined) => {
  if (!value || typeof value === 'string' || typeof value === 'number') {
    return undefined
  }

  return typeof value.seed_number === 'number' ? value.seed_number : undefined
}

const idsEqual = (left: Id | undefined, right: Id | undefined) =>
  left !== undefined && right !== undefined && String(left) === String(right)

const requireId = (value: Id | undefined, label: string): Id => {
  if (value === undefined) {
    throw new Error(`Missing ${label}`)
  }

  return value
}

const getRoundOrder = (roundName: string) => {
  const normalizedName = roundName.toLowerCase()
  if (normalizedName.includes('first')) return 10
  if (normalizedName.includes('round of 16')) return 20
  if (normalizedName.includes('quarter')) return 30
  if (normalizedName.includes('semi')) return 40
  if (normalizedName.includes('bronze')) return 45
  if (normalizedName.includes('final')) return 50

  return 100
}

const buildSetScore = (sets: BracketMatchSet[]) => {
  if (sets.length === 0) {
    return undefined
  }

  return sets
    .map((set) => `${set.participant_a_score ?? 0}-${set.participant_b_score ?? 0}`)
    .join(', ')
}

const buildParticipant = (
  value: RelationshipDoc | Id | null | undefined,
  winnerId: Id | undefined,
): BracketParticipant => {
  const participantId = getRelationshipId(value)

  return {
    id: participantId,
    label: getRelationshipLabel(value),
    seed: getRelationshipSeed(value),
    isWinner: idsEqual(participantId, winnerId),
    isPlaceholder: !participantId,
  }
}

export const detectSingleEliminationChampion = (
  rounds: BracketRound[],
): BracketChampion => {
  if (rounds.length === 0) {
    return {
      status: 'pending',
      reason: 'No bracket rounds exist yet.',
    }
  }

  const lastRound = rounds[rounds.length - 1]
  const finalMatch = lastRound.matches[0]
  if (!finalMatch) {
    return {
      status: 'pending',
      round_name: lastRound.name,
      reason: 'The last round has no match yet.',
    }
  }

  if (finalMatch.status !== 'result_published') {
    return {
      status: 'pending',
      match_id: finalMatch.id,
      match_number: finalMatch.match_number,
      round_name: finalMatch.round_name,
      reason: 'Champion is pending until the last-round result is published.',
    }
  }

  const winner =
    finalMatch.participant_a.isWinner ? finalMatch.participant_a
    : finalMatch.participant_b.isWinner ? finalMatch.participant_b
    : null

  if (!winner || !winner.id) {
    return {
      status: 'pending',
      match_id: finalMatch.id,
      match_number: finalMatch.match_number,
      round_name: finalMatch.round_name,
      reason: 'Champion is pending because the last-round match has no winner.',
    }
  }

  return {
    status: 'decided',
    entry_id: winner.id,
    label: winner.label,
    seed: winner.seed,
    match_id: finalMatch.id,
    match_number: finalMatch.match_number,
    round_name: finalMatch.round_name,
    reason: 'Champion detected from the published last-round match winner.',
  }
}

export const buildSingleEliminationBracketLayout = async (
  payload: Payload,
  stageId: Id,
): Promise<{
  bracketData: SingleEliminationBracketData
  seedConfig: BracketSeedConfig
  eventId: Id
  categoryId: Id
  stageId: Id
}> => {
  const stage = (await payload.findByID({
    collection: 'stages',
    id: stageId,
    depth: 1,
  })) as BracketStage

  if (stage.stage_type !== 'single_elimination') {
    throw new Error('Only single_elimination stages are supported by this bracket builder.')
  }

  const actualStageId = requireId(stage.id, 'stage id')
  const eventId = getRelationshipId(stage.event_id)
  const categoryId = getRelationshipId(stage.category_id)
  if (!eventId || !categoryId) {
    throw new Error('Bracket stage is missing event or category relationship.')
  }

  const matchesResult = await payload.find({
    collection: 'matches',
    depth: 1,
    limit: 200,
    sort: ['scheduled_start_at', 'match_number'],
    where: {
      stage_id: {
        equals: stageId,
      },
    },
  })
  const matches = matchesResult.docs as BracketMatch[]
  const rounds = new Map<string, BracketMatchCard[]>()
  const entryIds = new Set<string>()

  for (const match of matches) {
    const matchSets = await payload.find({
      collection: 'match-sets',
      depth: 0,
      limit: 50,
      sort: 'set_number',
      where: {
        match_id: {
          equals: match.id,
        },
      },
    })
    const roundName = match.round_name || 'Single Elimination'
    const winnerId = getRelationshipId(match.winner_entry_id)
    const participantAId = getRelationshipId(match.participant_a_entry_id)
    const participantBId = getRelationshipId(match.participant_b_entry_id)

    if (participantAId) entryIds.add(String(participantAId))
    if (participantBId) entryIds.add(String(participantBId))

    const roundMatches = rounds.get(roundName) || []
    roundMatches.push({
      id: match.id,
      match_number: match.match_number,
      round_name: roundName,
      scheduled_start_at: match.scheduled_start_at || undefined,
      status: match.status,
      winner_entry_id: winnerId,
      score_summary: match.score_summary || undefined,
      set_score: buildSetScore(matchSets.docs as unknown as BracketMatchSet[]),
      detail_href: `/matches/${match.match_number}`,
      participant_a: buildParticipant(match.participant_a_entry_id, winnerId),
      participant_b: buildParticipant(match.participant_b_entry_id, winnerId),
    })
    rounds.set(roundName, roundMatches)
  }

  const bracketRounds = Array.from(rounds.entries())
    .map(([name, roundMatches]) => ({
      name,
      order: getRoundOrder(name),
      matches: roundMatches.sort((left, right) =>
        left.match_number.localeCompare(right.match_number, 'en'),
      ),
    }))
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order
      }

      return left.name.localeCompare(right.name, 'en')
    })

  return {
    eventId,
    categoryId,
    stageId: actualStageId,
    bracketData: {
      format: 'single_elimination',
      rounds: bracketRounds,
      champion: detectSingleEliminationChampion(bracketRounds),
      generated_at: new Date().toISOString(),
    },
    seedConfig: {
      entry_count: entryIds.size,
      match_count: matches.length,
      round_count: bracketRounds.length,
      stage_type: stage.stage_type,
    },
  }
}

export const recalculateSingleEliminationBracket = async (
  payload: Payload,
  input: RecalculateBracketInput,
): Promise<RecalculateBracketResult> => {
  const layout = await buildSingleEliminationBracketLayout(payload, input.stageId)
  const bracketKey = `${layout.eventId}:${layout.categoryId}:${layout.stageId}:single_elimination`
  const existing = await payload.find({
    collection: 'brackets',
    depth: 0,
    limit: 1,
    where: {
      bracket_key: {
        equals: bracketKey,
      },
    },
  })
  const data = {
    bracket_key: bracketKey,
    event_id: layout.eventId,
    category_id: layout.categoryId,
    stage_id: layout.stageId,
    name: 'Single Elimination Bracket',
    format: 'single_elimination',
    seed_config: layout.seedConfig,
    bracket_data: layout.bracketData,
    status: layout.bracketData.rounds.length > 0 ? 'published' : 'draft',
  }
  const bracket =
    existing.docs[0] ?
      await payload.update({
        collection: 'brackets',
        id: existing.docs[0].id,
        data,
      })
    : await payload.create({
        collection: 'brackets',
        data,
      })

  return {
    bracketId: bracket.id,
    matchCount: layout.seedConfig.match_count,
    roundCount: layout.seedConfig.round_count,
  }
}
