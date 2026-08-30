import {
  SCRATCH_DIR,
  SCRATCH_FILENAME_PATTERN,
  deleteScratch,
  readScratchJson,
  scratchFilePath,
  writeScratchJson,
} from '@/lib/importScratch'

// The participant-import wizard step's typed view over the shared scratch storage in
// `@/lib/importScratch`. The dry-run row-level notes and per-sheet mapping preview used to be
// JSON-stringified straight into the redirect URL; a file with dozens of skipped/warned rows
// pushed that past ~5KB, which some reverse proxies reject. They now live in a sidecar file keyed
// by the same id, and only the id travels in the URL.
export { SCRATCH_DIR, SCRATCH_FILENAME_PATTERN, scratchFilePath }
export const deleteImportSidecar = deleteScratch

export type ImportIssue = { sheet: string; name: string; reason: string }

// Per-sheet "here is what each row in your file will do" preview, so the organizer can eyeball the
// mapping (which row becomes a create, which an update, which is skipped and why) before confirming
// - not just an aggregate count.
export type PreviewRowStatus = 'create' | 'update' | 'skip'
export type PreviewRow = { cells: string[]; status: PreviewRowStatus; notes: string[] }
export type SheetPreview = { sheet: string; columns: string[]; rows: PreviewRow[]; total: number }

export type ImportResultSidecar = {
  issues: ImportIssue[]
  moreIssues: number
  sheets: SheetPreview[]
}

const MAX_STORED_ISSUES = 200

// `id` is the bare UUID (no extension) shared with the .xlsx for a preview, or a fresh UUID for a
// confirmed-import summary. `sheets` is only populated for a preview.
export const writeImportSidecar = async (
  id: string,
  { issues, sheets = [] }: { issues: ImportIssue[]; sheets?: SheetPreview[] },
): Promise<void> => {
  await writeScratchJson(id, {
    issues: issues.slice(0, MAX_STORED_ISSUES),
    moreIssues: issues.length > MAX_STORED_ISSUES ? issues.length - MAX_STORED_ISSUES : 0,
    sheets,
  } satisfies ImportResultSidecar)
}

export const readImportSidecar = async (id: string | undefined): Promise<ImportResultSidecar | null> => {
  const parsed = await readScratchJson<ImportResultSidecar>(id)
  if (!parsed || !Array.isArray(parsed.issues)) return null
  return {
    issues: parsed.issues,
    moreIssues: Number(parsed.moreIssues) || 0,
    sheets: Array.isArray(parsed.sheets) ? parsed.sheets : [],
  }
}
