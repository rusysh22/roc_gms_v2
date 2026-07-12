import { buildParticipantsTemplateWorkbook } from '@/lib/participantsImportTemplate'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../../workspaceAuth'
import { wizardPage } from '../wizardShared'

export async function GET() {
  await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.eventAdmin, returnTo: wizardPage })

  const buffer = buildParticipantsTemplateWorkbook()

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="participants-import-template.xlsx"',
    },
  })
}
