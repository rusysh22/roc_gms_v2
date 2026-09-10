import { describe, expect, it } from 'vitest'

import { detectScheduleConflicts } from './conflicts'
import type { WorkspaceMatch } from '../../workspaceComponents'

const match = (over: Partial<WorkspaceMatch>): WorkspaceMatch => ({
  id: over.id ?? 'm',
  match_number: over.match_number ?? 'M',
  status: over.status ?? 'scheduled',
  ...over,
})

// Two matches sharing participant entry 7, back to back on different courts.
const at = (id: string, num: string, startH: number, endH: number) =>
  match({
    id,
    match_number: num,
    scheduled_start_at: `2026-09-15T${String(startH).padStart(2, '0')}:00:00+07:00`,
    scheduled_end_at: `2026-09-15T${String(endH).padStart(2, '0')}:00:00+07:00`,
    participant_a_entry_id: 7,
    participant_b_entry_id: id === 'a' ? 8 : 9,
    court_id: id === 'a' ? 1 : 2,
  })

describe('detectScheduleConflicts — insufficient_rest (SKD-01)', () => {
  it('flags a gap shorter than the required rest for a shared participant', () => {
    const matches = [at('a', 'M1', 8, 9), at('b', 'M2', 9, 10)] // 0 min gap
    const rest = new Map([
      ['a', 30],
      ['b', 30],
    ])
    const warnings = detectScheduleConflicts(matches, { restMinutesByMatchId: rest })
    const restWarn = warnings.find((w) => w.type === 'insufficient_rest')
    expect(restWarn).toBeDefined()
    expect(restWarn?.matchIds).toEqual(['a', 'b'])
  })

  it('does not flag when the gap meets the requirement', () => {
    const matches = [at('a', 'M1', 8, 9), at('b', 'M2', 10, 11)] // 60 min gap
    const rest = new Map([['a', 30], ['b', 30]])
    expect(detectScheduleConflicts(matches, { restMinutesByMatchId: rest }).some((w) => w.type === 'insufficient_rest')).toBe(false)
  })

  it('does not flag when the two matches have no shared participant', () => {
    const a = at('a', 'M1', 8, 9)
    const b = { ...at('b', 'M2', 9, 10), participant_a_entry_id: 100, participant_b_entry_id: 101 }
    const rest = new Map([['a', 30], ['b', 30]])
    expect(detectScheduleConflicts([a, b], { restMinutesByMatchId: rest }).some((w) => w.type === 'insufficient_rest')).toBe(false)
  })

  it('is inert without the rest map (unchanged legacy behaviour)', () => {
    const matches = [at('a', 'M1', 8, 9), at('b', 'M2', 9, 10)]
    expect(detectScheduleConflicts(matches).some((w) => w.type === 'insufficient_rest')).toBe(false)
  })

  it('still flags a real overlap on the same court separately', () => {
    const a = at('a', 'M1', 8, 10)
    const b = { ...at('b', 'M2', 9, 11), court_id: 1 }
    expect(detectScheduleConflicts([a, b]).some((w) => w.type === 'venue_overlap')).toBe(true)
  })
})
