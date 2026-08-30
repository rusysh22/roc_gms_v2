import fs from 'node:fs/promises'
import path from 'node:path'

// Bare filesystem scratch storage shared by the multi-step "upload → preview → confirm" import
// flows (participant import in the New Event Wizard, bulk schedule import in the Scheduler). NOT
// the Media collection - Media enforces "must be a decodable image" at its boundary, which an
// .xlsx can never satisfy.
//
// The preview step writes the uploaded workbook here (`<uuid>.xlsx`) plus, optionally, a small JSON
// sidecar (`<uuid>.json`) holding the dry-run result; confirm re-reads and deletes them, cancel
// just deletes them. Ids are server-generated UUIDs threaded back through the page as plain query
// params, so they are validated against these patterns before ever touching the filesystem again -
// a forged value must not be able to path-traverse out of this directory.
export const SCRATCH_DIR = path.resolve(process.cwd(), 'media/import-scratch')
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
export const SCRATCH_FILENAME_PATTERN = new RegExp(`^${UUID}\\.xlsx$`)
export const SCRATCH_ID_PATTERN = new RegExp(`^${UUID}$`)

const bareId = (value: string): string => value.replace(/\.xlsx$/, '')

export const scratchFilePath = (filename: string): string | null =>
  SCRATCH_FILENAME_PATTERN.test(filename) ? path.join(SCRATCH_DIR, filename) : null

const jsonPath = (id: string): string | null =>
  SCRATCH_ID_PATTERN.test(bareId(id)) ? path.join(SCRATCH_DIR, `${bareId(id)}.json`) : null

export const writeScratchXlsx = async (id: string, buffer: Buffer): Promise<void> => {
  if (!SCRATCH_ID_PATTERN.test(bareId(id))) return
  await fs.mkdir(SCRATCH_DIR, { recursive: true })
  await fs.writeFile(path.join(SCRATCH_DIR, `${bareId(id)}.xlsx`), buffer)
}

export const readScratchXlsx = async (filename: string | undefined): Promise<Buffer | null> => {
  if (!filename) return null
  const target = scratchFilePath(filename)
  if (!target) return null
  return fs.readFile(target).catch(() => null)
}

export const writeScratchJson = async (id: string, data: unknown): Promise<void> => {
  const target = jsonPath(id)
  if (!target) return
  await fs.mkdir(SCRATCH_DIR, { recursive: true })
  await fs.writeFile(target, JSON.stringify(data))
}

export const readScratchJson = async <T>(id: string | undefined): Promise<T | null> => {
  if (!id) return null
  const target = jsonPath(id)
  if (!target) return null
  try {
    return JSON.parse(await fs.readFile(target, 'utf8')) as T
  } catch {
    return null
  }
}

/** Removes both the `<id>.xlsx` and `<id>.json` for a scratch id (accepts either form). */
export const deleteScratch = async (id: string | undefined): Promise<void> => {
  if (!id) return
  const base = bareId(id)
  if (!SCRATCH_ID_PATTERN.test(base)) return
  await fs.unlink(path.join(SCRATCH_DIR, `${base}.xlsx`)).catch(() => {})
  await fs.unlink(path.join(SCRATCH_DIR, `${base}.json`)).catch(() => {})
}
