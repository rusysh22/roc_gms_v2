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

// Every formatter below takes `timezone` as its last, optional parameter and falls back to WIB -
// so a call site that hasn't been threaded through to a specific event's timezone yet still
// renders the platform default instead of throwing, while call sites that do have the event in
// scope pass `resolveEventTimezone(event.timezone)` for a correct, event-specific result.
export const resolveEventTimezone = (timezone?: string | null): string => timezone || DEFAULT_EVENT_TIMEZONE
