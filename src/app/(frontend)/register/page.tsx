import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { BrandLogo } from '@/components/brand-logo'
import { getCurrentPublicUser } from '../getCurrentPublicUser'
import { RegisterForm } from './RegisterForm'

export const metadata: Metadata = {
  title: 'Create account',
}

// Only ever redirect within the app - an unvalidated `redirect` param is an open-redirect vector
// (mirrors login/page.tsx's sanitizeRedirect).
const sanitizeRedirect = (value: string | undefined) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/workspaces'
  }
  return value
}

export default async function RegisterPage({
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
    <main className="flex min-h-svh flex-col items-center justify-center bg-mist px-6 py-10 font-sans">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <div className="mb-8 w-full">
          <Link
            href={redirectTo === '/workspaces' ? '/login' : `/login?redirect=${encodeURIComponent(redirectTo)}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft no-underline transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to sign in
          </Link>
        </div>

        <div className="w-full text-left">
          <BrandLogo variant="horizontal" height={24} className="mb-5" />
          <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Create your account</h1>
          <p className="mt-1 text-sm font-medium text-ink-soft/80">
            Get started with InTourney - it only takes a minute.
          </p>
        </div>

        <div className="mt-8 w-full">
          <RegisterForm redirectTo={redirectTo} />
        </div>

        <p className="mt-8 text-center text-xs text-ink-soft">
          Already have an account?{' '}
          <Link
            href={redirectTo === '/workspaces' ? '/login' : `/login?redirect=${encodeURIComponent(redirectTo)}`}
            className="font-bold text-blue hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
