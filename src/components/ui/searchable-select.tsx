'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  value: string
  label: string
  description?: string
}

// A hidden <input name=...> (so it still participates in plain FormData/GET-query server-action
// forms, same as every other field in this app) paired with a filterable text trigger, for selects
// whose option list can realistically grow past what's comfortable to scan in a native <select>
// (clubs, categories, teams...). Kept as its own opt-in component rather than replacing <Select>
// everywhere - most dropdowns in the app stay well under a dozen options and the plain native
// select (src/components/ui/select.tsx) is simpler and just as usable there.
export function SearchableSelect({
  name,
  options,
  defaultValue = '',
  placeholder = 'Select...',
  emptyMessage = 'No matches.',
  className,
}: {
  name: string
  options: SearchableSelectOption[]
  defaultValue?: string
  placeholder?: string
  emptyMessage?: string
  className?: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [value, setValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const selected = options.find((option) => option.value === value)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = query.trim()
    ? options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* No `required` here - browsers silently block submission of a hidden required field with
          no visible cue why, so missing-value validation is left to the server action's existing
          friendly error banner instead. */}
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-[10px] border border-line bg-paper px-3 text-left font-sans text-sm font-semibold text-ink transition-colors focus-visible:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/20"
      >
        <span className={cn('truncate', !selected && 'font-normal text-ink-soft')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[10px] border border-line bg-paper shadow-md">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            className="w-full border-b border-line px-3 py-2 font-sans text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-soft"
          />
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs font-semibold text-ink-soft">{emptyMessage}</li>
            ) : (
              filtered.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      setValue(option.value)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-mist',
                      option.value === value && 'bg-mist',
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.description ? (
                      <span className="truncate text-xs font-normal text-ink-soft">{option.description}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
