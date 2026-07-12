import * as React from 'react'

import { cn } from '@/lib/utils'
import { Label } from './label'

// Small composition helper so every form field across the workspace shares the same
// label+control spacing instead of each page re-typing the wrapper markup.
export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  htmlFor?: string
}

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, label, htmlFor, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col', className)} {...props}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  ),
)
Field.displayName = 'Field'

export { Field }
