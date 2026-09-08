import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import type { Payload, Where } from 'payload'

import { recordAuditLog } from '@/lib/audit'
import type {
  ColumnSpec,
  ImportPlan,
  ImportSummary,
  MenuIoSpec,
  ResolvedRow,
  RowPlan,
  SheetContext,
  SheetSpec,
} from './types'

// ---------------------------------------------------------------------------
// Cell coercion (mirrors src/lib/participantsImport.ts's str/bool/num)
// ---------------------------------------------------------------------------
const str = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim())
const bool = (value: unknown): boolean | undefined => {
  const n = str(value).toLowerCase()
  if (!n) return undefined
  return n === 'yes' || n === 'y' || n === 'true' || n === '1' || n === 'on'
}
const num = (value: unknown): number | undefined => {
  const n = str(value)
  if (!n) return undefined
  const parsed = Number(n)
  return Number.isFinite(parsed) ? parsed : undefined
}
const normKey = (header: string) => header.toLowerCase().replace(/[\s_]+/g, '')
const normLabel = (label: string) => label.trim().toLowerCase()

// `toData` returns either the write payload or `{ error }`. `'error' in data` doesn't narrow a
// `Record<string, unknown>` union member, so check the value's type explicitly.
const toDataError = (data: Record<string, unknown> | { error: string }): string | null => {
  const value = (data as { error?: unknown }).error
  return typeof value === 'string' ? value : null
}

// ---------------------------------------------------------------------------
// Export - build a pre-filled workbook (one sheet per collection)
// ---------------------------------------------------------------------------
const relationLabel = (
  value: unknown,
  labelIndex: Map<string, string>,
): string => {
  if (value && typeof value === 'object') {
    const obj = value as { id?: unknown; name?: unknown; slug?: unknown; display_name?: unknown }
    if (typeof obj.name === 'string') return obj.name
    if (typeof obj.display_name === 'string') return obj.display_name
    if (typeof obj.slug === 'string') return obj.slug
    if (obj.id !== undefined) return labelIndex.get(String(obj.id)) ?? ''
    return ''
  }
  if (value === null || value === undefined) return ''
  return labelIndex.get(String(value)) ?? ''
}

const cellForExport = (
  doc: Record<string, unknown>,
  col: ColumnSpec,
  labelIndexes: Map<string, Map<string, string>>,
): string | number | null => {
  if (col.kind === 'id') return doc.id != null ? String(doc.id) : null
  const raw = doc[col.field]
  if (col.kind === 'boolean') return raw === true ? 'yes' : raw === false ? 'no' : null
  if (col.kind === 'relation' && col.relation) {
    const idx = labelIndexes.get(col.relation.collection) ?? new Map()
    return relationLabel(raw, idx) || null
  }
  if (col.kind === 'number') return typeof raw === 'number' ? raw : num(raw) ?? null
  return raw == null ? null : String(raw)
}

export async function buildMenuWorkbook(
  payload: Payload,
  eventId: string,
  spec: MenuIoSpec,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'InTourney'
  workbook.created = new Date()

  // Collect the label lists needed for relation dropdowns + id->label resolution on export.
  const relationCollections = new Set<string>()
  for (const sheet of spec.sheets) {
    for (const col of sheet.columns) {
      if (col.kind === 'relation' && col.relation) relationCollections.add(col.relation.collection)
    }
  }
  const labelIndexes = new Map<string, Map<string, string>>()
  const labelLists = new Map<string, string[]>()
  await Promise.all(
    [...relationCollections].map(async (collection) => {
      const res = await payload.find({
        collection: collection as never,
        depth: 0,
        limit: 5000,
        where: { event_id: { equals: eventId } },
      })
      const idToLabel = new Map<string, string>()
      const labels: string[] = []
      for (const doc of res.docs as Record<string, unknown>[]) {
        const label = String(doc.name ?? doc.display_name ?? doc.slug ?? doc.id)
        idToLabel.set(String(doc.id), label)
        labels.push(label)
      }
      labelIndexes.set(collection, idToLabel)
      labelLists.set(collection, labels)
    }),
  )

  // Hidden reference sheet feeding the list validations.
  const ref = workbook.addWorksheet('_Reference')
  ref.state = 'veryHidden'
  const refColumnFor = new Map<string, string>() // collection/enumKey -> column letter
  let refColIndex = 0
  const addRefColumn = (key: string, values: readonly string[]) => {
    refColIndex += 1
    const letter = ref.getColumn(refColIndex).letter
    ref.getCell(`${letter}1`).value = key
    values.forEach((v, i) => {
      ref.getCell(`${letter}${i + 2}`).value = v
    })
    refColumnFor.set(key, `_Reference!$${letter}$2:$${letter}$${values.length + 1}`)
    return values.length
  }
  for (const [collection, labels] of labelLists) {
    if (labels.length) addRefColumn(collection, labels)
  }
  for (const sheet of spec.sheets) {
    for (const col of sheet.columns) {
      if (col.kind === 'enum' && col.enumValues?.length) {
        const key = `enum:${col.header}`
        if (!refColumnFor.has(key)) addRefColumn(key, col.enumValues)
      }
    }
  }

  const VALIDATION_ROWS = 800
  for (const sheet of spec.sheets) {
    const ws = workbook.addWorksheet(sheet.sheetName)
    ws.columns = sheet.columns.map((col) => ({ header: col.header, key: col.header, width: 22 }))
    ws.getRow(1).font = { bold: true }
    ws.views = [{ state: 'frozen', ySplit: 1 }]

    const docs = (
      await payload.find({
        collection: sheet.collection as never,
        depth: 1,
        limit: 5000,
        where: { event_id: { equals: eventId } },
      })
    ).docs as Record<string, unknown>[]

    for (const doc of docs) {
      ws.addRow(sheet.columns.map((col) => cellForExport(doc, col, labelIndexes)))
    }

    sheet.columns.forEach((col, i) => {
      const letter = ws.getColumn(i + 1).letter
      if (col.kind === 'id') {
        ws.getColumn(i + 1).hidden = true
        return
      }
      let formula: string | undefined
      if (col.kind === 'relation' && col.relation) formula = refColumnFor.get(col.relation.collection)
      if (col.kind === 'enum') formula = refColumnFor.get(`enum:${col.header}`)
      if (!formula) return
      for (let row = 2; row <= VALIDATION_ROWS; row += 1) {
        ws.getCell(`${letter}${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`=${formula}`],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Check this value',
          error: "Not one of the listed values - keep it only if you're sure.",
        }
      }
    })
  }

  // Instructions sheet.
  const help = workbook.addWorksheet('Instructions')
  help.getColumn(1).width = 100
  const lines: string[] = [
    `${spec.fileStem} - import / export`,
    '',
    'Each sheet is pre-filled with this event\'s current rows. Edit a cell to change a value; a row',
    'that matches an existing record (by its key) is updated, not duplicated. Add a row at the bottom',
    'to create a new record. Do not edit the hidden "id" column.',
    '',
    'Relationship columns hold a NAME (or slug), not an id - pick from the dropdown. An unknown name',
    'is reported as an error on import, nothing is written for that row.',
    '',
  ]
  for (const sheet of spec.sheets) {
    lines.push(`[${sheet.sheetName}]  key: ${sheet.upsertKeyFields.join(' + ') || 'id column only'}`)
    for (const col of sheet.columns) {
      if (col.note) lines.push(`  - ${col.header}: ${col.note}`)
    }
    lines.push('')
  }
  lines.forEach((line) => help.addRow([line]))

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

// ---------------------------------------------------------------------------
// Parse - read an uploaded workbook into raw rows keyed by column spec
// ---------------------------------------------------------------------------
type RawSheetRows = { sheet: SheetSpec; rows: { rowNumber: number; cells: Record<string, unknown> }[] }

export function parseMenuWorkbook(buffer: Buffer, spec: MenuIoSpec): RawSheetRows[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const out: RawSheetRows[] = []
  for (const sheet of spec.sheets) {
    const ws = wb.Sheets[sheet.sheetName]
    if (!ws) {
      out.push({ sheet, rows: [] })
      continue
    }
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
    const byNormHeader = new Map(sheet.columns.map((c) => [normKey(c.header), c]))
    const rows = json.map((record, index) => {
      const cells: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(record)) {
        const col = byNormHeader.get(normKey(key))
        if (col) cells[col.field] = value
      }
      return { rowNumber: index + 2, cells }
    })
    // Drop fully-blank rows.
    out.push({
      sheet,
      rows: rows.filter((r) => Object.values(r.cells).some((v) => str(v) !== '')),
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Resolve + plan
// ---------------------------------------------------------------------------
const buildRelationIndex = async (
  payload: Payload,
  eventId: string,
  spec: MenuIoSpec,
): Promise<Map<string, Map<string, string>>> => {
  const collections = new Set<string>()
  for (const sheet of spec.sheets)
    for (const col of sheet.columns)
      if (col.kind === 'relation' && col.relation) collections.add(col.relation.collection)
  const index = new Map<string, Map<string, string>>()
  await Promise.all(
    [...collections].map(async (collection) => {
      const res = await payload.find({
        collection: collection as never,
        depth: 0,
        limit: 5000,
        where: { event_id: { equals: eventId } },
      })
      const labelToId = new Map<string, string>()
      for (const doc of res.docs as Record<string, unknown>[]) {
        for (const key of ['name', 'slug', 'display_name']) {
          const v = doc[key]
          if (typeof v === 'string' && v) labelToId.set(normLabel(v), String(doc.id))
        }
      }
      index.set(collection, labelToId)
    }),
  )
  return index
}

// Marker id for a forward reference during the dry run: a label that isn't in the DB yet but WILL
// be created by an earlier sheet in the same workbook. The preview must not flag it as an error;
// the value is never written (plan does no writes, and apply rebuilds the real index per sheet).
const PENDING = '__pending__'

const seedForwardReferences = (
  index: Map<string, Map<string, string>>,
  parsed: RawSheetRows[],
) => {
  for (const { sheet, rows } of parsed) {
    const map = index.get(sheet.collection) ?? new Map<string, string>()
    for (const raw of rows) {
      for (const key of ['name', 'slug', 'display_name']) {
        const v = str(raw.cells[key])
        if (v && !map.has(normLabel(v))) map.set(normLabel(v), PENDING)
      }
    }
    index.set(sheet.collection, map)
  }
}

// Human label for a row in the preview: the spec's own `rowLabel`, else the first non-`id` column
// that has a value (a relation column falls back to its raw label string), else "Row N".
const defaultRowLabel = (row: ResolvedRow, sheet: SheetSpec): string => {
  for (const col of sheet.columns) {
    if (col.kind === 'id') continue
    const value = str(row.values[col.field]) || str(row.rawLabels[col.field])
    if (value) return value
  }
  return `Row ${row.rowNumber}`
}

const resolveRow = (
  raw: { rowNumber: number; cells: Record<string, unknown> },
  sheet: SheetSpec,
  relationIndex: Map<string, Map<string, string>>,
): { row: ResolvedRow; error?: string } => {
  const values: Record<string, unknown> = {}
  const rawLabels: Record<string, string> = {}
  let error: string | undefined

  for (const col of sheet.columns) {
    const cell = raw.cells[col.field]
    if (col.kind === 'id') {
      values.id = str(cell)
      continue
    }
    if (col.kind === 'boolean') {
      values[col.field] = bool(cell)
      continue
    }
    if (col.kind === 'number') {
      values[col.field] = num(cell)
      if (col.required && values[col.field] === undefined) error ??= `${col.header} is required`
      continue
    }
    if (col.kind === 'enum') {
      const v = str(cell).toLowerCase()
      if (!v) {
        if (col.required) error ??= `${col.header} is required`
      } else if (col.enumValues && !col.enumValues.includes(v)) {
        error ??= `${col.header} "${str(cell)}" is not one of: ${col.enumValues.join(', ')}`
      } else {
        values[col.field] = v
      }
      continue
    }
    if (col.kind === 'relation' && col.relation) {
      const label = str(cell)
      rawLabels[col.field] = label
      if (!label) {
        if (col.required) error ??= `${col.header} is required`
        values[col.field] = ''
        continue
      }
      const id = relationIndex.get(col.relation.collection)?.get(normLabel(label))
      if (!id) {
        error ??= `${col.header} "${label}" was not found in this event`
        values[col.field] = ''
      } else {
        values[col.field] = id
      }
      continue
    }
    // text
    const v = str(cell)
    if (col.required && !v) error ??= `${col.header} is required`
    values[col.field] = v
  }

  return { row: { rowNumber: raw.rowNumber, id: str(values.id), values, rawLabels }, error }
}

const findExisting = async (
  payload: Payload,
  eventId: string,
  sheet: SheetSpec,
  row: ResolvedRow,
): Promise<string | null> => {
  if (row.id) return row.id
  if (sheet.upsertKeyFields.length === 0) return null
  const and: Record<string, unknown>[] = [{ event_id: { equals: eventId } }]
  for (const field of sheet.upsertKeyFields) {
    const value = row.values[field]
    if (value === undefined || value === '') return null
    and.push({ [field]: { equals: value } })
  }
  const res = await payload.find({ collection: sheet.collection as never, depth: 0, limit: 1, where: { and } as Where })
  return res.docs[0] ? String((res.docs[0] as { id: unknown }).id) : null
}

export async function planMenuImport(
  payload: Payload,
  eventId: string,
  spec: MenuIoSpec,
  parsed: RawSheetRows[],
): Promise<ImportPlan> {
  const relationIndex = await buildRelationIndex(payload, eventId, spec)
  seedForwardReferences(relationIndex, parsed)
  const ctx: SheetContext = { payload, eventId, relationIndex }
  const rows: RowPlan[] = []

  for (const { sheet, rows: rawRows } of parsed) {
    for (const raw of rawRows) {
      const { row, error } = resolveRow(raw, sheet, relationIndex)
      const label = sheet.rowLabel?.(row) || defaultRowLabel(row, sheet)
      if (error) {
        rows.push({ sheet: sheet.sheetName, rowNumber: row.rowNumber, label, action: 'error', reason: error })
        continue
      }
      const data = sheet.toData(row, ctx)
      const dataError = toDataError(data)
      if (dataError) {
        rows.push({ sheet: sheet.sheetName, rowNumber: row.rowNumber, label, action: 'error', reason: dataError })
        continue
      }
      const existingId = await findExisting(payload, eventId, sheet, row)
      rows.push({
        sheet: sheet.sheetName,
        rowNumber: row.rowNumber,
        label,
        action: existingId ? 'update' : 'create',
      })
    }
  }

  const counts = { create: 0, update: 0, skip: 0, error: 0 }
  for (const r of rows) counts[r.action] += 1
  return { rows, counts }
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------
export async function applyMenuImport(
  payload: Payload,
  eventId: string,
  actorUserId: string | number,
  spec: MenuIoSpec,
  parsed: RawSheetRows[],
): Promise<ImportSummary> {
  let relationIndex = await buildRelationIndex(payload, eventId, spec)
  const ctx: SheetContext = { payload, eventId, relationIndex }
  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] }

  for (const [sheetIndex, { sheet, rows: rawRows }] of parsed.entries()) {
    // Rebuild the label->id index before every sheet after the first so a Roster row can reference
    // a Team the same workbook just created, a Team its new captain Player, etc.
    if (sheetIndex > 0) {
      relationIndex = await buildRelationIndex(payload, eventId, spec)
      ctx.relationIndex = relationIndex
    }
    for (const raw of rawRows) {
      const { row, error } = resolveRow(raw, sheet, relationIndex)
      const label = sheet.rowLabel?.(row) || defaultRowLabel(row, sheet)
      const fail = (reason: string) => {
        summary.failed += 1
        summary.errors.push({ sheet: sheet.sheetName, rowNumber: row.rowNumber, label, reason })
      }
      if (error) {
        fail(error)
        continue
      }
      const data = sheet.toData(row, ctx)
      const dataError = toDataError(data)
      if (dataError) {
        fail(dataError)
        continue
      }
      try {
        const existingId = await findExisting(payload, eventId, sheet, row)
        const payloadData = { ...data, event_id: Number(eventId) }
        if (existingId) {
          const before = await payload.findByID({ collection: sheet.collection as never, id: existingId, depth: 0 }).catch(() => null)
          await payload.update({ collection: sheet.collection as never, id: existingId, data: payloadData as never })
          await recordAuditLog({ payload, action: `${sheet.collection}.import_update`, entityType: sheet.collection, entityId: existingId, before, after: payloadData, actorUserId })
          summary.updated += 1
        } else {
          const created = await payload.create({ collection: sheet.collection as never, data: payloadData as never })
          await recordAuditLog({ payload, action: `${sheet.collection}.import_create`, entityType: sheet.collection, entityId: String((created as { id: unknown }).id), before: null, after: payloadData, actorUserId })
          summary.created += 1
        }
      } catch (err) {
        fail(err instanceof Error ? err.message : 'write failed')
      }
    }
  }

  return summary
}
