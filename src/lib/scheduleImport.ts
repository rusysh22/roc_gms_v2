import * as XLSX from 'xlsx'

// Mirrors participantsImport.ts's shape: pure parsing here (testable, no Payload/DB dependency),
// row-by-row validation and the actual database writes live in schedulerActions.ts next to the
// single-match reschedule/status-transition actions they reuse.
// Lives here (a plain module) rather than in schedulerActions.ts - a "use server" file's static
// analysis rejects any export that isn't an async function, including a type-only export, so this
// result type has to be defined outside the action file that produces it.
export type ScheduleImportRowOutcome = {
  matchNumber: string
  outcome: 'updated' | 'skipped' | 'error'
  message: string
  // Only set on a dry run (preview): a human-readable "before → after" for the row, e.g.
  // "Sat 2 Aug 08:00–10:00 @ Main Hall / Court 1" or "status → postponed".
  changePreview?: string
}

export type ScheduleImportPlan = {
  results: ScheduleImportRowOutcome[]
  updated: number
  skipped: number
  errors: number
}

// What `previewScheduleImportAction` stashes for the import page to render before anything is
// applied. `rows` is capped (error/updated first); `total` and the counts are exact.
export type ScheduleImportPreview = {
  updated: number
  skipped: number
  errors: number
  total: number
  rows: ScheduleImportRowOutcome[]
  moreRows: number
}

export type ScheduleImportRow = {
  matchNumber: string
  newStart: string
  newEnd: string
  newVenue: string
  newCourt: string
  newStatus: string
  winner: string
  reason: string
}

const str = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim())

// Deliberately plain "YYYY-MM-DD HH:mm" text, not a native Excel date cell - a date cell's
// serialized value has no timezone of its own (Excel/xlsx round-trips it as a bare day-number, so
// re-reading it back would silently drift by whatever the offset between the event's timezone and
// whatever locale opened the file happens to be). Parsed against the event's own fixed UTC offset
// by the caller instead, so "2026-08-02 08:00" always means 08:00 in the event's chosen zone.
export const SCHEDULE_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/

// Indonesia doesn't observe daylight saving, so every timezone this app offers (see
// EVENT_TIMEZONE_OPTIONS) is a fixed year-round UTC offset - safe to hardcode rather than needing
// real IANA offset-resolution logic just for this one parse.
const TIMEZONE_UTC_OFFSETS: Record<string, string> = {
  'Asia/Jakarta': '+07:00',
  'Asia/Makassar': '+08:00',
  'Asia/Jayapura': '+09:00',
}

export const parseScheduleDateTime = (value: string, timezone: string): string | null => {
  const match = value.match(SCHEDULE_DATETIME_PATTERN)
  if (!match) {
    return null
  }

  const [, year, month, day, hour, minute] = match
  const offset = TIMEZONE_UTC_OFFSETS[timezone] || TIMEZONE_UTC_OFFSETS[Object.keys(TIMEZONE_UTC_OFFSETS)[0]]
  const time = new Date(`${year}-${month}-${day}T${hour}:${minute}:00${offset}`).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

export const parseScheduleImportWorkbook = (fileBuffer: ArrayBuffer): ScheduleImportRow[] => {
  const workbook = XLSX.read(Buffer.from(fileBuffer), { type: 'buffer' })
  const sheet = workbook.Sheets['Schedule']
  if (!sheet) {
    return []
  }

  return XLSX.utils
    .sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    .map((row) => ({
      matchNumber: str(row['Match #']),
      newStart: str(row['New Start (YYYY-MM-DD HH:mm)']),
      newEnd: str(row['New End (YYYY-MM-DD HH:mm)']),
      newVenue: str(row['New Venue']),
      newCourt: str(row['New Court']),
      newStatus: str(row['New Status']),
      winner: str(row['Winner (A/B)']).toUpperCase(),
      reason: str(row['Reason']),
    }))
    .filter((row) => row.matchNumber)
}
