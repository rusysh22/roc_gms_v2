'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { LoginPanel } from '@/components/auth/login-panel'

// Public-nav "Log in" affordance: opens the login form in a modal instead of routing to /login.
// /login still exists as the canonical page (protected routes redirect there with ?redirect=).
export function LoginDialog({
  className,
  googleSsoEnabled,
}: {
  className?: string
  googleSsoEnabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()

  // Land the user back where they were if that's a workspace-ish place, otherwise the workspaces
  // home - matches the /login page's default.
  const redirectTo = pathname?.startsWith('/workspaces') ? pathname : '/workspaces'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            className ??
            'rounded-full bg-green px-3 py-1.5 text-xs font-bold whitespace-nowrap text-paper no-underline transition-colors hover:bg-ink'
          }
        >
          Log in
        </button>
      </DialogTrigger>
      <DialogContent
        title="Sign in to InTourney"
        description="Use Google or your email and password."
        className="max-w-md"
      >
        <LoginPanel
          redirectTo={redirectTo}
          hideHeader
          googleSsoEnabled={googleSsoEnabled}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
