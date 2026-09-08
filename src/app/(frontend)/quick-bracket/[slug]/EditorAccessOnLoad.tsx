'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { attachQuickBracketEditorAction } from './quickBracketEditActions'

const ERROR_MESSAGES: Record<string, string> = {
  not_signed_in: 'You need to be signed in to edit this bracket.',
  not_found: 'This guest tournament could not be found.',
  expired: 'This guest tournament has expired.',
  not_owner:
    'Only the browser that created this tournament can unlock editing on it. Sign up separately to create your own.',
}

// Mounted only on `/quick-bracket/[slug]?claim=1` right after register/login redirects back here
// with a fresh session - attaches the signed-in account as this bracket's owner_user_id (verified
// against the owner_token cookie), then reloads the page in place so it renders in edit mode.
// Renamed/repurposed from the old ClaimOnLoad, which used to auto-create a full event here instead
// - see prd/design/QUICK_BRACKET_TOURNAMENT_DESIGN.md section 11.
export function EditorAccessOnLoad({ slug }: { slug: string }) {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // React StrictMode (on in this app's next.config.mjs) intentionally mounts every effect twice in
  // dev - a ref survives that mount/cleanup/remount cycle within one component instance, so it
  // reliably makes the actual network call fire only once (see the equivalent note this replaced
  // in the old ClaimOnLoad.tsx).
  const hasStartedRef = useRef(false)

  useEffect(() => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    attachQuickBracketEditorAction(slug).then((result) => {
      if (result.ok) {
        router.replace(`/quick-bracket/${slug}`)
        router.refresh()
        return
      }
      setErrorMessage(ERROR_MESSAGES[result.reason] || 'Something went wrong. Please try again.')
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
      Unlocking editing on this bracket...
    </div>
  )
}
