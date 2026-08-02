'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  value: string
  label: string
  description?: string
}

// AUDIT_UI_UX_CSS FORM-10/11/12: the previous version was a button that opened a second, separate
// search box - neither had any combobox/listbox semantics, so keyboard/screen-reader users had no
// way to know it was a select at all, let alone navigate its options without a mouse. This follows
// the WAI-ARIA "combobox with list autocomplete" pattern: a single text input carries
// role="combobox"/aria-expanded/aria-controls/aria-activedescendant, and the options are a real
// role="listbox" the input's aria-activedescendant points into as arrow keys move focus.
// A hidden <input name=...> still carries the committed value so this keeps working with plain
// FormData/GET-query server-action forms like every other field in this app.
export function SearchableSelect({
  id,
  name,
  options,
  defaultValue = '',
  placeholder = 'Select...',
  emptyMessage = 'No matches.',
  className,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: {
  id?: string
  name: string
  options: SearchableSelectOption[]
  defaultValue?: string
  placeholder?: string
  emptyMessage?: string
  className?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const generatedId = React.useId()
  const inputId = id || generatedId
  const listboxId = `${inputId}-listbox`
  const optionId = (index: number) => `${inputId}-option-${index}`

  const [value, setValue] = React.useState(defaultValue)
  const selected = options.find((option) => option.value === value)

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState(selected?.label ?? '')
  const [activeIndex, setActiveIndex] = React.useState(-1)

  const filtered = query.trim()
    ? options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  const commit = (option: SearchableSelectOption | undefined) => {
    setValue(option?.value ?? '')
    setQuery(option?.label ?? '')
    setOpen(false)
    setActiveIndex(-1)
  }

  const revertToSelection = () => {
    setQuery(selected?.label ?? '')
    setOpen(false)
    setActiveIndex(-1)
  }

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Typed text with no exact match reverts rather than silently keeping stale free text -
        // the hidden input's value (and thus what actually submits) never left `value` anyway.
        const exactMatch = options.find((option) => option.label.toLowerCase() === query.trim().toLowerCase())
        commit(exactMatch ?? selected)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only re-binds on open/query change
  }, [open, query])

  const moveActive = (delta: number) => {
    if (filtered.length === 0) return
    setActiveIndex((prev) => {
      const base = prev < 0 ? (delta > 0 ? -1 : filtered.length) : prev
      const next = (base + delta + filtered.length) % filtered.length
      return next
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) setOpen(true)
        moveActive(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        if (!open) setOpen(true)
        moveActive(-1)
        break
      case 'Home':
        if (open) {
          event.preventDefault()
          setActiveIndex(filtered.length > 0 ? 0 : -1)
        }
        break
      case 'End':
        if (open) {
          event.preventDefault()
          setActiveIndex(filtered.length > 0 ? filtered.length - 1 : -1)
        }
        break
      case 'Enter':
        if (open) {
          event.preventDefault()
          if (activeIndex >= 0 && filtered[activeIndex]) {
            commit(filtered[activeIndex])
          }
        }
        break
      case 'Escape':
        if (open) {
          event.preventDefault()
          revertToSelection()
        }
        break
      case 'Tab':
        // Let focus actually move; blur/click-outside handling reconciles the final value.
        break
      default:
        break
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input type="hidden" name={name} value={value} />
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onKeyDown={handleKeyDown}
          className="flex h-11 w-full items-center rounded-[10px] border border-line bg-paper px-3 pr-9 font-sans text-sm font-semibold text-ink transition-colors placeholder:font-normal placeholder:text-ink-soft focus-visible:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/20"
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
          aria-hidden="true"
        />
      </div>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={placeholder}
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-[10px] border border-line bg-paper py-1 shadow-md"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs font-semibold text-ink-soft">{emptyMessage}</li>
          ) : (
            filtered.map((option, index) => (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(event) => {
                  // mousedown (not click) fires before the input's blur, so commit runs first.
                  event.preventDefault()
                  commit(option)
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'flex cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-mist',
                  (option.value === value || index === activeIndex) && 'bg-mist',
                )}
              >
                <span className="truncate">{option.label}</span>
                {option.description ? (
                  <span className="truncate text-xs font-normal text-ink-soft">{option.description}</span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
