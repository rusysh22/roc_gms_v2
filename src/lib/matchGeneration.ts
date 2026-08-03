import type { Payload } from 'payload'

export type MatchGenerationEntry = {
  id: string | number
  display_name: string
  seed_number?: number | null
  status?: string | null
}

export type GeneratedPairing = {
  participantA: MatchGenerationEntry
  participantB: MatchGenerationEntry
  roundName: string
  sequence: number
}

const inactiveEntryStatuses = new Set(['withdrawn', 'disqualified'])

export const getSchedulableEntries = (entries: MatchGenerationEntry[]) => {
  return entries
    .filter((entry) => !inactiveEntryStatuses.has(entry.status || ''))
    .sort((entryA, entryB) => {
      const seedA = entryA.seed_number ?? Number.MAX_SAFE_INTEGER
      const seedB = entryB.seed_number ?? Number.MAX_SAFE_INTEGER

      if (seedA !== seedB) {
        return seedA - seedB
      }

      return entryA.display_name.localeCompare(entryB.display_name)
    })
}

export const generateRoundRobinPairings = (
  entries: MatchGenerationEntry[],
  roundNamePrefix = 'Round Robin',
) => {
  const schedulableEntries = getSchedulableEntries(entries)
  const pairings: GeneratedPairing[] = []
  let sequence = 1

  for (let entryAIndex = 0; entryAIndex < schedulableEntries.length; entryAIndex += 1) {
    for (let entryBIndex = entryAIndex + 1; entryBIndex < schedulableEntries.length; entryBIndex += 1) {
      pairings.push({
        participantA: schedulableEntries[entryAIndex],
        participantB: schedulableEntries[entryBIndex],
        roundName: `${roundNamePrefix} Match ${sequence}`,
        sequence,
      })
      sequence += 1
    }
  }

  return pairings
}

// Circle-method round-robin scheduling: every entry plays exactly one match per round (a genuine
// round-by-round schedule), unlike the flat all-pairs `generateRoundRobinPairings` above which has
// no round structure at all. Extracted/generalized from the reference implementation in
// src/scripts/populateNusantaraGrandGames.ts's inline `generateRoundRobin` helper (group_stage_to_knockout
// item 5), which already proved this out for group-scoped round-robin fixtures. Kept alongside the
// flat version rather than replacing it, so the existing plain `round_robin` wizard path is untouched.
export const generateRoundRobinRounds = (
  entries: MatchGenerationEntry[],
  roundNamePrefix = 'Round Robin Round',
) => {
  const ordered = getSchedulableEntries(entries)
  // Odd entry counts get a "bye" slot (null) rotated through like any other participant - whichever
  // real entry is paired against it that round simply sits out, and its pairing is dropped below.
  const rotating: Array<MatchGenerationEntry | null> = ordered.length % 2 === 0 ? [...ordered] : [...ordered, null]
  const pairings: GeneratedPairing[] = []
  let sequence = 1

  for (let roundIndex = 0; roundIndex < rotating.length - 1; roundIndex += 1) {
    for (let position = 0; position < rotating.length / 2; position += 1) {
      const participantA = rotating[position]
      const participantB = rotating[rotating.length - 1 - position]
      if (participantA && participantB) {
        pairings.push({
          participantA,
          participantB,
          roundName: `${roundNamePrefix} ${roundIndex + 1}`,
          sequence,
        })
        sequence += 1
      }
    }
    // Standard circle-method rotation: keep position 0 fixed, rotate everyone else by one slot.
    const fixed = rotating[0]
    const moved = rotating.pop()!
    rotating.splice(1, 0, moved)
    rotating[0] = fixed
  }

  return pairings
}

export const generateSingleEliminationFirstRound = (
  entries: MatchGenerationEntry[],
  roundName = 'First Round',
) => {
  const schedulableEntries = getSchedulableEntries(entries)
  const bracketSize = getNextPowerOfTwo(schedulableEntries.length)
  const byeCount = bracketSize - schedulableEntries.length
  const playingEntries = schedulableEntries.slice(byeCount)
  const pairings: GeneratedPairing[] = []

  for (let index = 0; index < Math.floor(playingEntries.length / 2); index += 1) {
    const participantA = playingEntries[index]
    const participantB = playingEntries[playingEntries.length - 1 - index]

    pairings.push({
      participantA,
      participantB,
      roundName,
      sequence: index + 1,
    })
  }

  return pairings
}

export const getMatchPairKey = (
  participantAId: string | number,
  participantBId: string | number,
) => {
  return [String(participantAId), String(participantBId)].sort().join(':')
}

export const getNextPowerOfTwo = (value: number) => {
  if (value <= 1) {
    return 1
  }

  return 2 ** Math.ceil(Math.log2(value))
}

// Standard tournament seed-slot order (the same placement used by professional single-elimination
// draws): for a bracket of `size`, returns the 1-based seed rank occupying each of the `size` flat
// slots, so that seed 1 and seed 2 can only meet in the final, seeds 1-4 can only meet from the
// semifinal onward, and so on. Doubling recurrence: order(2) = [1, 2]; order(2n) interleaves
// order(n) with its "mirror" (2n + 1 - seed). E.g. order(8) = [1, 8, 4, 5, 2, 7, 3, 6].
export const getStandardSeedSlotOrder = (bracketSize: number): number[] => {
  if (bracketSize <= 1) {
    return [1]
  }

  let order = [1, 2]
  let size = 2
  while (size < bracketSize) {
    const nextSize = size * 2
    order = order.flatMap((seed) => [seed, nextSize + 1 - seed])
    size = nextSize
  }

  return order
}

export type BracketRoundMatchPlan = {
  round: number
  matchIndex: number
  participantA: MatchGenerationEntry | null
  participantB: MatchGenerationEntry | null
  // Only ever true in round 0: exactly one side has no seed slot filled (a genuine bye), so the
  // other side auto-advances without playing. From round 1 onward every slot is fed by a previous
  // match's winner, so a still-unplayed match is never itself "a bye" even if both of its feeder
  // matches already resolved to known winners (see the two-byes-into-one-match branch below).
  isBye: boolean
}

// Builds the full bracket topology up front - every round, not just the first - using standard
// seed placement so bye recipients are spread across separate quarters/halves and only ever meet a
// previous round's winner, never another bye recipient, until a later round makes that a genuine
// match (fixes the "byes paired against each other" defect: see AUDIT_E2E BRK-01).
export const buildSingleEliminationBracketPlan = (
  entries: MatchGenerationEntry[],
): BracketRoundMatchPlan[] => {
  const schedulableEntries = getSchedulableEntries(entries)
  const bracketSize = getNextPowerOfTwo(schedulableEntries.length)
  if (bracketSize <= 1) {
    return []
  }

  const totalRounds = Math.log2(bracketSize)
  const seedOrder = getStandardSeedSlotOrder(bracketSize)
  const entryBySeedRank = (rank: number): MatchGenerationEntry | null =>
    rank <= schedulableEntries.length ? schedulableEntries[rank - 1] : null

  const plans: BracketRoundMatchPlan[] = []
  let currentRoundSlots: (MatchGenerationEntry | null)[] = seedOrder.map(entryBySeedRank)

  for (let round = 0; round < totalRounds; round += 1) {
    const matchCount = currentRoundSlots.length / 2
    const nextRoundSlots: (MatchGenerationEntry | null)[] = []

    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      const participantA = currentRoundSlots[matchIndex * 2]
      const participantB = currentRoundSlots[matchIndex * 2 + 1]
      const isBye = round === 0 && (participantA === null) !== (participantB === null)

      plans.push({ round, matchIndex, participantA, participantB, isBye })
      // A resolved winner only cascades forward when this match is itself a bye - a real match
      // (even one where both participants are already known, e.g. two bye recipients drawn into
      // the same next-round slot) still has to be played before it produces a winner.
      nextRoundSlots.push(isBye ? (participantA ?? participantB) : null)
    }

    currentRoundSlots = nextRoundSlots
  }

  return plans
}

// Round names/prefixes counting back from the Final, applied to every round including the first -
// so an 8-bracket's opening round is correctly labelled "Quarterfinal" (not a generic "First
// Round" regardless of bracket size). Exported so src/lib/doubleElimination.ts's winners-bracket
// half (structurally identical to single-elimination) can reuse the exact same naming instead of
// re-deriving it.
export const roundNameForRemaining = (roundsRemaining: number) => {
  if (roundsRemaining <= 0) return 'Final'
  if (roundsRemaining === 1) return 'Semifinal'
  if (roundsRemaining === 2) return 'Quarterfinal'
  if (roundsRemaining === 3) return 'Round of 16'
  return `Round of ${2 ** (roundsRemaining + 1)}`
}
export const roundPrefixForRemaining = (roundsRemaining: number) => {
  if (roundsRemaining <= 0) return 'final'
  if (roundsRemaining === 1) return 'sf'
  if (roundsRemaining === 2) return 'qf'
  return `r${2 ** (roundsRemaining + 1)}`
}

export type CreateSingleEliminationBracketMatchesInput = {
  payload: Payload
  eventId: string | number
  eventSlug: string
  // A category's sport_id, whether read at depth 0 (a raw id) or depth 1+ (a populated Sport doc)
  // - Payload types relationship fields the same way regardless of query depth, so callers passing
  // `category.sport_id` straight through need this to accept both shapes.
  sportId: string | number | { id: string | number }
  categoryId: string | number
  categorySlug: string
  stageId: string | number
  entries: MatchGenerationEntry[]
  // Embedded verbatim into generation_key - defaults to the literal 'no-group' to exactly match
  // the key format the plain single_elimination wizard path has always used (see
  // generateMatchesAction), so re-running match generation for an existing category still matches
  // its own previously-created matches instead of silently creating duplicates.
  groupSegment?: string
  nextMatchNumber: (prefix: string) => string
}

export type CreateSingleEliminationBracketMatchesResult = {
  createdCount: number
  failedCount: number
}

// Builds every round of a single-elimination bracket for `entries` (round-by-round, so each match
// can record an explicit next_match_id/next_match_slot once its target match exists - AUDIT_E2E
// BRK-02) and standard seed placement/byes via buildSingleEliminationBracketPlan (AUDIT_E2E BRK-01).
// Extracted from generateMatchesAction's inline single_elimination branch so a "promote qualifiers
// to knockout" flow (group_stage_to_knockout, item 5) can reuse the exact same bracket-building
// logic instead of duplicating ~90 lines of bye/advancement wiring that has already needed bug
// fixes once. `entries` order does NOT determine seeding - buildSingleEliminationBracketPlan sorts
// by each entry's `seed_number` internally, so callers must set that field to their desired rank.
export const createSingleEliminationBracketMatches = async ({
  payload,
  eventId,
  eventSlug,
  sportId,
  categoryId,
  categorySlug,
  stageId,
  entries,
  groupSegment = 'no-group',
  nextMatchNumber,
}: CreateSingleEliminationBracketMatchesInput): Promise<CreateSingleEliminationBracketMatchesResult> => {
  const sportIdValue = Number(typeof sportId === 'object' ? sportId.id : sportId)
  const schedulableEntries = getSchedulableEntries(entries)
  const bracketSize = getNextPowerOfTwo(schedulableEntries.length)
  const totalRounds = bracketSize > 1 ? Math.log2(bracketSize) : 0
  const plan = buildSingleEliminationBracketPlan(schedulableEntries)
  const matchIdByRoundAndIndex = new Map<string, string | number>()

  let createdCount = 0
  let failedCount = 0

  for (let round = 0; round < totalRounds; round += 1) {
    const roundsRemaining = totalRounds - 1 - round
    const roundName = roundNameForRemaining(roundsRemaining)
    const roundPrefix = roundPrefixForRemaining(roundsRemaining)
    const roundPlans = plan.filter((matchPlan) => matchPlan.round === round)

    for (const matchPlan of roundPlans) {
      const generationKey = `${eventSlug}:${categorySlug}:${stageId}:${groupSegment}:single_elimination:r${round}:m${matchPlan.matchIndex}`
      const existingMatch = await payload.find({
        collection: 'matches',
        depth: 0,
        limit: 1,
        where: { generation_key: { equals: generationKey } },
      })

      let matchId = existingMatch.docs[0]?.id

      if (!matchId) {
        const byeWinnerId = matchPlan.isBye
          ? Number((matchPlan.participantA ?? matchPlan.participantB)!.id)
          : undefined
        try {
          const created = await payload.create({
            collection: 'matches',
            data: {
              event_id: Number(eventId),
              sport_id: sportIdValue,
              category_id: Number(categoryId),
              stage_id: Number(stageId),
              round_name: roundName,
              match_number: nextMatchNumber(roundPrefix),
              participant_a_entry_id:
                matchPlan.participantA != null ? Number(matchPlan.participantA.id) : undefined,
              participant_b_entry_id:
                matchPlan.participantB != null ? Number(matchPlan.participantB.id) : undefined,
              // A bye auto-resolves: the sole participant is the winner and the match is an
              // auditable walkover record (GEN-02) instead of silently vanishing.
              status: matchPlan.isBye ? 'walkover' : 'ready_for_scheduling',
              winner_entry_id: byeWinnerId,
              score_summary: matchPlan.isBye ? 'Bye' : undefined,
              generation_source: 'single_elimination',
              generation_key: generationKey,
              is_public: true,
              documentation_status: matchPlan.isBye ? 'not_required' : 'not_started',
            },
          })
          matchId = created.id
          createdCount += 1
        } catch {
          // A concurrent duplicate submission or a rare match_number/generation_key race can fail
          // a single match - keep generating the rest. Re-running safely skips already-created
          // matches via the generation_key check above.
          failedCount += 1
          continue
        }
      }

      matchIdByRoundAndIndex.set(`${round}:${matchPlan.matchIndex}`, matchId)

      if (round > 0) {
        const parentRound = round - 1
        const parentASlotId = matchIdByRoundAndIndex.get(`${parentRound}:${matchPlan.matchIndex * 2}`)
        const parentBSlotId = matchIdByRoundAndIndex.get(`${parentRound}:${matchPlan.matchIndex * 2 + 1}`)

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

  return { createdCount, failedCount }
}

export type GroupStandingForSeeding = {
  entryId: string | number
  displayName: string
  groupId: string | number
  groupLabel: string
  rankInGroup: number
}

export type CrossGroupQualifier = GroupStandingForSeeding & {
  seedRank: number
}

// Cross-group knockout seeding (group_stage_to_knockout, item 5): flattens each group's qualifiers
// into one bracket seed order by qualifying tier - every group's rank-1 qualifier first (in group
// order), then every rank-2 qualifier, etc. - with NO snake/reverse between tiers. Verified by
// hand: for the common 2-groups-of-2 case this produces seed order [A1, B1, A2, B2], which through
// getStandardSeedSlotOrder(4) = [1,4,2,3] pairs (seed1,seed4) and (seed2,seed3) - i.e. exactly
// "A1 vs B2, B1 vs A2", the textbook cross-group knockout draw. Known, accepted limitation: for 3+
// groups this does not generally avoid same-group pairings (see `findSameGroupFirstRoundPairings`)
// - solving that in general is a much harder combinatorial problem than this feature warrants. The
// mitigation is surfacing a warning and letting the admin manually reorder (QualifierSeedOrder UI)
// rather than fully solving it here.
export const computeCrossGroupQualifierOrder = (
  qualifiersByGroup: GroupStandingForSeeding[][],
): CrossGroupQualifier[] => {
  const maxTier = qualifiersByGroup.reduce((max, group) => Math.max(max, group.length), 0)
  const ordered: CrossGroupQualifier[] = []
  let seedRank = 1

  for (let tier = 0; tier < maxTier; tier += 1) {
    for (const group of qualifiersByGroup) {
      const qualifier = group[tier]
      if (qualifier) {
        ordered.push({ ...qualifier, seedRank })
        seedRank += 1
      }
    }
  }

  return ordered
}

// Given a seed-ordered qualifier list, checks whether the standard bracket seed-slot placement
// (the same placement createSingleEliminationBracketMatches will actually use) pits two entries
// from the same group against each other in the opening round.
export const findSameGroupFirstRoundPairings = (
  orderedQualifiers: CrossGroupQualifier[],
): Array<[CrossGroupQualifier, CrossGroupQualifier]> => {
  const bracketSize = getNextPowerOfTwo(orderedQualifiers.length)
  if (bracketSize <= 1) {
    return []
  }

  const seedSlotOrder = getStandardSeedSlotOrder(bracketSize)
  const byRank = new Map(orderedQualifiers.map((qualifier) => [qualifier.seedRank, qualifier]))
  const collisions: Array<[CrossGroupQualifier, CrossGroupQualifier]> = []

  for (let index = 0; index < seedSlotOrder.length; index += 2) {
    const a = byRank.get(seedSlotOrder[index])
    const b = byRank.get(seedSlotOrder[index + 1])
    if (a && b && String(a.groupId) === String(b.groupId)) {
      collisions.push([a, b])
    }
  }

  return collisions
}
