import * as React from 'react'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'

import { cn } from '@/lib/utils'

// There's no custom "danger" token in the design system (prd/redesign/README.md deliberately
// never maps "loss"/error to red for match results) - but plain validation/error banners still
// need one, so this follows the exact stock red-50/200/700 already used by the Live Score page's
// own error banner (the one place in the app that needed it before this component existed).
// "info" reuses the blue token, which the design system already reserves for
// secondary/informational meaning (see prd/redesign/README.md section 4).
export type AlertTone = 'success' | 'error' | 'info'

const toneClasses: Record<AlertTone, string> = {
  success: 'border-green/30 bg-mist text-green',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue/30 bg-mist text-blue',
}

const toneIcon: Record<AlertTone, React.ElementType> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
}

export interface AlertBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone
}

const AlertBanner = React.forwardRef<HTMLDivElement, AlertBannerProps>(
  ({ className, tone = 'success', children, ...props }, ref) => {
    const Icon = toneIcon[tone]

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start gap-2 rounded-card border px-4 py-3 font-sans text-sm font-bold',
          toneClasses[tone],
          className,
        )}
        {...props}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {/* A plain div (not <span>) so multi-line content - e.g. a <details> disclosure of
            per-row import issues - can nest block elements without invalid-HTML inline nesting. */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    )
  },
)
AlertBanner.displayName = 'AlertBanner'

export { AlertBanner }
