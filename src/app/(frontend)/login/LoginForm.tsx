'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
        setError(data?.errors?.[0]?.message || 'Invalid email or password.')
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
      <button
        type="button"
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm transition-all hover:bg-mist focus:ring-2 focus:ring-blue focus:outline-none active:bg-line/50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Masuk dengan Google
      </button>

      <div className="my-6 flex items-center">
        <div className="flex-grow border-t border-line"></div>
        <span className="mx-4 text-[10px] font-bold tracking-widest text-ink-soft/70 uppercase">
          Atau Pakai Email
        </span>
        <div className="flex-grow border-t border-line"></div>
      </div>

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
              placeholder="email@usahamu.com"
            />
          </div>
        </Field>

        <div className="flex flex-col">
          <div className="flex w-full items-center justify-between">
            <Label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wide text-ink">PASSWORD</Label>
            <button type="button" className="text-xs font-bold text-blue hover:underline">
              Lupa password?
            </button>
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
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue/30 transition-all hover:bg-[#15469f] hover:shadow-blue/40 focus:ring-4 focus:ring-blue/50 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : null}
          {submitting ? 'Masuk...' : 'Masuk ke Dashboard'}
          {!submitting && <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>}
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-ink-soft">
        Belum punya akun usaha?{' '}
        <button type="button" className="font-bold text-blue hover:underline">
          Daftar gratis &rarr;
        </button>
      </p>
    </div>
  )
}
