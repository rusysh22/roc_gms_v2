'use client'

import { useEffect, useRef } from 'react'

import { claimDraftEventAction } from './eventActions'

// Renders nothing. When a signed-in organizer opens a wizard whose event is still an unclaimed
// anonymous draft (they just registered/logged in from the login wall), this fires the claim
// exactly once - it enrols them as the event's owner and clears the draft token, after which the
// server re-renders without this component. Mirrors WizardStepMemory's "invisible client effect".
export const WizardDraftClaim = ({ eventId }: { eventId: string }) => {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current || !eventId) return
    fired.current = true
    const formData = new FormData()
    formData.set('eventId', eventId)
    void claimDraftEventAction(formData)
  }, [eventId])

  return null
}
