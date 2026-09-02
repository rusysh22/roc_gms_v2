// Compact, timezone-aware event date-range label (e.g. "12-14 Sep 2026", "28 Sep - 2 Oct 2026",
// or a single "13 Sep 2026" for a one-day event). Shared by the event hero, its share metadata,
// and its generated social card so all three read identically.
export const formatEventDateRange = (startIso: string, endIso: string, tz: string) => {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const day = (date: Date) => new Intl.DateTimeFormat('en', { day: 'numeric', timeZone: tz }).format(date)
  const monthYear = (date: Date) =>
    new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: tz }).format(date)
  const sameMonth =
    new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: tz }).format(start) ===
    monthYear(end)

  if (start.toDateString() === end.toDateString()) {
    return new Intl.DateTimeFormat('en', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: tz,
    }).format(start)
  }

  if (sameMonth) {
    return `${day(start)}-${day(end)} ${monthYear(end)}`
  }

  return `${day(start)} ${monthYear(start)} - ${day(end)} ${monthYear(end)}`
}
