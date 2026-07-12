import type { ReactNode } from 'react'
import { getPayload } from 'payload'

import config from '@payload-config'
import { getAuthenticatedWorkspaceUser } from '@/app/(frontend)/workspaces/workspaceAuth'
import { WorkspaceShellChrome } from './WorkspaceShellChrome'

export default async function WorkspaceShellLayout({ children }: { children: ReactNode }) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedWorkspaceUser(payload)

  return (
    <WorkspaceShellChrome roles={user?.roles} email={user?.email}>
      {children}
    </WorkspaceShellChrome>
  )
}
