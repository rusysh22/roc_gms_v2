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
      {/* AUDIT_UI_UX_CSS axe: this was a plain <span>, visually next to the select but never
          actually associated with it - screen readers had no accessible name for the select
          at all (critical: select-name). A real <label htmlFor> fixes it without changing
          how it looks. */}
      <label
        htmlFor="active-event-select"
        className="flex items-center gap-1.5 text-[0.65rem] font-bold tracking-wide text-ink-soft uppercase"
      >
        <CalendarRange className="h-3 w-3" aria-hidden="true" />
        Active event
      </label>
      <select
        id="active-event-select"
        name="eventId"
        defaultValue={activeEventId ? String(activeEventId) : ''}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="w-full rounded-[10px] border border-line bg-paper px-2 py-2 text-sm font-bold text-ink focus-visible:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/20"
      >
        {events.map((event) => (
          <option key={event.id} value={String(event.id)}>
            {/* A draft event is one whose setup was never finished/published - flag it here so an
                admin juggling several events can tell at a glance which one still needs work. */}
            {event.name}
            {event.status === 'draft' ? ' · draft' : ''}
          </option>
        ))}
      </select>
    </form>
  )
}
