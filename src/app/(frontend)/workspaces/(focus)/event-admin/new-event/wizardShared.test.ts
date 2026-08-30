import { describe, expect, it } from 'vitest'

import { CLEARABLE_FIXTURE_STATUSES, summarizeCategoryFixtures } from './wizardShared'

describe('summarizeCategoryFixtures', () => {
  it('counts fixtures per category', () => {
    const summary = summarizeCategoryFixtures([
      { category_id: 1, status: 'ready_for_scheduling' },
      { category_id: 1, status: 'scheduled' },
      { category_id: 2, status: 'draft' },
    ])
    expect(summary.get('1')).toEqual({ count: 2, locked: false })
    expect(summary.get('2')).toEqual({ count: 1, locked: false })
  })

  it('locks a category once any match moves past the clearable states', () => {
    const summary = summarizeCategoryFixtures([
      { category_id: 1, status: 'scheduled' },
      { category_id: 1, status: 'ongoing' },
    ])
    expect(summary.get('1')?.locked).toBe(true)
  })

  it('locks a category once a match has a winner even if its status is still clearable', () => {
    const summary = summarizeCategoryFixtures([
      { category_id: 1, status: 'scheduled', winner_entry_id: 42 },
    ])
    expect(summary.get('1')?.locked).toBe(true)
  })

  it('treats every clearable status as unlocked', () => {
    for (const status of CLEARABLE_FIXTURE_STATUSES) {
      const summary = summarizeCategoryFixtures([{ category_id: 9, status }])
      expect(summary.get('9')?.locked).toBe(false)
    }
  })

  it('returns an empty map for no matches', () => {
    expect(summarizeCategoryFixtures([]).size).toBe(0)
  })
})
