'use client'

import type { ChangeEvent } from 'react'

export interface ListSearchFilterProps {
  /** Filters rows inside the element with this id - each row must carry a `data-search` attribute. */
  listId: string
  placeholder?: string
  className?: string
}

// Client-side only, no round trip - unlike RegistrationStep's single-category search (a GET form,
// since its result also has to stay in sync with what gets bulk-added), this filter narrows an
// already-fetched checklist that's rendered once per category on the page. A server round trip per
// keystroke across several categories at once would be the wrong trade here.
export const ListSearchFilter = ({ listId, placeholder, className }: ListSearchFilterProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const query = event.currentTarget.value.trim().toLowerCase()
    const list = document.getElementById(listId)
    if (!list) return
    const rows = list.querySelectorAll<HTMLElement>('[data-search]')
    rows.forEach((row) => {
      const matches = !query || (row.dataset.search || '').includes(query)
      row.classList.toggle('hidden', !matches)
    })
  }

  return (
    <input
      type="search"
      onChange={handleChange}
      placeholder={placeholder || 'Search...'}
      aria-controls={listId}
      className={className}
    />
  )
}
