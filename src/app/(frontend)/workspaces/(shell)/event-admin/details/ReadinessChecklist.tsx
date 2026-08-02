import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'
import type { Payload } from 'payload'

import { Card, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// AUDIT_UI_UX_CSS ADM-15/P2 item 7: nothing stopped an event from being flipped to
// status=live/visibility=published with no venues, no matches, or no confirmed participants -
// this doesn't block that (status/visibility are still plain fields on the same form), it just
// makes the gap visible before an admin does it by accident. Every check here is genuinely
// optional/informational; a small or informal event may legitimately skip some of these.
type ReadinessItem = {
  label: string
  done: boolean
  href: string
}

export async function ReadinessChecklist({ payload, eventId }: { payload: Payload; eventId: string }) {
  const eventWhere = { event_id: { equals: eventId } }
  const [categories, venues, confirmedEntries, matches] = await Promise.all([
    payload.find({ collection: 'competition-categories', depth: 0, limit: 1, where: eventWhere }),
    payload.find({ collection: 'venues', depth: 0, limit: 1, where: eventWhere }),
    payload.find({
      collection: 'competition-entries',
      depth: 0,
      limit: 1,
      where: { and: [eventWhere, { status: { equals: 'confirmed' } }] },
    }),
    payload.find({ collection: 'matches', depth: 0, limit: 1, where: eventWhere }),
  ])

  const items: ReadinessItem[] = [
    {
      label: 'At least one sport/category is set up',
      done: categories.totalDocs > 0,
      href: '/workspaces/event-admin/new-event?step=categories',
    },
    {
      label: 'At least one venue is configured',
      done: venues.totalDocs > 0,
      href: '/workspaces/event-admin/facilities',
    },
    {
      label: 'At least one participant is confirmed',
      done: confirmedEntries.totalDocs > 0,
      href: '/workspaces/event-admin/entries',
    },
    {
      label: 'Matches have been generated',
      done: matches.totalDocs > 0,
      href: '/workspaces/scheduler',
    },
  ]
  const readyCount = items.filter((item) => item.done).length

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>Publish readiness</CardTitle>
        <span className="text-sm font-bold text-ink-soft">
          {readyCount}/{items.length} ready
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="flex items-center gap-2 rounded-card border border-line px-3 py-2 text-sm font-semibold no-underline transition-colors hover:border-green"
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green" aria-hidden="true" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-ink-soft/50" aria-hidden="true" />
              )}
              <span className={cn(item.done ? 'text-ink' : 'text-ink-soft')}>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
