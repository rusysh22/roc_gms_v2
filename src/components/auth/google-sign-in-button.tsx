'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'

const GoogleGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.52 12.27c0-.86-.08-1.68-.22-2.47H12v4.68h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.1 3.58-5.18 3.58-8.83Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.96-1.08 7.94-2.9l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.96H1.28v3.1A12 12 0 0 0 12 24Z"
    />
    <path fill="#FBBC05" d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4-3.1Z" />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
    />
  </svg>
)

/** Kicks off the Google OAuth flow (src/app/(frontend)/api/auth/google). `redirectTo` is where
 * the user lands after a successful sign-in. */
export function GoogleSignInButton({
  redirectTo,
  label = 'Continue with Google',
}: {
  redirectTo: string
  label?: string
}) {
  const [loading, setLoading] = React.useState(false)
  const href = `/api/auth/google?redirect=${encodeURIComponent(redirectTo)}`

  return (
    <a
      href={href}
      onClick={() => setLoading(true)}
      aria-disabled={loading}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-paper px-4 text-sm font-bold text-ink no-underline transition-colors hover:bg-mist aria-disabled:opacity-70"
    >
      {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden="true" /> : <GoogleGlyph />}
      {label}
    </a>
  )
}
