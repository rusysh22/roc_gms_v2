import { getAbsolutePublicUrl } from '@/lib/shareMetadata'

export type MatchCalendarInput = {
  id: string | number
  matchNumber: string
  title: string
  description?: string
  startsAt: string
  endsAt?: string | null
  venue?: string
  court?: string
  url?: string
}

const escapeIcsText = (value: string | number | null | undefined) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')

const formatIcsDate = (value: string | Date) =>
  new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

const foldIcsLine = (line: string) => {
  const chunks: string[] = []
  let rest = line

  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74))
    rest = ` ${rest.slice(74)}`
  }

  chunks.push(rest)
  return chunks.join('\r\n')
}

export const buildMatchIcs = (match: MatchCalendarInput) => {
  const startsAt = new Date(match.startsAt)
  const endsAt = match.endsAt ? new Date(match.endsAt) : new Date(startsAt.getTime() + 60 * 60 * 1000)
  const now = new Date()
  const location = [match.venue, match.court].filter(Boolean).join(' / ')
  const url = match.url || getAbsolutePublicUrl(`/matches/${match.matchNumber}`)
  const uid = `${match.matchNumber}-${match.id}@intourney.local`
  const description = [match.description, url].filter(Boolean).join('\n\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//InTourney//InTourney Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(startsAt)}`,
    `DTEND:${formatIcsDate(endsAt)}`,
    `SUMMARY:${escapeIcsText(match.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(location || 'Venue TBD')}`,
    `URL:${escapeIcsText(url)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(`Reminder: ${match.title}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}
