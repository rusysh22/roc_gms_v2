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
