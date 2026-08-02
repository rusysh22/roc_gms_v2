import * as XLSX from 'xlsx'

import { formatDateTime, getRelationshipLabel, type WorkspaceMatch } from '@/app/(frontend)/workspaces/workspaceComponents'

// AUDIT_UI_UX_CSS ADM-07/section 11.10/P2 item 6: "no export at all" - an organizer coordinating
// venues/referees on the day needs a printable/shareable sheet, not a live web page. Reuses the
// same `xlsx` dependency the participants-import template already uses; one flat sheet (not the
// multi-tab template shape) since a schedule export is read top-to-bottom, not filled in per-row.
export function buildScheduleWorkbook(matches: WorkspaceMatch[]): Buffer {
  const rows = matches.map((match) => ({
    'Match #': match.match_number,
    Round: match.round_name || '',
    Sport: getRelationshipLabel(match.sport_id, ''),
    Category: getRelationshipLabel(match.category_id, ''),
    'Participant A': getRelationshipLabel(match.participant_a_entry_id, ''),
    'Participant B': getRelationshipLabel(match.participant_b_entry_id, ''),
    Start: formatDateTime(match.scheduled_start_at),
    End: formatDateTime(match.scheduled_end_at),
    Venue: getRelationshipLabel(match.venue_id, ''),
    Court: getRelationshipLabel(match.court_id, ''),
    Status: match.status,
    Public: match.is_public ? 'Yes' : 'No',
  }))

  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 8 },
  ]
  XLSX.utils.book_append_sheet(workbook, sheet, 'Schedule')

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
