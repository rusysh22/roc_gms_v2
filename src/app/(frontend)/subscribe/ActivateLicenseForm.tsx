'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { activateLicenseAction, type ActivateLicenseResult } from './activateLicenseAction'

const LICENSE_KEY_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i

const ERROR_MESSAGES: Record<Exclude<ActivateLicenseResult, { ok: true }>['reason'], string> = {
  not_signed_in: 'Please sign in again and retry.',
  not_configured: 'Subscription activation is not available yet - please contact support.',
  invalid_format: 'That doesn’t look like a license key - it should look like XXXX-XXXX-XXXX.',
  invalid: 'That license key isn’t valid. Double-check it and try again.',
  expired: 'That license key has expired. Visit Pricing to get a new one.',
  seat_full: 'That license key is already in use by another account. Contact support if this is unexpected.',
  revoked: 'That license key has been revoked. Contact support if you believe this is a mistake.',
  suspended: 'That license key is currently suspended - most likely a payment issue on your Berlanggan account.',
  unreachable: 'Could not reach the billing service right now. Please try again in a moment.',
  rate_limited: 'Too many activation attempts. Please wait a few minutes and try again.',
}

export function ActivateLicenseForm({ redirectTo = '/workspaces' }: { redirectTo?: string }) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formatHint, setFormatHint] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!LICENSE_KEY_PATTERN.test(trimmed)) {
      setFormatHint(true)
      return
    }
    setFormatHint(false)
    setSaving(true)
    setError(null)
    const result = await activateLicenseAction(trimmed)
    setSaving(false)
    if (!result.ok) {
      setError(ERROR_MESSAGES[result.reason])
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="license-key" className="text-xs font-bold uppercase tracking-wide text-ink-soft">
        License key
      </label>
      <input
        id="license-key"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="XXXX-XXXX-XXXX"
        autoComplete="off"
        autoCapitalize="characters"
        className="h-11 rounded-full border border-line bg-paper px-4 text-sm font-semibold tracking-wide text-ink focus-visible:border-green focus-visible:outline-none"
      />
      {formatHint ? (
        <p className="text-xs font-semibold text-danger">
          License keys look like XXXX-XXXX-XXXX.
        </p>
      ) : null}
      {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}
      <Button type="submit" disabled={saving} className="self-start">
        {saving ? 'Activating...' : 'Activate'}
      </Button>
    </form>
  )
}
