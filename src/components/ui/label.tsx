import * as React from 'react'

import { cn } from '@/lib/utils'

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'mb-1.5 block font-sans text-xs font-bold tracking-wide text-ink-soft uppercase',
        className,
      )}
      {...props}
    />
  ),
)
Label.displayName = 'Label'

export { Label }
