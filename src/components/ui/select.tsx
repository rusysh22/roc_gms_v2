import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

// Styled native <select> - workspace forms are plain <form action={serverAction}> server actions,
// so a Radix Select (which needs client-side state + a hidden input to participate in FormData)
// would add complexity with no behavioral benefit here.
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, children, ...props }, ref) => (
    <div className={cn('relative', wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          'h-11 w-full appearance-none rounded-[10px] border border-line bg-paper px-3 pr-9 font-sans text-sm font-semibold text-ink transition-colors focus-visible:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/20 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
        aria-hidden="true"
      />
    </div>
  ),
)
Select.displayName = 'Select'

export { Select }
