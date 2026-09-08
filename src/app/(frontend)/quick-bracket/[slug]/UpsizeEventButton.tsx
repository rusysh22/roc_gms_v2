'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { upgradeQuickBracketToEventAction } from './upgradeToEventAction'

const ERROR_MESSAGES: Record<string, string> = {
  not_signed_in: 'You need to be signed in.',
  not_found: 'This guest tournament could not be found.',
  not_active: 'This tournament has already been upgraded.',
  expired: 'This guest tournament has expired.',
  not_owner: 'Only the owner of this tournament can upsize it.',
  failed: 'Something went wrong. Please try again.',
}

// The explicit, owner-triggered "next level" action (prd/design/QUICK_BRACKET_TOURNAMENT_DESIGN.md
// section 11) - materializes a real Event from this quick bracket. Deliberately never automatic;
// only ever fired by the owner clicking this button from inside edit mode.
export function UpsizeEventButton({ slug }: { slug: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    const result = await upgradeQuickBracketToEventAction(slug)
    setLoading(false)
    if (!result.ok) {
      setError(ERROR_MESSAGES[result.reason] || ERROR_MESSAGES.failed)
      return
    }
    router.push(`/workspaces/event-admin/new-event?eventId=${result.eventId}&step=event&claimed=1`)
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" onClick={handleClick} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        )}
        Upsize your event
      </Button>
      {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}
    </div>
  )
}
