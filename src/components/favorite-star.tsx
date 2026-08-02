'use client'

import * as React from 'react'
import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'
import { FAVORITES_CHANGED_EVENT, getFavorites, toggleFavorite } from '@/lib/favorites'

export function FavoriteStar({
  eventSlug,
  entryId,
  label,
}: {
  eventSlug: string
  entryId: string
  label: string
}) {
  const [favorited, setFavorited] = React.useState(false)

  React.useEffect(() => {
    setFavorited(getFavorites(eventSlug).has(entryId))
    const handleChange = () => setFavorited(getFavorites(eventSlug).has(entryId))
    window.addEventListener(FAVORITES_CHANGED_EVENT, handleChange)
    window.addEventListener('storage', handleChange)
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [eventSlug, entryId])

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setFavorited(toggleFavorite(eventSlug, entryId).has(entryId))
      }}
      aria-pressed={favorited}
      aria-label={favorited ? `Remove ${label} from My Schedule` : `Add ${label} to My Schedule`}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-mist hover:text-gold"
    >
      <Star
        className={cn('h-4 w-4', favorited && 'fill-gold text-gold')}
        aria-hidden="true"
      />
    </button>
  )
}
