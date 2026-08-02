import * as React from 'react'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'

import { cn } from '@/lib/utils'

// AUDIT_UI_UX_CSS CSS-11: error now uses the shared --color-danger/--color-danger-surface tokens
// (see tailwind.css) instead of hard-coded red-50/200/700 - prd/redesign/README.md deliberately
// never maps "loss"/error to red for match *results*, but plain validation/error banners are a
// different, genuinely error-semantic surface and still need a real token, not a magic value.
// "info" reuses the blue token, which the design system already reserves for
// secondary/informational meaning (see prd/redesign/README.md section 4). "warning" reuses gold,
// matching StatusBadge's existing gold-for-attention-needed convention (e.g. category readiness's
// "Needs entries"/"Needs matches" badges) - for a heads-up that isn't blocking/an error but also
// isn't neutral "info" (e.g. NOVICE_ADMIN_FLOW_UX_REDESIGN item 6's "no court configured yet").
export type AlertTone = 'success' | 'error' | 'info' | 'warning'

const toneClasses: Record<AlertTone, string> = {
  success: 'border-green/30 bg-mist text-green',
  error: 'border-danger/30 bg-danger-surface text-danger',
  info: 'border-blue/30 bg-mist text-blue',
  warning: 'border-gold/30 bg-mist text-gold',
}

const toneIcon: Record<AlertTone, React.ElementType> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
  warning: AlertTriangle,
}

export interface AlertBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone
}

// AUDIT_UI_UX_CSS FORM-20: async messages (import errors, save confirmations) had no implicit
// role, so screen readers had no guarantee of hearing them when they appeared without a focus
// change. "error" is assertive (interrupts, for validation/failure); success/info/warning are
// polite "status" (announced without stealing focus). Callers needing something else (e.g. a
// tone="error" banner that's actually just neutral instructional copy) can still pass `role`
// explicitly to override.
const toneRole: Record<AlertTone, 'alert' | 'status'> = {
  success: 'status',
  error: 'alert',
  info: 'status',
  warning: 'status',
}

const AlertBanner = React.forwardRef<HTMLDivElement, AlertBannerProps>(
  ({ className, tone = 'success', role, children, ...props }, ref) => {
    const Icon = toneIcon[tone]

    return (
      <div
        ref={ref}
        role={role ?? toneRole[tone]}
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
