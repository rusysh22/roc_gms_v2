import { buildEventDataTemplateWorkbook } from '@/lib/eventDataTemplate'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../../workspaceAuth'
import { getWizardEvent, wizardPage } from '../wizardShared'

// prd/redesign/import-data-and-draft-persistence.md track IMP, template variant 2 ("Download
// template for this event"): the blank template lives at ../participants-template; this one is
// pre-filled from the event whose id is in the query string.
export async function GET(request: Request) {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = new URL(request.url).searchParams.get('eventId') || ''
  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    return new Response('Event not found', { status: 404 })
  }

  const buffer = await buildEventDataTemplateWorkbook(payload, eventId)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="event-data-import-template.xlsx"',
    },
  })
}
