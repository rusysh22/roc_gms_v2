import type { ReactNode } from 'react'
import { getPayload } from 'payload'

import config from '@payload-config'
import { getActiveEvent, listEventsForSwitcher } from '@/app/(frontend)/workspaces/activeEvent'
import { getAuthenticatedWorkspaceUser } from '@/app/(frontend)/workspaces/workspaceAuth'
import { checkSubscription } from '@/lib/berlanggan/subscriptionGate'
import { WorkspaceShellChrome } from './WorkspaceShellChrome'

export default async function WorkspaceShellLayout({ children }: { children: ReactNode }) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedWorkspaceUser(payload)
  const [activeEvent, events, subscription] = await Promise.all([
    getActiveEvent(payload),
    user ? listEventsForSwitcher(payload, user) : Promise.resolve([]),
    // BILL-01: the gate already computes grace but every caller threw it away - surface it as a
    // dunning banner so a customer whose payment is overdue hears about it before access is cut.
    user ? checkSubscription(payload, user.id) : Promise.resolve({ ok: true as const, grace: false }),
  ])

  return (
    <WorkspaceShellChrome
      roles={user?.roles}
      email={user?.email}
      events={events}
      activeEventId={activeEvent?.id}
      subscriptionGrace={subscription.ok && subscription.grace}
    >
      {children}
    </WorkspaceShellChrome>
  )
}
