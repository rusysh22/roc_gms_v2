import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Trophy } from 'lucide-react'

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
    <main className="flex min-h-[calc(100svh-6rem)] flex-col font-sans lg:flex-row">
      {/* Desktop brand panel: real feature previews (see LoginShowcase), auto-rotating. Collapses
          entirely below lg - a rotating carousel has no room to breathe on a phone screen, so
          mobile gets the compact static header below instead. */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#0a2540] via-[#003399] to-[#0055FF] px-10 py-12 lg:flex lg:w-[44%] lg:shrink-0 lg:px-14 lg:py-16 xl:w-[42%]">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/20" />
        <div className="relative w-full">
          <LoginShowcase />
        </div>
      </div>

      {/* Mobile brand header: same wordmark/tagline as the desktop panel's top row, without the
          carousel - keeps the two breakpoints visually related instead of feeling like two
          different pages. */}
      <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-[#0a2540] to-[#0055FF] px-6 py-10 text-center lg:hidden">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-paper">
          <Trophy className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="text-lg font-extrabold text-paper">InTourney</p>
        <p className="text-xs font-semibold text-paper/70">Hosting your Tournament&apos;s</p>
      </div>

      <div className="flex flex-1 flex-col justify-center bg-[#f8f9fc] px-6 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto flex w-full max-w-md flex-col items-center">
          <div className="flex w-full justify-between items-center mb-10">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft no-underline transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Kembali ke beranda
            </Link>
            <div className="flex items-center gap-2">
              <button type="button" className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink shadow-sm border border-line">ID &or;</button>
              <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm border border-line text-ink-soft hover:text-ink transition-colors">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mb-8 flex w-full justify-center">
            <div className="flex w-full max-w-[240px] items-center rounded-xl bg-[#eef2f9] p-1 shadow-inner">
              <button type="button" className="flex-1 rounded-lg bg-blue py-1.5 text-xs font-bold text-white shadow">Masuk</button>
              <button type="button" className="flex-1 rounded-lg py-1.5 text-xs font-bold text-ink-soft hover:text-ink">Daftar</button>
            </div>
          </div>

          <div className="w-full text-left">
            <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Masuk ke akun 👋</h1>
            <p className="mt-1 text-sm font-medium text-ink-soft/80">
              Masukkan email dan password usahamu
            </p>
          </div>

          <div className="mt-8 w-full">
            <LoginForm redirectTo={redirectTo} />
          </div>
          
          <div className="mt-16 flex w-full justify-between text-[10px] font-medium text-ink-soft/60">
            <span>Privacy Policy</span>
            <span>&copy; 2026 InTourney</span>
          </div>

          <p className="mt-6 text-center text-xs text-ink-soft lg:hidden">
            <Link href="/" className="font-semibold text-ink-soft underline-offset-2 hover:text-blue hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
