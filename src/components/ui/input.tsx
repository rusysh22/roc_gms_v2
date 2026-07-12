import * as React from 'react'

import { cn } from '@/lib/utils'

// Input radius per prd/redesign/README.md section 4.1 (10px, distinct from card/panel radius).
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-11 w-full rounded-[10px] border border-line bg-paper px-3 font-sans text-sm font-semibold text-ink transition-colors placeholder:font-normal placeholder:text-ink-soft focus-visible:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/20 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }
