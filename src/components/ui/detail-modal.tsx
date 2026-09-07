'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Dialog, DialogContent } from './dialog'

// Read-only counterpart to CrudFormModal: the row-level "View" link navigates to `?view=<id>`,
// the page passes `openDefault` here, and this renders the record as a definition list. Closing it
// (X, overlay, Escape) drops the query param back to `closeHref`.
export function DetailModal({
  title,
  openDefault = false,
  closeHref,
  items,
}: {
  title: string
  openDefault?: boolean
  closeHref: string
  items: { label: React.ReactNode; value: React.ReactNode }[]
}) {
  const [open, setOpen] = React.useState(openDefault)
  const router = useRouter()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next && openDefault) router.push(closeHref)
      }}
    >
      <DialogContent title={title}>
        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,10rem)_1fr]">
          {items.map((item, index) => (
            <React.Fragment key={index}>
              <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft sm:pt-0.5">
                {item.label}
              </dt>
              <dd className="text-sm font-semibold text-ink">{item.value || '—'}</dd>
            </React.Fragment>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
