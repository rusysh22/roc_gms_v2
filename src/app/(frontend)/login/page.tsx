import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { LoginPanel } from '@/components/auth/login-panel'
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
    <main className="flex min-h-svh flex-col items-center justify-center bg-mist px-4 py-10 font-sans sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col">
        <Link
          href="/"
          className="mb-6 flex items-center gap-1.5 text-xs font-semibold text-ink-soft no-underline transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to home
        </Link>

        <div className="rounded-panel border border-line bg-paper p-6 shadow-sm sm:p-8">
          <LoginPanel
            redirectTo={redirectTo}
            ssoError={error ?? null}
            googleSsoEnabled={isGoogleSsoEnabled()}
          />
        </div>
      </div>
    </main>
  )
}
