'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger

// AUDIT_UI_UX_CSS A11Y-10: previously hard-suppressed aria-describedby with no way to opt in, so
// every dialog's purpose was conveyed only by its title - fine for a one-line form, not enough
// for anything with real stakes. `description` is optional; when omitted this still explicitly
// clears aria-describedby (matching Radix's own documented way to silence the dev warning for a
// dialog that genuinely doesn't need one) rather than leaving it unset by accident.
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: React.ReactNode }
>(({ className, title, description, children, ...props }, ref) => {
  const descriptionId = React.useId()
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40" />
      <DialogPrimitive.Content
        ref={ref}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-panel border border-line bg-paper p-6 shadow-md outline-none',
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-base font-extrabold text-ink">{title}</DialogPrimitive.Title>
            {description ? (
              <p id={descriptionId} className="mt-0.5 text-sm text-ink-soft">
                {description}
              </p>
            ) : null}
          </div>
          <DialogPrimitive.Close asChild>
            {/* AUDIT_UI_UX_CSS A11Y-11: was 36x36 (h-9 w-9), under the product's 44px touch-target
                standard - only the icon stays visually 18px, the hit area grows around it. */}
            <button
              type="button"
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-mist hover:text-ink"
            >
              <X className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
DialogContent.displayName = 'DialogContent'

export { Dialog, DialogTrigger, DialogContent }
