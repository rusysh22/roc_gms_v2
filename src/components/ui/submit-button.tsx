'use client'

import * as React from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

import { Button, type ButtonProps } from './button'

export interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  pendingLabel?: React.ReactNode
}

// AUDIT_UI_UX_CSS FORM-07: none of the app's ~55 server-action forms had any pending-state pattern,
// so a slow submit gave no feedback and nothing stopped a double-click from firing the action
// twice. Must be rendered *inside* the <form> it submits - useFormStatus only reports the nearest
// ancestor form's pending state, not a form elsewhere on the page. Pairs with FORM-08: this is the
// one Button variant that keeps `type="submit"`, since Button itself now defaults to "button".
const SubmitButton = React.forwardRef<HTMLButtonElement, SubmitButtonProps>(
  ({ children, pendingLabel, disabled, ...props }, ref) => {
    const { pending } = useFormStatus()
    return (
      <Button ref={ref} type="submit" disabled={disabled || pending} {...props}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {pendingLabel ?? children}
          </>
        ) : (
          children
        )}
      </Button>
    )
  },
)
SubmitButton.displayName = 'SubmitButton'

export { SubmitButton }
