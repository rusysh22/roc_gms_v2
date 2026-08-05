import { describe, expect, it } from 'vitest'

import { formatDateTime, formatTimeOnly, getDateKey } from './workspaceComponents'

describe('per-tournament timezone formatting', () => {
  // 2026-08-17T08:00:00.000Z is 15:00 WIB (Asia/Jakarta, UTC+7), 16:00 WITA (Asia/Makassar,
  // UTC+8), and 17:00 WIT (Asia/Jayapura, UTC+9) - same instant, three different event timezones.
  const instant = '2026-08-17T08:00:00.000Z'

  it('formatTimeOnly renders in 24-hour clock, not AM/PM', () => {
    expect(formatTimeOnly(instant, 'Asia/Jakarta')).toBe('15:00')
  })

  it('formatTimeOnly shifts with the event timezone', () => {
    expect(formatTimeOnly(instant, 'Asia/Jakarta')).toBe('15:00')
    expect(formatTimeOnly(instant, 'Asia/Makassar')).toBe('16:00')
    expect(formatTimeOnly(instant, 'Asia/Jayapura')).toBe('17:00')
  })

  it('formatTimeOnly defaults to WIB when no timezone is passed', () => {
    expect(formatTimeOnly(instant)).toBe(formatTimeOnly(instant, 'Asia/Jakarta'))
  })

  it('formatDateTime uses 24-hour time within its combined date+time output', () => {
    expect(formatDateTime(instant, 'Asia/Jakarta')).toContain('15:00')
    expect(formatDateTime(instant, 'Asia/Jakarta')).not.toMatch(/am|pm/i)
  })

  it('getDateKey can cross a calendar day depending on the event timezone', () => {
    // 2026-08-17T20:00:00.000Z is 2026-08-18 03:00 WIT (Asia/Jayapura) - already past midnight
    // there, still 2026-08-18 03:00 WITA, but still 2026-08-18... check a case that actually
    // differs: 2026-08-17T17:30:00.000Z is 2026-08-18 02:30 in Jayapura, 2026-08-18 01:30 in
    // Makassar, but still 2026-08-18 00:30 in Jakarta - all the same calendar day. Use an earlier
    // instant that's still 2026-08-16 in Jakarta but already 2026-08-17 in Jayapura.
    const nearMidnight = '2026-08-16T15:30:00.000Z'
    expect(getDateKey(nearMidnight, 'Asia/Jakarta')).toBe('2026-08-16')
    expect(getDateKey(nearMidnight, 'Asia/Jayapura')).toBe('2026-08-17')
  })
})
