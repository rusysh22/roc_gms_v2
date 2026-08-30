'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { stepMemoryKey } from '../../(focus)/event-admin/new-event/WizardStepMemory'

// prd/redesign/import-data-and-draft-persistence.md track DR-2: the server computes the first
// *incomplete* wizard step as a safe default resume target. If this browser also has a record of
// the step the organizer last had open for this event (written by WizardStepMemory), prefer that -
// they may have been mid-review on a step that already counts as "done".
//
// Progressive enhancement: renders the server default immediately, then upgrades the href on mount
// if localStorage has something newer. A storage failure leaves the server default in place.

const VALID_STEPS = new Set([
  'setup',
  'event',
  'sports',
  'categories',
  'participants',
  'registration',
  'draw',
  'generate',
  'bracket',
  'history',
])

export const ResumeSetupLink = ({
  eventId,
  defaultStep,
  label,
  className,
}: {
  eventId: string | number
  defaultStep: string
  label: string
  className?: string
}) => {
  const [step, setStep] = useState(defaultStep)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(stepMemoryKey(eventId))
      if (!raw) return
      const parsed = JSON.parse(raw) as { step?: unknown }
      if (typeof parsed?.step === 'string' && VALID_STEPS.has(parsed.step)) {
        setStep(parsed.step)
      }
    } catch {
      /* keep the server default */
    }
  }, [eventId])

  return (
    <Button asChild className={className}>
      <Link href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=${step}`}>{label}</Link>
    </Button>
  )
}
