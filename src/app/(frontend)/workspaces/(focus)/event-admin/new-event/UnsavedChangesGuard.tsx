'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 8 gap-fill ("safe backtracking"): every wizard form is a
// plain uncontrolled <form action={serverAction}> with no client state at all - which is exactly
// why a typed-out name, dates, or a long description had no protection against a stray tab close
// or refresh mid-edit. This only guards the literal close/refresh/back case via the browser's
// native beforeunload prompt - it does NOT intercept in-app <Link> navigation between wizard steps
// (Next.js's App Router has no built-in per-navigation confirm hook to reuse here, and building one
// would mean auditing every Link in the wizard, not just this form - a materially bigger change).
// Applied to the Event step's form first since losing name/dates/logo mid-entry is the single most
// expensive form to retype; the same wrapper is reusable for other long forms later
// (AUDIT_UI_UX_CSS_ROC_GMS_V2.md FORM-18/FORM-19 already tracks the fuller cross-app version).
export const UnsavedChangesGuard = ({ children }: { children: ReactNode }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const dirtyRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const markDirty = () => {
      dirtyRef.current = true
    }
    const markClean = () => {
      dirtyRef.current = false
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) {
        return
      }
      event.preventDefault()
    }

    container.addEventListener('input', markDirty)
    container.addEventListener('change', markDirty)
    container.addEventListener('submit', markClean, true)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      container.removeEventListener('input', markDirty)
      container.removeEventListener('change', markDirty)
      container.removeEventListener('submit', markClean, true)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  return <div ref={containerRef}>{children}</div>
}
