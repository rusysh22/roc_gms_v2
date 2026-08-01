'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
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
    const cookieStore = await cookies()
    cookieStore.set(ACTIVE_EVENT_COOKIE, eventId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  redirect(returnTo)
}
