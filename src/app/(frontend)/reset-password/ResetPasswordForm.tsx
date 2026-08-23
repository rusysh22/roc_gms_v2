'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { AlertBanner } from '@/components/ui/alert-banner'

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
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
      const response = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.errors?.[0]?.message || 'This link is invalid or has expired.')
        setSubmitting(false)
        return
      }

      // Payload's reset-password endpoint logs the user in on success (sets the auth cookie), so a
      // straight redirect to the app is all that's needed - no separate login step.
      router.push('/workspaces')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}

      <Field label="NEW PASSWORD" htmlFor="reset-password">
        <div className="relative mt-1.5">
          <Lock
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
            aria-hidden="true"
          />
          <Input
            id="reset-password"
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

      <Field label="CONFIRM PASSWORD" htmlFor="reset-password-confirm">
        <div className="relative mt-1.5">
          <Lock
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
            aria-hidden="true"
          />
          <Input
            id="reset-password-confirm"
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
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue/30 transition-all hover:bg-[#15469f] hover:shadow-blue/40 focus:ring-4 focus:ring-blue/50 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
        {submitting ? 'Saving...' : 'Save new password'}
      </button>
    </form>
  )
}
