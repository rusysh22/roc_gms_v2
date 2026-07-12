'use client'

import { usePathname } from 'next/navigation'
import { CalendarRange } from 'lucide-react'

import type { ActiveEventDoc } from '../activeEvent'
import { setActiveEventAction } from '../activeEventActions'

// Event = the active "company"/tenant in this workspace (see activeEvent.ts) - switching it
// changes which club/team/entry/match data every other page shows, so it lives right next to the
// account info in the sidebar footer rather than buried in a settings page.
export function EventSwitcher({
  events,
  activeEventId,
}: {
  events: ActiveEventDoc[]
  activeEventId?: string | number
}) {
  const pathname = usePathname()

  if (events.length === 0) {
    return null
  }

  return (
    <form action={setActiveEventAction} className="flex flex-col gap-1 px-3 py-2">
      <input type="hidden" name="returnTo" value={pathname} />
      <span className="flex items-center gap-1.5 text-[0.65rem] font-bold tracking-wide text-ink-soft uppercase">
        <CalendarRange className="h-3 w-3" aria-hidden="true" />
        Active event
      </span>
      <select
        name="eventId"
        defaultValue={activeEventId ? String(activeEventId) : ''}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="w-full rounded-[10px] border border-line bg-paper px-2 py-2 text-sm font-bold text-ink focus-visible:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/20"
      >
        {events.map((event) => (
          <option key={event.id} value={String(event.id)}>
            {event.name}
          </option>
        ))}
      </select>
    </form>
  )
}
