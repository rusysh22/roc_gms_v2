import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { BrandLogo } from '@/components/brand-logo'
import { getCurrentPublicUser } from '../getCurrentPublicUser'
import { LoginForm } from './LoginForm'
import { LoginShowcase } from './LoginShowcase'

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
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect: redirectParam } = await searchParams
  const redirectTo = sanitizeRedirect(redirectParam)

  const user = await getCurrentPublicUser()
  if (user) {
    redirect(redirectTo)
  }

  return (
    <main className="flex min-h-svh flex-col font-sans lg:flex-row">
      {/* Desktop brand panel: real feature previews (see LoginShowcase), auto-rotating. Collapses
          entirely below lg - a rotating carousel has no room to breathe on a phone screen, so
          mobile gets the compact static header below instead. */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#062e22] via-green to-blue px-10 py-12 lg:flex lg:w-[44%] lg:shrink-0 lg:px-14 lg:py-16 xl:w-[42%]">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/20" />
        <div className="relative w-full">
          <LoginShowcase />
        </div>
      </div>

      {/* Mobile brand header: same wordmark/tagline as the desktop panel's top row, without the
          carousel - keeps the two breakpoints visually related instead of feeling like two
          different pages. */}
      <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-green to-blue px-6 py-10 text-center lg:hidden">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white">
          <BrandLogo variant="icon" height={28} />
        </span>
        <p className="text-lg font-extrabold text-paper">InTourney</p>
        <p className="text-xs font-semibold text-paper/70">Manage your tournaments, all in one place</p>
      </div>

      <div className="flex flex-1 flex-col justify-center bg-mist px-6 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto flex w-full max-w-md flex-col items-center">
          <div className="mb-10 w-full">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft no-underline transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to home
            </Link>
          </div>

          <div className="w-full text-left">
            <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Welcome back 👋</h1>
            <p className="mt-1 text-sm font-medium text-ink-soft/80">
              Enter your email and password to sign in
            </p>
          </div>

          <div className="mt-8 w-full">
            <LoginForm redirectTo={redirectTo} />
          </div>

          <p className="mt-16 text-center text-[10px] font-medium text-ink-soft/60">
            &copy; 2026 InTourney
          </p>
        </div>
      </div>
    </main>
  )
}
