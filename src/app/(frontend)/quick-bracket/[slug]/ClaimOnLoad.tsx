'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { claimQuickBracketAction } from './claimQuickBracketAction'

const ERROR_MESSAGES: Record<string, string> = {
  not_signed_in: 'You need to be signed in to claim this tournament.',
  not_found: 'This guest tournament could not be found.',
  not_active: 'This guest tournament has already been claimed.',
  expired: 'This guest tournament has expired.',
  not_owner:
    'Only the browser that created this tournament can claim it. Sign up separately to create your own.',
  failed: 'Something went wrong while setting up your event. Please try again.',
}

// Mounted only on `/quick-bracket/[slug]?claim=1` right after register/login redirects back here
// with a fresh session (see page.tsx) - calling the server action directly (not via a form) is the
// supported way to invoke it from a client effect, and is what lets it mutate cookies (a Server
// Component render can only read cookies, not set them).
export function ClaimOnLoad({ slug }: { slug: string }) {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // React StrictMode (on in this app's next.config.mjs) intentionally mounts every effect twice in
  // dev - a `cancelled`-in-cleanup flag only stops the FIRST run's result from updating state, it
  // doesn't stop the second run from actually firing the mutation again. Since claiming is a
  // one-shot server mutation (the action itself rejects a second attempt once status flips to
  // 'claimed'), that second call "wins" the race with a `not_active` failure and stomps the first
  // call's real success. A ref survives the mount/cleanup/remount cycle within one component
  // instance, so it reliably makes the actual network call fire only once.
  const hasStartedRef = useRef(false)

  useEffect(() => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    claimQuickBracketAction(slug).then((result) => {
      if (result.ok) {
        router.push(
          `/workspaces/event-admin/new-event?eventId=${result.eventId}&step=event&claimed=1`,
        )
        router.refresh()
        return
      }
      setErrorMessage(ERROR_MESSAGES[result.reason] || ERROR_MESSAGES.failed)
    })
  }, [slug, router])

  if (errorMessage) {
    return (
      <div className="mb-6 rounded-panel border border-danger/40 bg-danger/5 p-4 text-sm font-semibold text-danger">
        {errorMessage}
      </div>
    )
  }

  return (
    <div className="mb-6 flex items-center gap-3 rounded-panel border border-line bg-mist p-4 text-sm text-ink-soft">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Setting up your event from this bracket...
    </div>
  )
}
