'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Label } from '@/components/ui/label'
import { BrandLogo } from '@/components/brand-logo'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'

const SSO_ERROR_MESSAGES: Record<string, string> = {
  sso_unavailable: "Google sign-in isn't available right now. Please use your email and password.",
  sso_denied: 'Google sign-in was cancelled.',
  sso_state: 'Google sign-in expired. Please try again.',
  sso_email: 'That Google account has no verified email address.',
  sso_failed: "Google sign-in didn't complete. Please try again or use your email and password.",
}

export interface LoginPanelProps {
  /** Where to send the user after a successful email/password login. */
  redirectTo: string
  /** SSO failure code carried on `/login?error=` (page use only). */
  ssoError?: string | null
  /** Called instead of navigating after email/password success (modal use). */
  onSuccess?: () => void
  /** Hide the "iT" mark + heading (the dialog already has its own title). */
  hideHeader?: boolean
  /** Whether Google SSO is configured for this environment (hides the button + divider if not). */
  googleSsoEnabled?: boolean
}

export function LoginPanel({
  redirectTo,
  ssoError,
  onSuccess,
  hideHeader,
  googleSsoEnabled = true,
}: LoginPanelProps) {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(
    ssoError ? SSO_ERROR_MESSAGES[ssoError] ?? SSO_ERROR_MESSAGES.sso_failed : null,
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.errors?.[0]?.message || 'Incorrect email or password.')
        setSubmitting(false)
        return
      }

      if (onSuccess) {
        onSuccess()
        router.refresh()
        return
      }
      router.push(redirectTo)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex w-full flex-col">
      {!hideHeader ? (
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo variant="icon" height={40} />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-soft">Sign in to manage your tournaments</p>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4">
          <AlertBanner tone="error">{error}</AlertBanner>
        </div>
      ) : null}

      {googleSsoEnabled ? (
        <>
          <GoogleSignInButton redirectTo={redirectTo} />
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="EMAIL" htmlFor="login-email">
          <div className="relative mt-1.5">
            <Mail
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
              aria-hidden="true"
            />
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-xl pl-9"
              placeholder="you@company.com"
            />
          </div>
        </Field>

        <div className="flex flex-col">
          <div className="flex w-full items-center justify-between">
            <Label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wide text-ink">
              PASSWORD
            </Label>
            <Link href="/forgot-password" className="text-xs font-bold text-blue hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-1.5">
            <Lock
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
              aria-hidden="true"
            />
            <Input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-xl pr-10 pl-9 [&::-ms-reveal]:hidden"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-soft transition-colors hover:text-ink"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green to-blue px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue/30 transition-all hover:brightness-90 focus:ring-4 focus:ring-blue/50 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
          {submitting ? 'Signing in...' : 'Sign in'}
          {!submitting ? (
            <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
          ) : null}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-ink-soft">
        Don&apos;t have an account?{' '}
        <Link
          href={redirectTo === '/workspaces' ? '/register' : `/register?redirect=${encodeURIComponent(redirectTo)}`}
          className="font-bold text-blue hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  )
}
