import type { Payload } from 'payload'

// Spec-driven Excel import/export for the Event Admin list menus. One `MenuIoSpec` per menu; each
// sheet inside it is one Payload collection. The engine (engine.ts) reads a spec to build the
// download workbook, parse an uploaded one, dry-run a plan, and apply it - so a new menu is a spec,
// not another hand-rolled importer.
//
// Design notes:
// - Every row is scoped to the active event. Import never crosses events; export only emits the
//   active event's rows.
// - Relationship columns carry a human LABEL (a name or slug), never a database id. Export resolves
//   id -> label; import resolves label -> id against the active event's rows.
// - Upsert: rows are matched to an existing record by `upsertKeyFields` (a natural key like `slug`,
//   or `(sport, name)`); when a spec has no natural key the hidden `id` column is the only match key
//   and a blank `id` always means "create".

export type ColumnKind = 'text' | 'number' | 'boolean' | 'enum' | 'relation' | 'id'

export interface ColumnSpec {
  /** Excel column header (also the parse key - case-insensitive, spaces/underscores normalized). */
  header: string
  /** Payload field name this column maps to. For `kind: 'id'` use `id`. */
  field: string
  kind: ColumnKind
  /** Reject the row on import if this cell is empty. */
  required?: boolean
  /** `kind: 'enum'` - allowed values (lowercased on compare). */
  enumValues?: readonly string[]
  /** `kind: 'relation'` - the related collection + which field is the human label. */
  relation?: {
    collection: string
    /** Field used as the label in the workbook (matched case-insensitively on import). */
    labelField: 'name' | 'slug' | 'display_name'
    /** Extra scoping when resolving the label, e.g. category scoped by its sport. Optional. */
    scopeField?: string
  }
  /** Short help text appended to the Instructions sheet. */
  note?: string
}

export interface ResolvedRow {
  /** 1-based row number in the sheet (for error messages). */
  rowNumber: number
  /** Existing record id if the `id` column was filled, else ''. */
  id: string
  /** field -> coerced value. Relation fields hold the resolved id (string) or '' . */
  values: Record<string, unknown>
  /** Raw label strings for relation fields, kept for error messages. */
  rawLabels: Record<string, string>
}

export interface SheetContext {
  payload: Payload
  eventId: string
  /** collection -> (normalized label -> id). Built once per import. */
  relationIndex: Map<string, Map<string, string>>
}

export interface SheetSpec {
  collection: string
  /** Worksheet tab name. */
  sheetName: string
  columns: ColumnSpec[]
  /** Field names forming the natural upsert key. Empty => match on the hidden `id` column only. */
  upsertKeyFields: string[]
  /**
   * Build the create/update data object for one resolved row. Receives the resolved values
   * (relations already turned into ids). Return `{ error }` to reject the row. `event_id` is added
   * by the engine - do not set it here.
   */
  toData: (row: ResolvedRow, ctx: SheetContext) => Record<string, unknown> | { error: string }
  /** Human label of a row for the preview list (falls back to the first column's value). */
  rowLabel?: (row: ResolvedRow) => string
}

export interface MenuIoSpec {
  /** URL segment: /workspaces/event-admin/io/<menu>. */
  menu: string
  /** Download filename stem. */
  fileStem: string
  /** Roles allowed to import/export this menu (a `WORKSPACE_ROLES` value). */
  allowedRoles: readonly string[]
  sheets: SheetSpec[]
}

export type RowPlan = {
  sheet: string
  rowNumber: number
  label: string
  action: 'create' | 'update' | 'skip' | 'error'
  reason?: string
}

export type ImportPlan = {
  rows: RowPlan[]
  counts: { create: number; update: number; skip: number; error: number }
}

export type ImportSummary = {
  created: number
  updated: number
  skipped: number
  failed: number
  errors: { sheet: string; rowNumber: number; label: string; reason: string }[]
}
