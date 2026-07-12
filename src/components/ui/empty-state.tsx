import * as React from 'react'
import { Inbox } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ElementType
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon: Icon = Inbox, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center gap-2 rounded-card border border-dashed border-line bg-mist/50 px-4 py-8 text-center font-sans text-sm font-semibold text-ink-soft',
        className,
      )}
      {...props}
    >
      <Icon className="h-6 w-6 text-ink-soft/70" aria-hidden="true" />
      <p>{children}</p>
    </div>
  ),
)
EmptyState.displayName = 'EmptyState'

export { EmptyState }
