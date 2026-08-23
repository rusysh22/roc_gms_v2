'use client'

import * as React from 'react'
import { Loader2, Mail } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { AlertBanner } from '@/components/ui/alert-banner'

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      // Always show the same success state whether or not the email exists - a differing response
      // would let this form be used to check which emails have accounts.
      if (response.ok) {
        setSent(true)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AlertBanner tone="success">
        If <strong>{email}</strong> is registered, we&apos;ve sent a password reset link. Check your
        inbox (and spam folder), then follow the link inside.
      </AlertBanner>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}

      <Field label="EMAIL" htmlFor="forgot-email">
        <div className="relative mt-1.5">
          <Mail
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
            aria-hidden="true"
          />
          <Input
            id="forgot-email"
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

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue/30 transition-all hover:bg-[#15469f] hover:shadow-blue/40 focus:ring-4 focus:ring-blue/50 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
        {submitting ? 'Sending...' : 'Send reset link'}
      </button>
    </form>
  )
}
