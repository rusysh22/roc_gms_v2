// Per-tournament timezone: every event picks its own IANA zone at creation (default WIB), and
// every date/time formatter across the app (workspace + public) takes that zone as an explicit
// parameter rather than a hardcoded string - so a Jakarta event and a future Jayapura event each
// render their own schedule correctly instead of everything silently assuming one region.
//
// Scoped to the handful of Indonesian zones this product actually serves (see
// MULTI_SPORT_GAMES_ENHANCEMENTS_DESIGN.md / README for the "not just one company's office"
// framing) - a full IANA zone picker would be overkill for an event-creation form.
export const DEFAULT_EVENT_TIMEZONE = 'Asia/Jakarta'

export const EVENT_TIMEZONE_OPTIONS = [
  { value: 'Asia/Jakarta', label: 'WIB - Western Indonesia (GMT+7)' },
  { value: 'Asia/Makassar', label: 'WITA - Central Indonesia (GMT+8)' },
  { value: 'Asia/Jayapura', label: 'WIT - Eastern Indonesia (GMT+9)' },
] as const

export type EventTimezone = (typeof EVENT_TIMEZONE_OPTIONS)[number]['value']

// Fixed UTC offsets - Indonesia observes no DST, so these are exact year-round (same rationale as
// scheduleImport.ts's own TIMEZONE_UTC_OFFSETS, which this consolidates). Used to interpret naive
// "YYYY-MM-DD HH:mm" wall-clock strings as an instant in the event's zone rather than the server's.
const EVENT_UTC_OFFSETS: Record<string, string> = {
  'Asia/Jakarta': '+07:00',
  'Asia/Makassar': '+08:00',
  'Asia/Jayapura': '+09:00',
}

export const eventUtcOffset = (timezone?: string | null): string =>
  EVENT_UTC_OFFSETS[resolveEventTimezone(timezone)] ?? '+07:00'

// Every formatter below takes `timezone` as its last, optional parameter and falls back to WIB -
// so a call site that hasn't been threaded through to a specific event's timezone yet still
// renders the platform default instead of throwing, while call sites that do have the event in
// scope pass `resolveEventTimezone(event.timezone)` for a correct, event-specific result.
export const resolveEventTimezone = (timezone?: string | null): string => timezone || DEFAULT_EVENT_TIMEZONE

/** Short human label for a zone (e.g. "WIB (GMT+7)") - for date-input hints so an admin typing a
 * naive "14:00" knows which local time it will be stored as. Falls back to the raw zone id. */
export const eventTimezoneLabel = (timezone?: string | null): string => {
  const resolved = resolveEventTimezone(timezone)
  const option = EVENT_TIMEZONE_OPTIONS.find((o) => o.value === resolved)
  if (!option) return resolved
  const abbr = option.label.split(' - ')[0]
  const gmt = option.label.match(/GMT[+-]\d+/)?.[0]
  return gmt ? `${abbr} (${gmt})` : abbr
}
