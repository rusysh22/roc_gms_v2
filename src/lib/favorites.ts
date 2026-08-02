'use client'

// AUDIT_UI_UX_CSS PUB-07/P2 item 1: "My Team/My Schedule" without forcing an account - favorites
// live in localStorage, scoped per event (a participant/spectator following one event shouldn't
// see stale picks from a different one they attended earlier). Deliberately not synced anywhere -
// this is a client-only convenience, not an account feature.
const storageKey = (eventSlug: string) => `intourney:favorites:${eventSlug}`
export const FAVORITES_CHANGED_EVENT = 'intourney:favorites-changed'

export function getFavorites(eventSlug: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(storageKey(eventSlug))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function toggleFavorite(eventSlug: string, entryId: string): Set<string> {
  const current = getFavorites(eventSlug)
  if (current.has(entryId)) {
    current.delete(entryId)
  } else {
    current.add(entryId)
  }
  try {
    window.localStorage.setItem(storageKey(eventSlug), JSON.stringify(Array.from(current)))
  } catch {
    // Storage can be unavailable (private browsing, quota) - the toggle just won't persist.
  }
  window.dispatchEvent(new CustomEvent(FAVORITES_CHANGED_EVENT, { detail: { eventSlug } }))
  return current
}
