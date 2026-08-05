'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// AUDIT_E2E MAT-08: the event homepage polled every 30s, but public match detail, schedule,
// standings, and bracket pages did not - once a visitor navigated into any of those, "live" stopped
// being live. `showIndicator` additionally renders the blueprint's "Live · Updated Ns ago" badge
// (see PRODUCT_FLOW_BLUEPRINT section 8.3) so a visitor can tell the page is still polling instead
// of silently going stale with no feedback.
export function AutoRefresh({
  intervalMs = 15000,
  showIndicator = false,
  compact = false,
  className,
}: {
  intervalMs?: number
  showIndicator?: boolean
  compact?: boolean
  className?: string
}) {
  const router = useRouter()
  const [secondsAgo, setSecondsAgo] = useState(0)

  useEffect(() => {
    const refreshTimer = setInterval(() => {
      router.refresh()
      setSecondsAgo(0)
    }, intervalMs)

    return () => clearInterval(refreshTimer)
  }, [router, intervalMs])

  useEffect(() => {
    if (!showIndicator) {
      return
    }

    const tickTimer = setInterval(() => {
      setSecondsAgo((value) => value + 1)
    }, 1000)

    return () => clearInterval(tickTimer)
  }, [showIndicator])

  if (!showIndicator) {
    return null
  }

  const updatedLabel = secondsAgo === 0 ? 'just now' : `${secondsAgo}s ago`

  return (
    <p
      className={
        className ||
        'inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft'
      }
      title={compact ? `Live · Updated ${updatedLabel}` : undefined}
      suppressHydrationWarning
    >
      <span className="h-1.5 w-1.5 rounded-full bg-green" aria-hidden="true" />
      {compact ? 'Live' : `Live · Updated ${updatedLabel}`}
    </p>
  )
}
