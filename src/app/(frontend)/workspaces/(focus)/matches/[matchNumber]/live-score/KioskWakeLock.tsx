'use client'

import { useEffect } from 'react'

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15 P2 "device/kiosk mode": a tablet propped up
// courtside for the whole match needs the screen to stay on - the Wake Lock API is the standards
// track for that, no native app/MDM profile required. Silently no-ops on unsupported browsers
// (Safari < 16.4, most non-Chromium mobile browsers) since this is a nice-to-have, not a
// correctness requirement - the officer can still tap the screen to wake it manually.
export function KioskWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) {
      return
    }

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const requestLock = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          await lock.release()
          return
        }
        sentinel = lock
      } catch {
        // Permission denied or unsupported in this context - nothing to recover, the officer
        // can still tap to wake the screen manually.
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !sentinel) {
        void requestLock()
      }
    }

    void requestLock()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void sentinel?.release()
    }
  }, [])

  return null
}
