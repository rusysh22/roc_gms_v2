import fs from 'node:fs/promises'
import path from 'node:path'

// Bare filesystem scratch storage for the participant-import wizard step - NOT the Media collection
// (Media enforces "must be a decodable image" at its boundary, which an .xlsx can never satisfy).
// The preview step writes the uploaded workbook here plus a small JSON sidecar holding the dry-run
// result; confirm re-reads and deletes them, cancel just deletes them.
//
// Filenames are server-generated UUIDs threaded back through the page as plain query params, so
// they are validated against these patterns before ever touching the filesystem again - a forged
// value must not be able to path-traverse out of this directory.
export const SCRATCH_DIR = path.resolve(process.cwd(), 'media/import-scratch')
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
export const SCRATCH_FILENAME_PATTERN = new RegExp(`^${UUID}\\.xlsx$`)
const RESULT_ID_PATTERN = new RegExp(`^${UUID}$`)

export const scratchFilePath = (filename: string): string | null =>
  SCRATCH_FILENAME_PATTERN.test(filename) ? path.join(SCRATCH_DIR, filename) : null

// The dry-run row-level notes (and, for a confirmed import, the after-the-fact summary) used to be
// JSON-stringified straight into the redirect URL. A file with dozens of skipped/warned rows pushed
// that past ~5KB, which some reverse proxies reject - the failure surfaced as the app's generic
// "Something went wrong" page. They now live in a sidecar file keyed by the same id, and only the
// id travels in the URL.
export type ImportIssue = { sheet: string; name: string; reason: string }
export type ImportResultSidecar = {
  issues: ImportIssue[]
  moreIssues: number
}

const MAX_STORED_ISSUES = 200

const sidecarPath = (id: string): string | null =>
  RESULT_ID_PATTERN.test(id) ? path.join(SCRATCH_DIR, `${id}.json`) : null

// `id` is the bare UUID (no extension) shared with the .xlsx for a preview, or a fresh UUID for a
// confirmed-import summary.
export const writeImportSidecar = async (id: string, issues: ImportIssue[]): Promise<void> => {
  const target = sidecarPath(id)
  if (!target) return
  const payload: ImportResultSidecar = {
    issues: issues.slice(0, MAX_STORED_ISSUES),
    moreIssues: issues.length > MAX_STORED_ISSUES ? issues.length - MAX_STORED_ISSUES : 0,
  }
  await fs.mkdir(SCRATCH_DIR, { recursive: true })
  await fs.writeFile(target, JSON.stringify(payload))
}

export const readImportSidecar = async (id: string | undefined): Promise<ImportResultSidecar | null> => {
  if (!id) return null
  const target = sidecarPath(id)
  if (!target) return null
  try {
    const parsed = JSON.parse(await fs.readFile(target, 'utf8')) as ImportResultSidecar
    if (!Array.isArray(parsed.issues)) return null
    return { issues: parsed.issues, moreIssues: Number(parsed.moreIssues) || 0 }
  } catch {
    return null
  }
}

export const deleteImportSidecar = async (id: string | undefined): Promise<void> => {
  if (!id) return
  const target = sidecarPath(id)
  if (target) await fs.unlink(target).catch(() => {})
}
