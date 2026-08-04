import { describe, expect, it } from 'vitest'

import {
  buildExistingOccupancy,
  computeSchedulePlan,
  getExpandedIdentities,
  type CategoryRulesetInfo,
  type OptimizerCourt,
  type OptimizerMatch,
  type RosterIndex,
  type SchedulePlanParams,
} from './scheduleOptimizer'

// Mirrors scheduleOptimizer.ts's own local-time slot construction, so assertions compare against
// the same instant the code under test actually computes regardless of the test runner's time
// zone (dateAtMinute is not exported - these tests only assert observable behavior).
const localInstant = (dayKey: string, minuteOfDay: number): number => {
  const date = new Date(`${dayKey}T00:00:00`)
  date.setMinutes(date.getMinutes() + minuteOfDay)
  return date.getTime()
}

const baseParams: SchedulePlanParams = {
  rangeStartDate: '2026-08-10',
  rangeEndDate: '2026-08-10',
  dailyStartMinute: 8 * 60,
  dailyEndMinute: 18 * 60,
  slotStepMinutes: 15,
  defaultDurationMinutes: 30,
  defaultMinRestMinutes: 15,
}

const entry = (id: number, entryType: string, extra: Record<string, unknown> = {}) => ({
  id,
  entry_type: entryType,
  ...extra,
})

const match = (overrides: Partial<OptimizerMatch> & { id: number; match_number: string }): OptimizerMatch => ({
  sport_id: 1,
  category_id: 1,
  participant_a_entry_id: null,
  participant_b_entry_id: null,
  ...overrides,
})

const court = (overrides: Partial<OptimizerCourt> & { id: number }): OptimizerCourt => ({
  venue_id: 1,
  is_active: true,
  ...overrides,
})

describe('getExpandedIdentities', () => {
  it('keys individual entries on player_id', () => {
    const identities = getExpandedIdentities(entry(1, 'individual', { player_id: 501 }), new Map())
    expect(identities).toEqual(new Set(['entry:1', 'player:501']))
  })

  it('keys club entries on club_id', () => {
    const identities = getExpandedIdentities(entry(2, 'club', { club_id: 601 }), new Map())
    expect(identities).toEqual(new Set(['entry:2', 'club:601']))
  })

  it('expands team/pair entries to every active roster player', () => {
    const rosterIndex: RosterIndex = new Map([['701', ['501', '502']]])
    const identities = getExpandedIdentities(entry(3, 'team', { team_id: 701 }), rosterIndex)
    expect(identities).toEqual(new Set(['entry:3', 'team:701', 'player:501', 'player:502']))
  })

  it('returns an empty set for null/undefined entries', () => {
    expect(getExpandedIdentities(null, new Map())).toEqual(new Set())
    expect(getExpandedIdentities(undefined, new Map())).toEqual(new Set())
  })
})

describe('computeSchedulePlan', () => {
  const emptyRulesets = new Map<string, CategoryRulesetInfo>()
  const emptyRoster: RosterIndex = new Map()

  it('places two independent matches at the earliest available slot on separate courts', () => {
    const candidates = [
      match({ id: 1, match_number: 'M1' }),
      match({ id: 2, match_number: 'M2' }),
    ]
    const courts = [court({ id: 10 }), court({ id: 11 })]

    const plan = computeSchedulePlan({
      candidates,
      courts,
      rosterIndex: emptyRoster,
      categoryRulesets: emptyRulesets,
      existingCourtOccupancy: new Map(),
      existingIdentityOccupancy: new Map(),
      params: baseParams,
    })

    expect(plan.unplaced).toEqual([])
    expect(plan.assignments).toHaveLength(2)
    // Both land on the very first slot (08:00) since they don't conflict with each other at all.
    const expectedFirstSlot = new Date(localInstant(baseParams.rangeStartDate, baseParams.dailyStartMinute)).toISOString()
    for (const assignment of plan.assignments) {
      expect(assignment.startAt).toBe(expectedFirstSlot)
    }
    expect(new Set(plan.assignments.map((a) => a.courtId))).toEqual(new Set([10, 11]))
  })

  it('never double-books a single court', () => {
    const candidates = [
      match({ id: 1, match_number: 'M1' }),
      match({ id: 2, match_number: 'M2' }),
    ]
    const courts = [court({ id: 10 })]

    const plan = computeSchedulePlan({
      candidates,
      courts,
      rosterIndex: emptyRoster,
      categoryRulesets: emptyRulesets,
      existingCourtOccupancy: new Map(),
      existingIdentityOccupancy: new Map(),
      params: baseParams,
    })

    expect(plan.unplaced).toEqual([])
    expect(plan.assignments).toHaveLength(2)
    const [first, second] = [...plan.assignments].sort((a, b) => a.startAt.localeCompare(b.startAt))
    // Second match must start no earlier than the first one's end (30-minute default duration).
    expect(new Date(second.startAt).getTime()).toBeGreaterThanOrEqual(new Date(first.endAt).getTime())
  })

  it('respects minimum rest time for the same participant across categories', () => {
    const sharedPlayer = entry(1, 'individual', { player_id: 501 })
    const candidates = [
      match({ id: 1, match_number: 'M1', category_id: 1, participant_a_entry_id: sharedPlayer }),
      match({ id: 2, match_number: 'M2', category_id: 2, participant_a_entry_id: sharedPlayer }),
    ]
    const courts = [court({ id: 10 }), court({ id: 11 })]
    const rulesets = new Map<string, CategoryRulesetInfo>([
      ['category:1', { minRestMinutes: 60 }],
      ['category:2', { minRestMinutes: 60 }],
    ])

    const plan = computeSchedulePlan({
      candidates,
      courts,
      rosterIndex: emptyRoster,
      categoryRulesets: rulesets,
      existingCourtOccupancy: new Map(),
      existingIdentityOccupancy: new Map(),
      params: baseParams,
    })

    expect(plan.assignments).toHaveLength(2)
    const [first, second] = [...plan.assignments].sort((a, b) => a.startAt.localeCompare(b.startAt))
    const gapMinutes = (new Date(second.startAt).getTime() - new Date(first.endAt).getTime()) / 60000
    expect(gapMinutes).toBeGreaterThanOrEqual(60)
  })

  // MSG-03: a stage-level ruleset override (e.g. a knockout stage's best-of-5 running longer than
  // its category's best-of-3 group stage) must win over the category-level default - this is what
  // resolveRulesetInfo's stage-key-first lookup exists for.
  it('uses a stage-level ruleset override duration in preference to the category default', () => {
    const candidates = [
      match({ id: 1, match_number: 'M1', category_id: 1, stage_id: 100 }),
      match({ id: 2, match_number: 'M2', category_id: 1, stage_id: 200 }),
    ]
    const courts = [court({ id: 10 })]
    const rulesets = new Map<string, CategoryRulesetInfo>([
      ['category:1', { defaultDurationMinutes: 30 }],
      ['stage:200', { defaultDurationMinutes: 90 }],
    ])

    const plan = computeSchedulePlan({
      candidates,
      courts,
      rosterIndex: emptyRoster,
      categoryRulesets: rulesets,
      existingCourtOccupancy: new Map(),
      existingIdentityOccupancy: new Map(),
      params: baseParams,
    })

    expect(plan.assignments).toHaveLength(2)
    const withoutOverride = plan.assignments.find((a) => a.matchId === 1)!
    const withOverride = plan.assignments.find((a) => a.matchId === 2)!
    const durationWithout = (new Date(withoutOverride.endAt).getTime() - new Date(withoutOverride.startAt).getTime()) / 60000
    const durationWith = (new Date(withOverride.endAt).getTime() - new Date(withOverride.startAt).getTime()) / 60000
    expect(durationWithout).toBe(30)
    expect(durationWith).toBe(90)
  })

  it('recognizes a shared roster player between an individual entry and a team entry (the core cross-category identity fix)', () => {
    const rosterIndex: RosterIndex = new Map([['700', ['501']]])
    const individualEntry = entry(1, 'individual', { player_id: 501 })
    const teamEntry = entry(2, 'team', { team_id: 700 })
    const candidates = [
      match({ id: 1, match_number: 'M1', category_id: 1, participant_a_entry_id: individualEntry }),
      match({ id: 2, match_number: 'M2', category_id: 2, participant_a_entry_id: teamEntry, participant_b_entry_id: entry(3, 'team', { team_id: 800 }) }),
    ]
    const courts = [court({ id: 10 }), court({ id: 11 })]
    const rulesets = new Map<string, CategoryRulesetInfo>([
      ['category:1', { minRestMinutes: 45 }],
      ['category:2', { minRestMinutes: 45 }],
    ])

    const plan = computeSchedulePlan({
      candidates,
      courts,
      rosterIndex,
      categoryRulesets: rulesets,
      existingCourtOccupancy: new Map(),
      existingIdentityOccupancy: new Map(),
      params: baseParams,
    })

    expect(plan.assignments).toHaveLength(2)
    const [first, second] = [...plan.assignments].sort((a, b) => a.startAt.localeCompare(b.startAt))
    const gapMinutes = (new Date(second.startAt).getTime() - new Date(first.endAt).getTime()) / 60000
    expect(gapMinutes).toBeGreaterThanOrEqual(45)
  })

  it('does NOT apply rest time between a team entry and a different team with no shared roster player', () => {
    const rosterIndex: RosterIndex = new Map([
      ['700', ['501']],
      ['800', ['502']],
    ])
    const candidates = [
      match({ id: 1, match_number: 'M1', category_id: 1, participant_a_entry_id: entry(1, 'team', { team_id: 700 }) }),
      match({ id: 2, match_number: 'M2', category_id: 2, participant_a_entry_id: entry(2, 'team', { team_id: 800 }) }),
    ]
    const courts = [court({ id: 10 }), court({ id: 11 })]
    const rulesets = new Map<string, CategoryRulesetInfo>([
      ['category:1', { minRestMinutes: 60 }],
      ['category:2', { minRestMinutes: 60 }],
    ])

    const plan = computeSchedulePlan({
      candidates,
      courts,
      rosterIndex,
      categoryRulesets: rulesets,
      existingCourtOccupancy: new Map(),
      existingIdentityOccupancy: new Map(),
      params: baseParams,
    })

    expect(plan.assignments).toHaveLength(2)
    // No shared identity - both can start at the very first slot on their own courts.
    const expectedFirstSlot = new Date(localInstant(baseParams.rangeStartDate, baseParams.dailyStartMinute)).toISOString()
    for (const assignment of plan.assignments) {
      expect(assignment.startAt).toBe(expectedFirstSlot)
    }
  })

  it('prefers a featured court for a featured match', () => {
    const candidates = [match({ id: 1, match_number: 'M1', is_featured: true })]
    const courts = [court({ id: 10, is_featured: false }), court({ id: 11, is_featured: true })]

    const plan = computeSchedulePlan({
      candidates,
      courts,
      rosterIndex: emptyRoster,
      categoryRulesets: emptyRulesets,
      existingCourtOccupancy: new Map(),
      existingIdentityOccupancy: new Map(),
      params: baseParams,
    })

    expect(plan.assignments).toHaveLength(1)
    expect(plan.assignments[0].courtId).toBe(11)
  })

  it('only offers a sport-scoped court to matches of that sport', () => {
    const candidates = [match({ id: 1, match_number: 'M1', sport_id: 2 })]
    const courts = [court({ id: 10, sport_id: 1 })]

    const plan = computeSchedulePlan({
      candidates,
      courts,
      rosterIndex: emptyRoster,
      categoryRulesets: emptyRulesets,
      existingCourtOccupancy: new Map(),
      existingIdentityOccupancy: new Map(),
      params: baseParams,
    })

    expect(plan.assignments).toEqual([])
    expect(plan.unplaced).toHaveLength(1)
    expect(plan.unplaced[0].reason).toContain('No active court')
  })

  it('marks a match unplaced when the daily window is too small for its duration', () => {
    const candidates = [match({ id: 1, match_number: 'M1' })]
    const courts = [court({ id: 10 })]
    const tightParams: SchedulePlanParams = {
      ...baseParams,
      dailyStartMinute: 8 * 60,
      dailyEndMinute: 8 * 60 + 10, // only a 10-minute window, but default duration is 30
    }

    const plan = computeSchedulePlan({
      candidates,
      courts,
      rosterIndex: emptyRoster,
      categoryRulesets: emptyRulesets,
      existingCourtOccupancy: new Map(),
      existingIdentityOccupancy: new Map(),
      params: tightParams,
    })

    expect(plan.assignments).toEqual([])
    expect(plan.unplaced).toHaveLength(1)
    expect(plan.unplaced[0].matchId).toBe(1)
  })

  it('never places a match at or before its own next_match_id bracket feeder (regression: live Futsal Open Championship final)', () => {
    // Mirrors the real bug: two semifinals and their final are all unscheduled at once, wired
    // together by next_match_id exactly like createSingleEliminationBracketMatches produces.
    const semi1 = match({ id: 1, match_number: 'SF1', next_match_id: 3 })
    const semi2 = match({ id: 2, match_number: 'SF2', next_match_id: 3 })
    const final = match({ id: 3, match_number: 'FINAL' })
    const courts = [court({ id: 10 }), court({ id: 11 })]

    const plan = computeSchedulePlan({
      candidates: [semi1, semi2, final],
      courts,
      rosterIndex: emptyRoster,
      categoryRulesets: emptyRulesets,
      existingCourtOccupancy: new Map(),
      existingIdentityOccupancy: new Map(),
      params: baseParams,
    })

    expect(plan.unplaced).toEqual([])
    expect(plan.assignments).toHaveLength(3)
    const byId = new Map(plan.assignments.map((a) => [a.matchId, a]))
    const finalAssignment = byId.get(3)!
    const semi1End = new Date(byId.get(1)!.endAt).getTime()
    const semi2End = new Date(byId.get(2)!.endAt).getTime()
    const finalStart = new Date(finalAssignment.startAt).getTime()
    expect(finalStart).toBeGreaterThanOrEqual(semi1End)
    expect(finalStart).toBeGreaterThanOrEqual(semi2End)
  })

  it('respects a dependency floor from an already-scheduled feeder outside this batch', () => {
    const finalMatch = match({ id: 3, match_number: 'FINAL', next_match_id: undefined })
    const courts = [court({ id: 10 })]
    const feederEnd = localInstant(baseParams.rangeStartDate, baseParams.dailyStartMinute) + 5 * 60 * 60_000 // 13:00 local

    const plan = computeSchedulePlan({
      candidates: [finalMatch],
      courts,
      rosterIndex: emptyRoster,
      categoryRulesets: emptyRulesets,
      existingCourtOccupancy: new Map(),
      existingIdentityOccupancy: new Map(),
      params: baseParams,
      initialDependencyFloors: new Map([['3', feederEnd]]),
    })

    expect(plan.assignments).toHaveLength(1)
    expect(new Date(plan.assignments[0].startAt).getTime()).toBeGreaterThanOrEqual(feederEnd)
  })

  it('does not double-book a court against a pre-existing scheduled match', () => {
    const candidates = [match({ id: 2, match_number: 'M2' })]
    const courts = [court({ id: 10 })]
    const firstSlotStart = localInstant(baseParams.rangeStartDate, baseParams.dailyStartMinute)
    const firstSlotEnd = firstSlotStart + baseParams.defaultDurationMinutes * 60_000
    const existingCourtOccupancy = new Map([['court:10', [{ start: firstSlotStart, end: firstSlotEnd }]]])

    const plan = computeSchedulePlan({
      candidates,
      courts,
      rosterIndex: emptyRoster,
      categoryRulesets: emptyRulesets,
      existingCourtOccupancy,
      existingIdentityOccupancy: new Map(),
      params: baseParams,
    })

    expect(plan.assignments).toHaveLength(1)
    expect(new Date(plan.assignments[0].startAt).getTime()).toBeGreaterThanOrEqual(firstSlotEnd)
  })
})

describe('buildExistingOccupancy', () => {
  it('seeds court and identity occupancy from already-scheduled matches only', () => {
    const scheduled: OptimizerMatch[] = [
      match({
        id: 1,
        match_number: 'M1',
        category_id: 1,
        court_id: 10,
        scheduled_start_at: '2026-08-10T08:00:00.000Z',
        scheduled_end_at: '2026-08-10T08:30:00.000Z',
        participant_a_entry_id: entry(1, 'individual', { player_id: 501 }),
      }),
      match({ id: 2, match_number: 'M2' }), // unscheduled - must be ignored entirely
    ]

    const { courtOccupancy, identityOccupancy } = buildExistingOccupancy(scheduled, new Map(), new Map(), 15)

    expect(courtOccupancy.get('court:10')).toHaveLength(1)
    expect(identityOccupancy.get('player:501')).toHaveLength(1)
    expect(identityOccupancy.get('player:501')![0].restMinutes).toBe(15)
  })
})
