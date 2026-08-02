'use client'

import Link from 'next/link'
import { AlertTriangle, Loader2, SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// AUDIT_UI_UX_CSS UI-09: no route ever had its own loading/error/not-found boundary, so a slow
// data fetch showed a blank white flash and a thrown error or notFound() fell straight through to
// Next.js's unstyled framework default - both read as "the app is broken," not "the app is
// working as designed." Shared here so every error.tsx/not-found.tsx/loading.tsx across the route
// tree renders the same family instead of each inventing its own copy.

export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center"
    >
      <AlertTriangle className="h-8 w-8 text-danger" aria-hidden="true" />
      <h1 className="text-lg font-extrabold text-ink">Something went wrong</h1>
      <p className="text-sm text-ink-soft">
        This page hit an unexpected error. Retrying usually fixes it - if it keeps happening, the
        team has already been notified.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-ink-soft/70">Reference: {error.digest}</p>
      ) : null}
      <Button type="button" onClick={reset} className="mt-2">
        Try again
      </Button>
    </div>
  )
}

export function RouteNotFound({
  title = 'Page not found',
  description = "The page you're looking for doesn't exist or may have moved.",
  backHref = '/',
  backLabel = 'Back to home',
}: {
  title?: string
  description?: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
      <SearchX className="h-8 w-8 text-ink-soft" aria-hidden="true" />
      <h1 className="text-lg font-extrabold text-ink">{title}</h1>
      <p className="text-sm text-ink-soft">{description}</p>
      <Button asChild className="mt-2">
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  )
}

export function RouteLoading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {label}
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-2/3" />
    </div>
  )
}
