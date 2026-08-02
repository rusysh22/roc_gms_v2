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
              onClick={onConfirm}
              {...confirmButtonProps}
            >
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
