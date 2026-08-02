import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { buttonVariants } from './button'
import { cn } from '@/lib/utils'

// AUDIT_UI_UX_CSS ADM-08: pagination wasn't standardized anywhere - most admin lists just raised
// `limit` past any plausible dataset size instead. That's fine until it isn't; this gives list
// pages a real, cheap way to opt in without a client-side data-table engine. Server-rendered
// (plain <Link> hrefs the caller builds from Payload's own find() pagination fields), so it works
// with every existing server-component list page unchanged.
export function Pagination({
  page,
  totalPages,
  hasPrevPage,
  hasNextPage,
  totalDocs,
  buildHref,
}: {
  page: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
  totalDocs: number
  buildHref: (page: number) => string
}) {
  if (totalPages <= 1) return null

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-ink-soft"
    >
      <p>
        Page {page} of {totalPages} &middot; {totalDocs} total
      </p>
      <div className="flex items-center gap-2">
        {hasPrevPage ? (
          <Link href={buildHref(page - 1)} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'pointer-events-none opacity-50')}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </span>
        )}
        {hasNextPage ? (
          <Link href={buildHref(page + 1)} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'pointer-events-none opacity-50')}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  )
}
