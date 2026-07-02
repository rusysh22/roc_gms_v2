import * as React from 'react'

import { cn } from '@/lib/utils'

// Global status/tone mapping per prd/redesign/README.md section 4.1: winner/positive state is
// always green, live state is always gold, scheduled state is always blue. `neutral` covers
// everything else (drafts, postponed, cancelled, walkover, disputed) without implying an error.
export type StatusTone = 'green' | 'blue' | 'gold' | 'neutral'

const toneClasses: Record<StatusTone, string> = {
  green: 'border-green/30 bg-mist text-green',
  blue: 'border-blue/30 bg-paper text-blue',
  gold: 'border-gold/40 bg-paper text-gold',
  neutral: 'border-line bg-paper text-ink-soft',
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, tone = 'neutral', children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 font-sans text-[0.7rem] font-bold uppercase tracking-wide',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  ),
)
StatusBadge.displayName = 'StatusBadge'

// Starting point for mapping existing Match.status values (prd/README.md section 8.14) onto the
// three global tones. Not exhaustive by design - extend case-by-case as pages adopt StatusBadge.
export function getMatchStatusTone(status: string): StatusTone {
  switch (status) {
    case 'ongoing':
    case 'paused':
      return 'gold'
    case 'finished':
    case 'result_published':
      return 'green'
    case 'scheduled':
    case 'published':
    case 'check_in_open':
    case 'ready_to_start':
      return 'blue'
    default:
      return 'neutral'
  }
}

export { StatusBadge }
