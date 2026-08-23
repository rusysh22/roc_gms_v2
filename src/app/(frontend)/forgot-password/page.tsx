import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, KeyRound } from 'lucide-react'

import { getCurrentPublicUser } from '../getCurrentPublicUser'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Forgot password',
}

export default async function ForgotPasswordPage() {
  const user = await getCurrentPublicUser()
  if (user) {
    redirect('/workspaces')
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-[#f8f9fc] px-6 py-10 font-sans">
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

        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue/10 text-blue">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="mt-4 w-full text-left">
          <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Forgot password?</h1>
          <p className="mt-1 text-sm font-medium text-ink-soft/80">
            Enter your account email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <div className="mt-8 w-full">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  )
}
