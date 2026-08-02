import * as React from 'react'

import { cn } from '@/lib/utils'

// AUDIT_UI_UX_CSS UI-01: horizontal scroll was the only responsive strategy and had zero visual
// indication a table had hidden columns - a mobile user had to discover it by accidentally
// swiping. `.table-scroll-shadow` (tailwind.css) is the classic CSS-only scroll-shadow technique:
// two background-attachment:local gradients that scroll WITH the content (so they self-cancel
// against the paper background once you've reached that edge) layered under two
// background-attachment:scroll shadows pinned to the viewport - the shadow only actually renders
// where there's more content to reveal, with no JS/ResizeObserver needed. Doesn't replace an
// actual column-priority strategy (UI-02), which is a per-table content decision this shared
// wrapper can't make for every caller.
// AUDIT_UI_UX_CSS A11Y-06: `caption` is optional (many tables already have an adjacent CardTitle
// naming them, which would make a caption redundant) - screen-reader-only by default since a
// visible caption isn't this app's established table style, but still gives assistive tech an
// accessible name for the table when nothing else provides one.
const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement> & { caption?: React.ReactNode }
>(({ className, caption, children, ...props }, ref) => (
  <div className="table-scroll-shadow w-full overflow-x-auto rounded-card border border-line">
    <table ref={ref} className={cn('w-full border-collapse font-sans text-sm', className)} {...props}>
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      {children}
    </table>
  </div>
))
Table.displayName = 'Table'

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('bg-mist text-left text-xs font-bold tracking-wide text-ink-soft uppercase', className)}
    {...props}
  />
))
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('divide-y divide-line', className)} {...props} />
))
TableBody.displayName = 'TableBody'

// AUDIT_UI_UX_CSS UI-03: hover was the only interactive row state - keyboard focus landing inside
// a row (e.g. tabbing to an action button) had no row-level indication, and there was no shared
// way to mark a row selected for bulk actions. `selected` is opt-in (most tables here have no bulk
// selection yet); focus-within always applies since any row with a focusable control benefits.
const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }
>(({ className, selected, ...props }, ref) => (
  <tr
    ref={ref}
    data-state={selected ? 'selected' : undefined}
    className={cn(
      'transition-colors hover:bg-mist/60 focus-within:bg-mist/60 data-[state=selected]:bg-mist',
      className,
    )}
    {...props}
  />
))
TableRow.displayName = 'TableRow'

// AUDIT_UI_UX_CSS A11Y-06: every TableHead in this app is a column header (no row-header usage),
// so `scope="col"` as the default - rather than something each call site has to remember - closes
// that gap everywhere at once. Still overridable via props for the rare exception.
const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, scope = 'col', ...props }, ref) => (
  <th ref={ref} scope={scope} className={cn('px-3 py-2.5 font-bold whitespace-nowrap', className)} {...props} />
))
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-3 py-2.5 align-middle text-ink', className)} {...props} />
))
TableCell.displayName = 'TableCell'

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
