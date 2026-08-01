import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Trophy } from 'lucide-react'

import { getCurrentPublicUser } from '../getCurrentPublicUser'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: 'Sign in | InTourney',
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
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect: redirectParam } = await searchParams
  const redirectTo = sanitizeRedirect(redirectParam)

  const user = await getCurrentPublicUser()
  if (user) {
    redirect(redirectTo)
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-mist px-4 py-12 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green text-paper">
            <Trophy className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-lg font-extrabold text-ink">InTourney</p>
          <p className="text-xs font-semibold text-ink-soft">Hosting your Tournament&apos;s</p>
        </div>

        <div className="rounded-panel border border-line bg-paper p-8">
          <h1 className="text-xl font-extrabold text-ink">Sign in to your workspace</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Manage your tournaments, schedules, and content from the InTourney admin.
          </p>

          <div className="mt-6">
            <LoginForm redirectTo={redirectTo} />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-ink-soft">
          <Link href="/" className="font-semibold text-ink-soft underline-offset-2 hover:text-green hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}
