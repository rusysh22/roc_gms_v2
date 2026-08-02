import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import type { WorkspaceMatch } from '../../../workspaceComponents'
import { buildScheduleWorkbook } from '@/lib/scheduleExport'

const schedulerPage = '/workspaces/scheduler'

// AUDIT_UI_UX_CSS ADM-07/P2 item 6: printable/shareable schedule export - venues and referees on
// the day need a sheet, not a link to a live web page.
export async function GET() {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: schedulerPage,
  })
  const activeEvent = await getActiveEvent(payload)
  if (!activeEvent) {
    return new Response('No active event selected.', { status: 400 })
  }

  const matches = await payload.find({
    collection: 'matches',
    depth: 2,
    limit: 1000,
    sort: 'scheduled_start_at',
    where: { event_id: { equals: activeEvent.id } },
  })

  const buffer = buildScheduleWorkbook(matches.docs as WorkspaceMatch[])
  const filename = `${activeEvent.slug}-schedule.xlsx`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
