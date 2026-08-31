'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { AlertBanner } from '@/components/ui/alert-banner'

export function RegisterForm({ redirectTo = '/workspaces' }: { redirectTo?: string }) {
  const router = useRouter()
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const createResponse = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      if (!createResponse.ok) {
        const data = await createResponse.json().catch(() => null)
        setError(data?.errors?.[0]?.message || 'Could not create your account. Please try again.')
        setSubmitting(false)
        return
      }

      // Creating a user doesn't itself start a session (unlike login/reset-password) - log in with
      // the same credentials right after so registering lands you signed in, not back at /login.
      const loginResponse = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!loginResponse.ok) {
        router.push(
          redirectTo === '/workspaces' ? '/login' : `/login?redirect=${encodeURIComponent(redirectTo)}`,
        )
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}

      <Field label="FULL NAME" htmlFor="register-name">
        <div className="relative mt-1.5">
          <User
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
            aria-hidden="true"
          />
          <Input
            id="register-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="pl-9 h-11 rounded-xl"
            placeholder="Jane Doe"
          />
        </div>
      </Field>

      <Field label="EMAIL" htmlFor="register-email">
        <div className="relative mt-1.5">
          <Mail
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
            aria-hidden="true"
          />
          <Input
            id="register-email"
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

      <Field label="PASSWORD" htmlFor="register-password">
        <div className="relative mt-1.5">
          <Lock
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
            aria-hidden="true"
          />
          <Input
            id="register-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
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
      </Field>

      <Field label="CONFIRM PASSWORD" htmlFor="register-password-confirm">
        <div className="relative mt-1.5">
          <Lock
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
            aria-hidden="true"
          />
          <Input
            id="register-password-confirm"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="pl-9 h-11 rounded-xl [&::-ms-reveal]:hidden"
            placeholder="••••••••"
          />
        </div>
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green to-blue px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue/30 transition-all hover:brightness-90 hover:shadow-blue/40 focus:ring-4 focus:ring-blue/50 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
        {submitting ? 'Creating account...' : 'Create account'}
        {!submitting && <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>}
      </button>
    </form>
  )
}
