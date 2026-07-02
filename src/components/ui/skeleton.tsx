import * as React from 'react'

import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-card bg-mist motion-reduce:animate-none', className)}
      {...props}
    />
  )
}

export { Skeleton }
