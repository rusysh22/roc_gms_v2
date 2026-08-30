import { describe, expect, it } from 'vitest'

import {
  getAllowedTransitions,
  isScoreableStatus,
  isValidTransition,
  SCOREABLE_MATCH_STATUSES,
} from './matchLifecycle'

describe('match lifecycle', () => {
  it('lets an officer start a match straight from scheduled or published', () => {
    // Regression: nothing in the app advances a match into check_in_open / ready_to_start, so a
    // scheduled/published match had no path to "ongoing" and every Live Score point tap failed.
    for (const status of ['scheduled', 'published', 'check_in_open', 'ready_to_start']) {
      expect(isValidTransition(status, 'ongoing')).toBe(true)
      const startMatch = getAllowedTransitions(status).find((t) => t.to === 'ongoing')
      expect(startMatch?.label).toBe('Start Match')
    }
  })

  it('does not allow starting a match that is already over', () => {
    for (const status of ['finished', 'result_published', 'walkover', 'cancelled']) {
      expect(isValidTransition(status, 'ongoing')).toBe(false)
    }
  })

  it('keeps the normal in-play transitions intact', () => {
    expect(isValidTransition('ongoing', 'paused')).toBe(true)
    expect(isValidTransition('paused', 'ongoing')).toBe(true)
    expect(isValidTransition('ongoing', 'finished')).toBe(true)
    expect(isValidTransition('finished', 'result_published')).toBe(true)
  })

  it('marks exactly the in-play statuses as scoreable', () => {
    expect([...SCOREABLE_MATCH_STATUSES]).toEqual(['ongoing', 'paused', 'under_review'])
    expect(isScoreableStatus('ongoing')).toBe(true)
    expect(isScoreableStatus('scheduled')).toBe(false)
    expect(isScoreableStatus('finished')).toBe(false)
  })
})
