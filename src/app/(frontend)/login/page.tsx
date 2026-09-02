import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { LoginRouteModal } from '@/components/auth/login-route-modal'
import { isGoogleSsoEnabled } from '@/lib/auth/googleSso'
import { getCurrentPublicUser } from '../getCurrentPublicUser'

// Root layout's title template already appends " | InTourney" - a plain 'Sign in' here avoids
// doubling up into "Sign in | InTourney | InTourney".
export const metadata: Metadata = {
  title: 'Sign in',
}

// Only ever redirect within the app - an unvalidated `redirect` query param would otherwise be an
// open-redirect vector for phishing links that look like "intourney.com/login?redirect=...".
const sanitizeRedirect = (value: string | undefined) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/workspaces'
  }
  return value
}

// There's no standalone login *page* - the nav opens a modal. This route exists only as a
// redirect/deep-link target (protected pages send here with ?redirect=, SSO failures with
// ?error=), and it renders that same modal over a branded backdrop.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>
}) {
  const { redirect: redirectParam, error } = await searchParams
  const redirectTo = sanitizeRedirect(redirectParam)

  const user = await getCurrentPublicUser()
  if (user) {
    redirect(redirectTo)
  }

  return (
    <LoginRouteModal
      redirectTo={redirectTo}
      ssoError={error ?? null}
      googleSsoEnabled={isGoogleSsoEnabled()}
    />
  )
}
