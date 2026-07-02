'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'

export interface CountdownProps {
  startIso: string
  endIso: string
  className?: string
}

type Phase = 'before' | 'live' | 'after'

type Remaining = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getPhase(startIso: string, endIso: string, now: number): Phase {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (now < start) return 'before'
  if (now <= end) return 'live'
  return 'after'
}

function getRemaining(targetIso: string, now: number): Remaining {
  const diffSeconds = Math.max(0, Math.floor((new Date(targetIso).getTime() - now) / 1000))
  return {
    days: Math.floor(diffSeconds / 86400),
    hours: Math.floor((diffSeconds % 86400) / 3600),
    minutes: Math.floor((diffSeconds % 3600) / 60),
    seconds: diffSeconds % 60,
  }
}

const UNITS: Array<{ key: keyof Remaining; label: string }> = [
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hrs' },
  { key: 'minutes', label: 'Min' },
  { key: 'seconds', label: 'Sec' },
]

// Hero widget per prd/redesign/README.md section 4.1: rounded-panel (16px) + shadow, since it is
// one of the floating elements allowed to carry elevation. Ticks client-side from Event
// start/end; server and first client render can legitimately differ by a second, so the numeric
// spans suppress that specific hydration warning rather than gating on a mount flag.
export function Countdown({ startIso, endIso, className }: CountdownProps) {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const phase = getPhase(startIso, endIso, now)

  const wrapperClassName = cn(
    'flex items-center gap-4 rounded-panel border border-line bg-paper/90 p-4 shadow-md backdrop-blur font-sans',
    className,
  )

  if (phase === 'live') {
    return (
      <div className={wrapperClassName}>
        <StatusBadge tone="gold">Live</StatusBadge>
        <p className="text-sm font-semibold text-ink">The event is happening now.</p>
      </div>
    )
  }

  if (phase === 'after') {
    return (
      <div className={wrapperClassName}>
        <StatusBadge tone="green">Completed</StatusBadge>
        <p className="text-sm font-semibold text-ink">This event has wrapped up.</p>
      </div>
    )
  }

  const remaining = getRemaining(startIso, now)

  return (
    <div className={wrapperClassName} aria-label="Countdown to event start">
      {UNITS.map((unit) => (
        <div key={unit.key} className="flex flex-col items-center gap-1 px-1">
          <span
            className="font-sans text-2xl font-extrabold tabular-nums text-ink"
            suppressHydrationWarning
          >
            {String(remaining[unit.key]).padStart(2, '0')}
          </span>
          <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-soft">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  )
}
