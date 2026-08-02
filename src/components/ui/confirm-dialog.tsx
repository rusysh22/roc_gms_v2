'use client'

import * as React from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog'
import { Button, type ButtonProps } from './button'

// AUDIT_UI_UX_CSS ADM-13: the one shared "are you sure" surface for anything that destroys or
// can't be trivially undone - every call site supplies the specific object/count being affected
// in `description` rather than a generic "Are you sure?" (the audit's "copy konsekuensi, dan
// objek yang disebutkan" requirement), so the risk is legible without opening the row itself.
export function ConfirmDialog({
  trigger,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'destructive',
  onConfirm,
  confirmButtonProps,
}: {
  trigger: React.ReactNode
  title?: React.ReactNode
  description: React.ReactNode
  confirmLabel?: React.ReactNode
  cancelLabel?: React.ReactNode
  tone?: 'destructive' | 'default'
  onConfirm?: () => void
  confirmButtonProps?: ButtonProps
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <div className="mt-2 flex justify-end gap-3">
          <AlertDialogCancel asChild>
            <Button type="button" variant="secondary">
              {cancelLabel}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant={tone === 'destructive' ? 'destructive' : 'primary'}
              {...confirmButtonProps}
              onClick={(event) => {
                onConfirm?.()
                confirmButtonProps?.onClick?.(event)
                // AUDIT_UI_UX_CSS: a plain type="submit" form={id} button here races against
                // Radix's own close-on-click - closing (unmounting) the dialog can happen before
                // the browser's default submit action for the click fires, silently dropping the
                // submission. Requesting it explicitly, synchronously, in this handler - and
                // suppressing the native default action so it can't double-fire - submits before
                // any unmount is committed, regardless of that race.
                const formId = confirmButtonProps?.form
                if (typeof formId === 'string') {
                  event.preventDefault()
                  const form = document.getElementById(formId)
                  if (form instanceof HTMLFormElement) {
                    form.requestSubmit()
                  }
                }
              }}
            >
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
