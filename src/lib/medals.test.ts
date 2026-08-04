import { describe, expect, it } from 'vitest'

import { buildMedalTally, type MedalTallyRecord } from './medals'

// MSG-02: buildMedalTally is the pure aggregation/ranking half of medal tally - the DB-touching
// derivation half (recalculateMedalsForCategory) was verified against a live isolated dataset
// during development (single-elimination gold/silver/bronze, round-robin standings_rank, manual
// override persistence) since it isn't practical to cover with this pure-function suite.

const record = (clubId: string, clubLabel: string, medal: MedalTallyRecord['medal']): MedalTallyRecord => ({
  clubId,
  clubLabel,
  medal,
  weight: 1,
})

const defaultOptions = { method: 'gold_first' as const, pointsGold: 3, pointsSilver: 2, pointsBronze: 1 }

describe('buildMedalTally', () => {
  it('ranks gold_first by gold, then silver, then bronze', () => {
    const records: MedalTallyRecord[] = [
      record('a', 'Alpha', 'silver'),
      record('a', 'Alpha', 'silver'),
      record('a', 'Alpha', 'bronze'),
      record('b', 'Bravo', 'gold'),
      record('b', 'Bravo', 'bronze'),
    ]

    const tally = buildMedalTally(records, defaultOptions)

    // Bravo has 1 gold (beats Alpha's 0 gold) despite Alpha having more total medals (3 vs 2) -
    // gold_first never falls back to raw medal count.
    expect(tally.map((row) => row.clubLabel)).toEqual(['Bravo', 'Alpha'])
    expect(tally[0]).toMatchObject({ gold: 1, silver: 0, bronze: 1, total: 2, rank: 1 })
    expect(tally[1]).toMatchObject({ gold: 0, silver: 2, bronze: 1, total: 3, rank: 2 })
  })

  it('breaks a gold tie with silver, then bronze', () => {
    const records: MedalTallyRecord[] = [
      record('a', 'Alpha', 'gold'),
      record('a', 'Alpha', 'bronze'),
      record('b', 'Bravo', 'gold'),
      record('b', 'Bravo', 'silver'),
    ]

    const tally = buildMedalTally(records, defaultOptions)

    expect(tally.map((row) => row.clubLabel)).toEqual(['Bravo', 'Alpha'])
  })

  it('ranks weighted_points by total points, gold as first tiebreak', () => {
    const records: MedalTallyRecord[] = [
      record('a', 'Alpha', 'bronze'),
      record('a', 'Alpha', 'bronze'),
      record('a', 'Alpha', 'bronze'),
      record('b', 'Bravo', 'gold'),
    ]

    // 3 bronze * 1pt = 3pts vs 1 gold * 3pts = 3pts - equal points, gold count breaks the tie.
    const tally = buildMedalTally(records, { method: 'weighted_points', pointsGold: 3, pointsSilver: 2, pointsBronze: 1 })

    expect(tally.map((row) => row.clubLabel)).toEqual(['Bravo', 'Alpha'])
    expect(tally[0].points).toBe(3)
    expect(tally[1].points).toBe(3)
  })

  it('gives genuinely tied rows the same rank, and the next row skips accordingly', () => {
    const records: MedalTallyRecord[] = [
      record('a', 'Alpha', 'gold'),
      record('b', 'Bravo', 'gold'),
      record('c', 'Charlie', 'silver'),
    ]

    const tally = buildMedalTally(records, defaultOptions)

    expect(tally[0].rank).toBe(1)
    expect(tally[1].rank).toBe(1)
    expect(tally[2].rank).toBe(3)
  })

  it('applies medal_weight by summing the weight field, not counting records', () => {
    const records: MedalTallyRecord[] = [{ clubId: 'a', clubLabel: 'Alpha', medal: 'gold', weight: 2 }]

    const tally = buildMedalTally(records, defaultOptions)

    expect(tally[0].gold).toBe(2)
  })

  it('returns an empty tally for no records', () => {
    expect(buildMedalTally([], defaultOptions)).toEqual([])
  })

  it('sorts alphabetically when every ranked component is equal', () => {
    const records: MedalTallyRecord[] = [record('z', 'Zulu', 'gold'), record('a', 'Alpha', 'gold')]

    const tally = buildMedalTally(records, defaultOptions)

    expect(tally.map((row) => row.clubLabel)).toEqual(['Alpha', 'Zulu'])
    expect(tally[0].rank).toBe(1)
    expect(tally[1].rank).toBe(1)
  })
})
