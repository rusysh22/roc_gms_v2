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

const getNextPowerOfTwo = (value: number) => {
  if (value <= 1) {
    return 1
  }

  return 2 ** Math.ceil(Math.log2(value))
}
