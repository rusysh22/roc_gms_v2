'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { LoginPanel } from '@/components/auth/login-panel'
import { BrandLogo } from '@/components/brand-logo'

// The /login route rendered as the same modal pop-up used in the public nav - never a standalone
// form page. It exists as a route only because protected pages HTTP-redirect here (with
// ?redirect=) and SSO failures land here (with ?error=); dismissing it goes home.
export function LoginRouteModal({
  redirectTo,
  ssoError,
  googleSsoEnabled,
}: {
  redirectTo: string
  ssoError?: string | null
  googleSsoEnabled: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(true)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) router.push('/')
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-mist px-4 font-sans">
      {/* Soft brand backdrop so the page behind the pop-up isn't just an empty rectangle. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
        <BrandLogo variant="icon" height={520} />
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          title="Sign in to InTourney"
          description="Use Google or your email and password."
          className="max-w-md"
        >
          <LoginPanel
            redirectTo={redirectTo}
            ssoError={ssoError}
            googleSsoEnabled={googleSsoEnabled}
            hideHeader
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
