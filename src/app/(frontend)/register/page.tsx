import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { BrandLogo } from '@/components/brand-logo'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { isGoogleSsoEnabled } from '@/lib/auth/googleSso'
import { getCurrentPublicUser } from '../getCurrentPublicUser'
import { RegisterForm } from './RegisterForm'

export const metadata: Metadata = {
  title: 'Create account',
}

export default async function RegisterPage() {
  const user = await getCurrentPublicUser()
  if (user) {
    redirect('/workspaces')
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-mist px-6 py-10 font-sans">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <div className="mb-8 w-full">
          <Link
            href="/login"
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
          {isGoogleSsoEnabled() ? (
            <>
              <GoogleSignInButton redirectTo="/workspaces" label="Sign up with Google" />
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">or</span>
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          ) : null}
          <RegisterForm />
        </div>

        <p className="mt-8 text-center text-xs text-ink-soft">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-blue hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
