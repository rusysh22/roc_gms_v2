import type { ReactNode } from 'react'

import { Button } from './button'
import { Input } from './input'

// AUDIT_UI_UX_CSS ADM-08: every admin list page that had search re-typed the same "Input + Search
// button, GET form" markup slightly differently. This standardizes the shape without forcing a
// bigger rewrite - it's still a plain GET form (works with the server-rendered list pages as-is,
// no client JS required), just consistently laid out. `filters`/`actions` are free-form slots so a
// page can add a status <Select> or an "Add X" button without this component needing to know about
// every possible filter shape.
export function DataTableToolbar({
  action,
  searchName = 'q',
  searchDefaultValue = '',
  searchPlaceholder = 'Search...',
  searchLabel = 'Search',
  hiddenFields,
  filters,
  actions,
}: {
  action: string
  searchName?: string
  searchDefaultValue?: string
  searchPlaceholder?: string
  searchLabel?: string
  hiddenFields?: ReactNode
  filters?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <form className="flex min-w-0 flex-1 flex-wrap gap-2 sm:max-w-md" action={action}>
        {hiddenFields}
        <Input
          name={searchName}
          defaultValue={searchDefaultValue}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          className="min-w-0 flex-1"
        />
        {filters}
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
