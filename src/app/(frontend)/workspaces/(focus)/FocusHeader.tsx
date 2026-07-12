import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

// Shared header for every distraction-free (focus) flow (New Event Wizard, Live Score) - no
// sidebar/topbar chrome here on purpose, just a way back and the current context.
export function FocusHeader({
  backHref,
  backLabel = 'Back',
  title,
  subtitle,
  right,
  children,
}: {
  backHref: string
  backLabel?: string
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
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
      {children ? <div className="mx-auto mt-3 max-w-5xl">{children}</div> : null}
    </header>
  )
}
