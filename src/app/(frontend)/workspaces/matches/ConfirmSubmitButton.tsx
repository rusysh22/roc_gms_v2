'use client'

import type { ReactNode } from 'react'

import { Button, type ButtonProps } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export interface ConfirmSubmitButtonProps extends Omit<ButtonProps, 'type' | 'form'> {
  children: ReactNode
  confirmMessage: string
  /** id of the enclosing <form> this button must submit. The confirm dialog renders in a portal
   *  outside that form's DOM subtree, so the actual submit button reaches it via the standard
   *  HTML `form="..."` attribute rather than needing to live inside the <form> itself. */
  formId: string
  tone?: 'destructive' | 'default'
}

// AUDIT_UI_UX_CSS ADM-13: this used to call the browser's native window.confirm() - unstyled,
// unbrandable, and blocking (freezes the tab, no keyboard-trap/focus-management contract). Now a
// real ConfirmDialog, matching every other destructive confirmation in the app.
export const ConfirmSubmitButton = ({
  children,
  confirmMessage,
  formId,
  tone = 'destructive',
  ...triggerProps
}: ConfirmSubmitButtonProps) => (
  <ConfirmDialog
    trigger={<Button type="button" {...triggerProps}>{children}</Button>}
    description={confirmMessage}
    confirmLabel={children}
    tone={tone}
    confirmButtonProps={{ type: 'submit', form: formId }}
  />
)
