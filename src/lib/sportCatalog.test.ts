import { describe, expect, it } from 'vitest'

import { SPORT_CATALOG, getCatalogSport, searchCatalog } from './sportCatalog'

describe('SPORT_CATALOG', () => {
  it('has a unique key per sport', () => {
    const keys = SPORT_CATALOG.map((sport) => sport.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has unique event names within each sport (guards against slug collisions on add)', () => {
    for (const sport of SPORT_CATALOG) {
      const names = sport.events.map((event) => event.name)
      expect(new Set(names).size, `${sport.name} has duplicate event names`).toBe(names.length)
    }
  })

  it('gives every sport at least one event and a duration-bearing ruleset', () => {
    for (const sport of SPORT_CATALOG) {
      expect(sport.events.length).toBeGreaterThan(0)
      expect(sport.ruleset.defaultDurationMinutes).toBeGreaterThan(0)
    }
  })
})

describe('getCatalogSport', () => {
  it('finds a sport by key', () => {
    expect(getCatalogSport('badminton')?.name).toBe('Badminton')
  })

  it('returns undefined for an unknown key', () => {
    expect(getCatalogSport('quidditch')).toBeUndefined()
  })
})

describe('searchCatalog', () => {
  it('returns the full catalog for an empty query', () => {
    expect(searchCatalog('')).toHaveLength(SPORT_CATALOG.length)
  })

  it('filters case-insensitively by name', () => {
    const results = searchCatalog('BADMIN')
    expect(results).toHaveLength(1)
    expect(results[0].key).toBe('badminton')
  })
})
