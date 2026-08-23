import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, KeyRound } from 'lucide-react'

import { AlertBanner } from '@/components/ui/alert-banner'
import { getCurrentPublicUser } from '../getCurrentPublicUser'
import { ResetPasswordForm } from './ResetPasswordForm'

export const metadata: Metadata = {
  title: 'Reset password',
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const user = await getCurrentPublicUser()
  if (user) {
    redirect('/workspaces')
  }

  const { token } = await searchParams

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
          <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Reset password</h1>
          <p className="mt-1 text-sm font-medium text-ink-soft/80">Enter a new password for your account.</p>
        </div>

        <div className="mt-8 w-full">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="flex flex-col gap-4">
              <AlertBanner tone="error">
                This link is invalid or has expired. Request a new link to reset your password.
              </AlertBanner>
              <Link
                href="/forgot-password"
                className="text-center text-sm font-bold text-blue hover:underline"
              >
                Request a new link
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
