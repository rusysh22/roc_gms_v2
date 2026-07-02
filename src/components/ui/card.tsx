import * as React from 'react'

import { cn } from '@/lib/utils'

// Card recipe per prd/redesign/README.md section 4.1: 12px radius, 1px --line border, no shadow
// in flow. `interactive` cards (match ticket, bracket node, sport card, standings card) lift 2px
// and shift their border to an accent color on hover/focus - green for interactive-primary
// contexts, blue for navigational ones. Shadow stays reserved for floating elements only.
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  accent?: 'green' | 'blue'
}

const accentHoverClasses: Record<NonNullable<CardProps['accent']>, string> = {
  green: 'hover:border-green focus-visible:border-green',
  blue: 'hover:border-blue focus-visible:border-blue',
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, accent = 'green', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-card border border-line bg-paper p-4 font-sans text-ink transition-all duration-150',
        interactive &&
          cn(
            'cursor-pointer hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none',
            accentHoverClasses[accent],
          ),
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('font-sans text-base font-bold text-ink', className)} {...props} />
  ),
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('font-sans text-sm text-ink-soft', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('pt-3', className)} {...props} />,
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center pt-3', className)} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
