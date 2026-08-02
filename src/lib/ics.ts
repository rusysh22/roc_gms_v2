// AUDIT_UI_UX_CSS PUB-18: "no add-to-calendar option" - spectators/participants relied on
// screenshotting or manually copying a match time. Plain-text .ics generation needs no
// dependency; the format (RFC 5545) is simple enough that reaching for a library would be
// overkill for one VEVENT block. Every line here is short (title/venue/URL, no long
// descriptions), so RFC 5545's 75-octet line-folding rule never actually applies.
const escapeText = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replaceAll('\n', '\\n')

const toIcsDate = (iso: string) => {
  const date = new Date(iso)
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

export function buildIcsEvent({
  uid,
  title,
  description,
  location,
  url,
  startAt,
  endAt,
}: {
  uid: string
  title: string
  description?: string
  location?: string
  url?: string
  startAt: string
  endAt?: string
}): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//InTourney//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(startAt)}`,
    `DTEND:${toIcsDate(endAt || startAt)}`,
    `SUMMARY:${escapeText(title)}`,
    ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    ...(url ? [`URL:${url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}
