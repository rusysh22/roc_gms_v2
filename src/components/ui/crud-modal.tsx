'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Dialog, DialogContent, DialogTrigger } from './dialog'

// Standard "table + modal form" CRUD pattern used across the Event Admin workspace pages: the
// row-level "Edit" link navigates to `?edit=<id>` (plain server navigation, no client state needed
// for that part) which passes `openDefault` here so this same modal instance reopens pre-filled.
// Closing it (X, overlay click, Escape) calls `closeHref` to drop the query param back to the base
// list URL instead of leaving stale edit state in the address bar.
export function CrudFormModal({
  trigger,
  title,
  openDefault = false,
  closeHref,
  children,
}: {
  trigger: React.ReactNode
  title: string
  openDefault?: boolean
  closeHref: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(openDefault)
  const router = useRouter()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next && openDefault) {
          router.push(closeHref)
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title}>{children}</DialogContent>
    </Dialog>
  )
}
