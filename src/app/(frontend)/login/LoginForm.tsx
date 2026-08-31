'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Label } from '@/components/ui/label'

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

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

      router.push(redirectTo)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex w-full flex-col">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}

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
              className="pl-9 h-11 rounded-xl"
              placeholder="you@company.com"
            />
          </div>
        </Field>

        <div className="flex flex-col">
          <div className="flex w-full items-center justify-between">
            <Label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wide text-ink">PASSWORD</Label>
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
              className="pr-10 pl-9 h-11 rounded-xl [&::-ms-reveal]:hidden"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-soft transition-colors hover:text-ink"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="group mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green to-blue px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue/30 transition-all hover:brightness-90 hover:shadow-blue/40 focus:ring-4 focus:ring-blue/50 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : null}
          {submitting ? 'Signing in...' : 'Sign in to Dashboard'}
          {!submitting && <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>}
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-ink-soft">
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
