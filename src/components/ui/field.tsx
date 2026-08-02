import * as React from 'react'

import { cn } from '@/lib/utils'
import { Label } from './label'

// Small composition helper so every form field across the workspace shares the same
// label+control spacing instead of each page re-typing the wrapper markup.
//
// AUDIT_UI_UX_CSS FORM-02/FORM-03: static audit found 177 `Field` usages but only 2 passing
// `htmlFor`, and 94 `Input` usages but only 2 with an `id` - clicking a label almost never focused
// its control, and screen readers had no accessible name for most fields. Rather than touching
// every one of those call sites, Field now auto-generates an id (React.useId()) and clones it onto
// its first child control if that child doesn't already declare its own `id` - the label-control
// association becomes automatic for the common "Field wraps one control" shape, and an explicit
// `htmlFor` (or a control that already sets its own `id`, e.g. FileUpload) is still respected
// as an opt-out/override.
export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  htmlFor?: string
  /** Helper copy shown under the label, before the control (FORM-04). */
  description?: React.ReactNode
  /** Field-level validation message shown under the control (FORM-04/05/06). Presence alone
   *  marks the control `aria-invalid`, independent of whether server or client validated it. */
  error?: React.ReactNode
  /** Shows a visible "(optional)" marker next to the label - most fields in this app are
   *  required by default, so this opts a field OUT rather than the more common opt-in. */
  optional?: boolean
}

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, label, htmlFor, description, error, optional, children, ...props }, ref) => {
    const generatedId = React.useId()
    const [firstChild, ...restChildren] = React.Children.toArray(children)

    let controlId = htmlFor
    let patchedFirstChild = firstChild

    const descriptionId = description ? `${generatedId}-description` : undefined
    const errorId = error ? `${generatedId}-error` : undefined
    const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined

    if (!htmlFor && React.isValidElement(firstChild)) {
      const childProps = firstChild.props as { id?: string; 'aria-describedby'?: string }
      const existingId = childProps.id
      controlId = existingId || generatedId
      patchedFirstChild = React.cloneElement(
        firstChild as React.ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>,
        {
          id: controlId,
          'aria-describedby': [childProps['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
          ...(error ? { 'aria-invalid': true } : {}),
        },
      )
    } else if (!htmlFor) {
      controlId = generatedId
    }

    return (
      <div ref={ref} className={cn('flex flex-col', className)} {...props}>
        <Label htmlFor={controlId}>
          {label}
          {optional ? <span className="ml-1 font-normal text-ink-soft">(optional)</span> : null}
        </Label>
        {description ? (
          <p id={descriptionId} className="mt-0.5 text-xs text-ink-soft">
            {description}
          </p>
        ) : null}
        {patchedFirstChild}
        {restChildren}
        {error ? (
          <p id={errorId} role="alert" className="mt-1 text-xs font-semibold text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    )
  },
)
Field.displayName = 'Field'

export { Field }
