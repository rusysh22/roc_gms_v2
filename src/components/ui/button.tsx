import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// Pill button per prd/redesign/README.md section 4.1 - rounded-full is the signature shape.
//
// AUDIT_UI_UX_CSS CSS-03: without Preflight, a real <button> keeps the browser/OS's native
// `appearance: auto` chrome (Windows renders a visible 2px outset border on top of whatever
// background/border-radius utilities set) unless appearance is explicitly reset - confirmed at
// runtime on the login submit button. `<a asChild>` never had this problem (anchors don't get
// button chrome), which is exactly why the same variant looked different as a button vs a link.
// `appearance-none` + `bg-transparent` (each variant then sets its own real background) + explicit
// `border-*` per variant (never left to the UA default) makes both render identically.
const buttonVariants = cva(
  'inline-flex appearance-none items-center justify-center gap-2 whitespace-nowrap rounded-full bg-transparent font-sans font-semibold no-underline transition-all duration-200 hover:duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transform-none cursor-pointer disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'border-0 bg-green text-paper hover:bg-green/90',
        secondary: 'border border-line bg-paper text-ink hover:border-green hover:text-green',
        ghost: 'border-0 text-ink hover:bg-mist',
      },
      size: {
        default: 'h-11 px-6 text-[0.95rem]',
        sm: 'h-9 px-4 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

// AUDIT_UI_UX_CSS FORM-08: of 110 Button usages, only 51 set `type` explicitly. A plain <button>
// with no `type` defaults to `type="submit"` per the HTML spec, so any Button meant as a
// cancel/remove/toggle/step action - not the form's actual submit trigger - silently submits the
// enclosing form when clicked. Defaulting to `type="button"` here makes that the safe baseline;
// the few Buttons that ARE a form's real submit trigger now opt in explicitly (see SubmitButton
// in submit-button.tsx, which also covers FORM-07's pending-state requirement).
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={asChild ? undefined : type}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
