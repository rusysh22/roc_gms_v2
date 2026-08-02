'use client'

import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'

import { cn } from '@/lib/utils'

// AUDIT_UI_UX_CSS UI-04/ADM-13: a "confirm this destructive action" dialog is semantically an
// alertdialog (role="alertdialog", focus trapped, no implicit dismiss-by-clicking-outside unless
// asked for) - not a plain Dialog with different copy. Styled to match DialogContent exactly so
// the two primitives read as one family, not two competing dialog systems.
const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AlertDialogPrimitive.Portal>
    <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40" />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed top-1/2 left-1/2 z-50 flex w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-panel border border-line bg-paper p-6 shadow-md outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </AlertDialogPrimitive.Content>
  </AlertDialogPrimitive.Portal>
))
AlertDialogContent.displayName = 'AlertDialogContent'

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn('text-base font-extrabold text-ink', className)} {...props} />
))
AlertDialogTitle.displayName = 'AlertDialogTitle'

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-ink-soft', className)}
    {...props}
  />
))
AlertDialogDescription.displayName = 'AlertDialogDescription'

const AlertDialogAction = AlertDialogPrimitive.Action
const AlertDialogCancel = AlertDialogPrimitive.Cancel

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
