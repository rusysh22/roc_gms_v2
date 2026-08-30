import * as XLSX from 'xlsx'

import {
  formatDateTime,
  getRelationshipId,
  getRelationshipLabel,
  type WorkspaceMatch,
} from '@/app/(frontend)/workspaces/workspaceComponents'
import { DEFAULT_EVENT_TIMEZONE } from '@/lib/timezone'

// AUDIT_UI_UX_CSS ADM-07/section 11.10/P2 item 6: "no export at all" - an organizer coordinating
// venues/referees on the day needs a printable/shareable sheet, not a live web page. Reuses the
// same `xlsx` dependency the participants-import template already uses; one flat sheet (not the
// multi-tab template shape) since a schedule export is read top-to-bottom, not filled in per-row.
//
// Doubles as the bulk-reschedule import TEMPLATE (see scheduleImport.ts + schedulerActions.ts's
// applyScheduleImportAction): "Match #" through "Public" are read-only context (including "Club A"
// / "Club B" - the parent club of each team / pair / player entry, so an organizer can tell which
// club a participant belongs to) so whoever's editing the sheet can tell which row is which; the
// "New ..." columns are what actually gets
// applied on import, left blank = "don't change this field" rather than every row needing every
// column filled in. "Winner" is pre-filled from the match's current winner (if any) so re-
// importing an unrelated change to the same row doesn't accidentally blank out a decided result.
export function buildScheduleWorkbook(
  matches: WorkspaceMatch[],
  timezone: string = DEFAULT_EVENT_TIMEZONE,
  // entryId -> the entry's parent club name. Empty for club-mode entries (their own name IS the
  // club) and entries with no club. See collectEntryClubLabels (src/lib/brackets.ts).
  clubLabelByEntryId: Map<string, string> = new Map(),
): Buffer {
  const clubOf = (entry: WorkspaceMatch['participant_a_entry_id']): string => {
    const id = getRelationshipId(entry)
    return id ? clubLabelByEntryId.get(String(id)) || '' : ''
  }

  const rows = matches.map((match) => {
    const winnerId = getRelationshipId(match.winner_entry_id)
    const participantAId = getRelationshipId(match.participant_a_entry_id)
    const participantBId = getRelationshipId(match.participant_b_entry_id)
    const winnerSide =
      winnerId && winnerId === participantAId ? 'A'
      : winnerId && winnerId === participantBId ? 'B'
      : ''

    return {
      'Match #': match.match_number,
      Round: match.round_name || '',
      Sport: getRelationshipLabel(match.sport_id, ''),
      Category: getRelationshipLabel(match.category_id, ''),
      'Participant A': getRelationshipLabel(match.participant_a_entry_id, ''),
      'Club A': clubOf(match.participant_a_entry_id),
      'Participant B': getRelationshipLabel(match.participant_b_entry_id, ''),
      'Club B': clubOf(match.participant_b_entry_id),
      Start: formatDateTime(match.scheduled_start_at, timezone),
      End: formatDateTime(match.scheduled_end_at, timezone),
      Venue: getRelationshipLabel(match.venue_id, ''),
      Court: getRelationshipLabel(match.court_id, ''),
      Status: match.status,
      Public: match.is_public ? 'Yes' : 'No',
      'New Start (YYYY-MM-DD HH:mm)': '',
      'New End (YYYY-MM-DD HH:mm)': '',
      'New Venue': '',
      'New Court': '',
      'New Status': '',
      'Winner (A/B)': winnerSide,
      Reason: '',
    }
  })

  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet['!cols'] = [
    { wch: 14 }, // Match #
    { wch: 14 }, // Round
    { wch: 16 }, // Sport
    { wch: 22 }, // Category
    { wch: 20 }, // Participant A
    { wch: 18 }, // Club A
    { wch: 20 }, // Participant B
    { wch: 18 }, // Club B
    { wch: 18 }, // Start
    { wch: 18 }, // End
    { wch: 18 }, // Venue
    { wch: 14 }, // Court
    { wch: 14 }, // Status
    { wch: 8 }, // Public
    { wch: 24 }, // New Start
    { wch: 24 }, // New End
    { wch: 18 }, // New Venue
    { wch: 14 }, // New Court
    { wch: 14 }, // New Status
    { wch: 12 }, // Winner (A/B)
    { wch: 28 }, // Reason
  ]
  XLSX.utils.book_append_sheet(workbook, sheet, 'Schedule')

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
