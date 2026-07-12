import * as React from 'react'

import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-24 w-full rounded-[10px] border border-line bg-paper px-3 py-2 font-sans text-sm font-semibold text-ink transition-colors placeholder:font-normal placeholder:text-ink-soft focus-visible:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/20 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export { Textarea }
