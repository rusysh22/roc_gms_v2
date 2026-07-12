import type { ReactNode } from 'react'
import { getPayload } from 'payload'

import config from '@payload-config'
import { getActiveEvent, listEventsForSwitcher } from '@/app/(frontend)/workspaces/activeEvent'
import { getAuthenticatedWorkspaceUser } from '@/app/(frontend)/workspaces/workspaceAuth'
import { WorkspaceShellChrome } from './WorkspaceShellChrome'

export default async function WorkspaceShellLayout({ children }: { children: ReactNode }) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedWorkspaceUser(payload)
  const [activeEvent, events] = await Promise.all([
    getActiveEvent(payload),
    listEventsForSwitcher(payload),
  ])

  return (
    <WorkspaceShellChrome
      roles={user?.roles}
      email={user?.email}
      events={events}
      activeEventId={activeEvent?.id}
    >
      {children}
    </WorkspaceShellChrome>
  )
}
