// AUDIT_TOURNAMENT_STANDARDS REG-07: the import route handlers only rejected an empty file - no
// upper bound before XLSX.read() ran on whatever was uploaded. next.config.mjs's bodySizeLimit
// only covers Server Actions, not Route Handlers, so the per-menu import route
// (src/app/(frontend)/workspaces/(shell)/event-admin/io/[menu]/route.ts) had effectively no
// application-level cap, and a crafted/huge workbook could tie up CPU and memory disproportionately
// (compounded by the unpatched prototype-pollution/ReDoS advisories on xlsx@0.18.5).
//
// A tournament roster/schedule sheet is small: a few thousand rows at most. These caps are
// generous for real use and cheap to enforce.

export const MAX_SPREADSHEET_BYTES = Number(
  process.env.IMPORT_MAX_FILE_SIZE_BYTES || 5 * 1024 * 1024,
)
export const MAX_SPREADSHEET_ROWS = Number(process.env.IMPORT_MAX_ROWS || 5000)

export type SpreadsheetGuardResult = { ok: true } | { ok: false; reason: string }

/** Size gate - call before reading the bytes into a Buffer / handing them to XLSX.read. */
export const checkSpreadsheetSize = (size: number | undefined): SpreadsheetGuardResult => {
  if (!size || !Number.isFinite(size) || size <= 0) {
    return { ok: false, reason: 'The uploaded file is empty or unreadable.' }
  }
  if (size > MAX_SPREADSHEET_BYTES) {
    return {
      ok: false,
      reason: `Spreadsheet is larger than the ${Math.round(MAX_SPREADSHEET_BYTES / (1024 * 1024))}MB import limit.`,
    }
  }
  return { ok: true }
}

/** Row gate - call after parsing, with the total data-row count across every sheet. */
export const checkSpreadsheetRowCount = (rowCount: number): SpreadsheetGuardResult =>
  rowCount > MAX_SPREADSHEET_ROWS
    ? {
        ok: false,
        reason: `Import has ${rowCount} rows - over the ${MAX_SPREADSHEET_ROWS}-row limit. Split it into smaller files.`,
      }
    : { ok: true }
