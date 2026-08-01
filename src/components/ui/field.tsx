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
}

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, label, htmlFor, children, ...props }, ref) => {
    const generatedId = React.useId()
    const [firstChild, ...restChildren] = React.Children.toArray(children)

    let controlId = htmlFor
    let patchedFirstChild = firstChild

    if (!htmlFor && React.isValidElement(firstChild)) {
      const existingId = (firstChild.props as { id?: string }).id
      controlId = existingId || generatedId
      if (!existingId) {
        patchedFirstChild = React.cloneElement(firstChild as React.ReactElement<{ id?: string }>, {
          id: controlId,
        })
      }
    } else if (!htmlFor) {
      controlId = generatedId
    }

    return (
      <div ref={ref} className={cn('flex flex-col', className)} {...props}>
        <Label htmlFor={controlId}>{label}</Label>
        {patchedFirstChild}
        {restChildren}
      </div>
    )
  },
)
Field.displayName = 'Field'

export { Field }
