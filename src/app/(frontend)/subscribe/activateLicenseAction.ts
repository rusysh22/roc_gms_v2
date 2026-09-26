'use server'

import { headers } from 'next/headers'
import { getPayload } from 'payload'

import config from '@payload-config'
import { checkActivationRateLimit } from '@/lib/berlanggan/activationRateLimit'
import { getBerlangganConfig } from '@/lib/berlanggan/config'
import { activateAndStoreLicense } from '@/lib/berlanggan/licenseStore'

// The manual fallback: paste a Berlanggan (berlanggan.web.id) license key - received via email/
// WhatsApp/the Berlanggan dashboard after buying a plan on /pricing - to link it to the signed-in
// InTourney account. The primary path is Berlanggan's signed `license.issued` webhook
// (src/app/(frontend)/api/berlanggan/webhook/route.ts), which activates the account automatically
// the moment payment clears; this form only matters when that didn't reach the right account (e.g.
// the buyer used a different email at checkout). Both paths share activateAndStoreLicense.

export type ActivateLicenseResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'not_signed_in'
        | 'not_configured'
        | 'invalid_format'
        | 'invalid'
        | 'expired'
        | 'seat_full'
        | 'revoked'
        | 'suspended'
        | 'unreachable'
        | 'rate_limited'
    }

// Same shape as the client-side check in ActivateLicenseForm.tsx - server-side is the real gate,
// the client one is only for fast typo feedback.
const LICENSE_KEY_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i

export async function activateLicenseAction(licenseKeyInput: string): Promise<ActivateLicenseResult> {
  const payload = await getPayload({ config })
  const headerBag = await headers()
  const { user } = await payload.auth({ headers: headerBag })
  if (!user) {
    return { ok: false, reason: 'not_signed_in' }
  }

  const licenseKey = licenseKeyInput.trim().toUpperCase()
  if (!LICENSE_KEY_PATTERN.test(licenseKey)) {
    return { ok: false, reason: 'invalid_format' }
  }

  // SEC-08: throttle per-account and per-IP so a signed-in user can't script guesses at other
  // customers' keys. Checked after the shape test (a malformed string was never a real attempt).
  const ip = (headerBag.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  if (!checkActivationRateLimit(`u:${user.id}`) || !checkActivationRateLimit(`ip:${ip}`)) {
    return { ok: false, reason: 'rate_limited' }
  }

  const berlangganConfig = getBerlangganConfig()
  if (!berlangganConfig) {
    return { ok: false, reason: 'not_configured' }
  }

  const result = await activateAndStoreLicense(payload, {
    config: berlangganConfig,
    userId: user.id,
    licenseKey,
  })

  if (!result.ok) {
    return { ok: false, reason: result.reason }
  }
  return { ok: true }
}
