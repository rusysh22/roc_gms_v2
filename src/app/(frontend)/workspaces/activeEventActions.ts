'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { canAccessEvent } from '@/access/eventMembership'
import { ACTIVE_EVENT_COOKIE } from './activeEvent'
import { getAuthenticatedWorkspaceUser } from './workspaceAuth'

export async function setActiveEventAction(formData: FormData): Promise<void> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedWorkspaceUser(payload)
  const eventId = typeof formData.get('eventId') === 'string' ? String(formData.get('eventId')).trim() : ''
  const returnTo =
    typeof formData.get('returnTo') === 'string' && formData.get('returnTo')
      ? String(formData.get('returnTo'))
      : '/workspaces/event-admin'

  if (!user) {
    redirect('/login')
  }
  if (eventId) {
    // AUDIT_E2E AUTH-01/AUTH-03: previously any authenticated staff account of any role could
    // point the active-event cookie at any event id in the system with no ownership check at all.
    // The event must exist and this user must actually be allowed to access it.
    const event = await payload.findByID({ collection: 'events', id: eventId, depth: 0 }).catch(() => null)
    if (!event) {
      redirect(`${returnTo}?workspaceError=unknown_event`)
    }
    if (!(await canAccessEvent(payload, user, eventId))) {
      redirect(`${returnTo}?workspaceError=unauthorized`)
    }

    const cookieStore = await cookies()
    cookieStore.set(ACTIVE_EVENT_COOKIE, eventId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  redirect(returnTo)
}
