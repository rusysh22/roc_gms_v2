'use client'

import * as React from 'react'
import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'
import { FAVORITES_CHANGED_EVENT, getFavorites } from '@/lib/favorites'

// AUDIT_UI_UX_CSS PUB-07: "My Schedule" without an account - this filters the already
// server-rendered match list client-side by toggling `hidden` on cards whose
// `data-match-entries` (set by the schedule page) doesn't intersect the favorited set, rather
// than re-fetching/re-rendering. Everything still works with zero JS (every match is server-
// rendered and visible by default); this is a pure progressive enhancement on top.
export function ScheduleFavoritesToggle({ eventSlug, containerId }: { eventSlug: string; containerId: string }) {
  const [onlyMine, setOnlyMine] = React.useState(false)
  const [hasFavorites, setHasFavorites] = React.useState(false)

  const applyFilter = React.useCallback(
    (showOnlyMine: boolean) => {
      const favorites = getFavorites(eventSlug)
      setHasFavorites(favorites.size > 0)
      const container = document.getElementById(containerId)
      if (!container) return
      container.querySelectorAll<HTMLElement>('[data-match-entries]').forEach((el) => {
        const entries = (el.dataset.matchEntries || '').split(',').filter(Boolean)
        const isMine = entries.some((id) => favorites.has(id))
        el.hidden = showOnlyMine && !isMine
      })
    },
    [eventSlug, containerId],
  )

  React.useEffect(() => {
    applyFilter(onlyMine)
    const handleChange = () => applyFilter(onlyMine)
    window.addEventListener(FAVORITES_CHANGED_EVENT, handleChange)
    window.addEventListener('storage', handleChange)
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [applyFilter, onlyMine])

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft">
      <button
        type="button"
        onClick={() => setOnlyMine((prev) => !prev)}
        aria-pressed={onlyMine}
        disabled={!hasFavorites}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          onlyMine ? 'border-gold bg-gold/10 text-ink' : 'border-line bg-paper hover:text-ink',
        )}
      >
        <Star className={cn('h-3.5 w-3.5', onlyMine && 'fill-gold text-gold')} aria-hidden="true" />
        {onlyMine ? 'Showing my matches' : 'Show only my matches'}
      </button>
      {!hasFavorites ? <span>Tap the star next to a team to build your schedule.</span> : null}
    </div>
  )
}
