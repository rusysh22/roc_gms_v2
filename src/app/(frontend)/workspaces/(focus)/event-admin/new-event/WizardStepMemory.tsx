'use client'

import { useEffect } from 'react'

// prd/redesign/import-data-and-draft-persistence.md track DR-2: the server can send a returning
// organizer to the first *incomplete* step, but it cannot know which step they were actually
// looking at when they got interrupted (a half-read History log, a Draw they wanted to revisit).
// This records the current step per event in localStorage so the Event Admin landing's
// ResumeSetupLink can offer that exact step instead of the computed default.
//
// Renders nothing. localStorage access is wrapped because private-mode / storage-blocked browsers
// throw on it - a failure here just means "resume falls back to the server default".

export const stepMemoryKey = (eventId: string | number) => `roc:new-event:${eventId}:last-step`

export const WizardStepMemory = ({ eventId, step }: { eventId: string | number; step: string }) => {
  useEffect(() => {
    if (!eventId || !step) return
    try {
      window.localStorage.setItem(
        stepMemoryKey(eventId),
        JSON.stringify({ step, savedAt: new Date().toISOString() }),
      )
    } catch {
      /* see file header */
    }
  }, [eventId, step])

  return null
}
