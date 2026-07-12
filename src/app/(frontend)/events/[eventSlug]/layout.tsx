import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { getEventThemeStyle } from '@/lib/eventTheme'
import { getPublicEventBySlug } from '../publicEvents'

export default async function EventLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ eventSlug: string }>
}) {
  const { eventSlug } = await params
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)

  if (!event) {
    notFound()
  }

  return <div style={getEventThemeStyle(event.theme_config?.preset)}>{children}</div>
}
