import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'

// Shared header for every distraction-free (focus) flow (New Event Wizard, Live Score) - no
// sidebar/topbar chrome here on purpose, just a way back and the current context.
export function FocusHeader({
  backHref,
  backLabel = 'Back',
  title,
  subtitle,
  right,
  children,
  maxWidthClassName = 'max-w-5xl',
}: {
  backHref: string
  backLabel?: string
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  children?: ReactNode
  /** Matches the width of whatever body layout sits below the header - defaults to the width
   * used by the only other current (focus) flow (Live Score) but the New Event Wizard's wider
   * two-column body passes its own so the title/stepper line up with the content underneath. */
  maxWidthClassName?: string
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur-sm">
      <div className={cn('mx-auto flex flex-wrap items-center justify-between gap-3', maxWidthClassName)}>
        <div className="min-w-0">
          <Link
            href={backHref}
            className="mb-1 inline-flex items-center gap-1 text-sm font-bold text-blue no-underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
          <h1 className="max-w-none truncate text-xl font-extrabold leading-tight text-ink md:text-2xl">
            {title}
          </h1>
          {subtitle ? <p className="mt-0.5 text-sm font-semibold text-ink-soft">{subtitle}</p> : null}
        </div>
        {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
      {children ? <div className={cn('mx-auto mt-3', maxWidthClassName)}>{children}</div> : null}
    </header>
  )
}
