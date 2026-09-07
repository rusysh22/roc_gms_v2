import { randomUUID } from 'node:crypto'

import { getPayload } from 'payload'
import config from '@payload-config'

import {
  deleteScratch,
  readScratchXlsx,
  writeScratchXlsx,
  SCRATCH_FILENAME_PATTERN,
} from '@/lib/importScratch'
import {
  applyMenuImport,
  buildMenuWorkbook,
  parseMenuWorkbook,
  planMenuImport,
} from '@/lib/collectionIo/engine'
import { MENU_IO_SPECS } from '@/lib/collectionIo/specs'
import {
  getAuthenticatedWorkspaceUser,
  hasWorkspaceRole,
} from '@/app/(frontend)/workspaces/workspaceAuth'
import { getActiveEvent } from '@/app/(frontend)/workspaces/activeEvent'
import type { UserRole } from '@/access/roles'

// Per-menu Excel import/export for the Event Admin list pages. One dynamic route dispatches on the
// `[menu]` segment to the matching spec in src/lib/collectionIo/specs.ts.
//   GET  ?           -> download the pre-filled workbook (export)
//   POST multipart   -> upload a workbook, get back { scratchId, plan } (dry run, no writes)
//   POST json+confirm-> apply a previewed scratch file, get back { summary }

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

type Ctx = { params: Promise<{ menu: string }> }

const resolve = async (ctx: Ctx) => {
  const { menu } = await ctx.params
  const spec = MENU_IO_SPECS[menu]
  if (!spec) return { error: Response.json({ error: 'unknown menu' }, { status: 404 }) } as const

  const payload = await getPayload({ config })
  const user = await getAuthenticatedWorkspaceUser(payload)
  if (!user) return { error: Response.json({ error: 'unauthenticated' }, { status: 401 }) } as const
  if (!hasWorkspaceRole(user, spec.allowedRoles as UserRole[])) {
    return { error: Response.json({ error: 'forbidden' }, { status: 403 }) } as const
  }
  const event = await getActiveEvent(payload)
  if (!event) return { error: Response.json({ error: 'no active event' }, { status: 409 }) } as const

  return { spec, payload, user, eventId: String(event.id) } as const
}

export async function GET(_request: Request, ctx: Ctx) {
  const r = await resolve(ctx)
  if ('error' in r) return r.error

  const buffer = await buildMenuWorkbook(r.payload, r.eventId, r.spec)
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${r.spec.fileStem}-import.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(request: Request, ctx: Ctx) {
  const r = await resolve(ctx)
  if ('error' in r) return r.error
  const { spec, payload, user, eventId } = r

  const contentType = request.headers.get('content-type') || ''

  // --- Confirm: apply a previously previewed scratch file ---
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as { scratchId?: string }
    const scratchId = String(body.scratchId || '')
    const filename = `${scratchId}.xlsx`
    if (!SCRATCH_FILENAME_PATTERN.test(filename)) {
      return Response.json({ error: 'invalid scratch id' }, { status: 400 })
    }
    const buffer = await readScratchXlsx(filename)
    if (!buffer) return Response.json({ error: 'preview expired - upload again' }, { status: 410 })

    const parsed = parseMenuWorkbook(buffer, spec)
    const summary = await applyMenuImport(payload, eventId, user.id, spec, parsed)
    await deleteScratch(scratchId)
    return Response.json({ summary })
  }

  // --- Preview: parse + dry-run plan, stash the file for a later confirm ---
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: 'no file uploaded' }, { status: 400 })
  }
  const buffer = Buffer.from(await file.arrayBuffer())

  let plan
  try {
    const parsed = parseMenuWorkbook(buffer, spec)
    if (parsed.every((sheet) => sheet.rows.length === 0)) {
      return Response.json({ error: 'the workbook has no data rows' }, { status: 400 })
    }
    plan = await planMenuImport(payload, eventId, spec, parsed)
  } catch (err) {
    payload.logger.error(`collectionIo preview failed for ${spec.menu}: ${err instanceof Error ? err.stack : String(err)}`)
    return Response.json({ error: 'could not read that workbook' }, { status: 400 })
  }

  const scratchId = randomUUID()
  await writeScratchXlsx(scratchId, buffer)
  return Response.json({ scratchId, plan })
}
