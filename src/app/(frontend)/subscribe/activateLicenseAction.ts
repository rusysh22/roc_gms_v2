'use server'

import { headers } from 'next/headers'
import { getPayload } from 'payload'

import config from '@payload-config'
import { activate } from '@/lib/berlanggan/client'
import { getBerlangganConfig } from '@/lib/berlanggan/config'
import { deriveFingerprint } from '@/lib/berlanggan/fingerprint'

// Links a Berlanggan (berlanggan.web.id) license key - received by the customer via email/
// WhatsApp/their Berlanggan dashboard after buying a plan on /pricing - to the signed-in
// InTourney account, unlocking /workspaces (see workspaceAuth.tsx's subscription check). One
// InTourney account = one Berlanggan "seat" (fingerprint derived from the account id, not a real
// device - see src/lib/berlanggan/fingerprint.ts).

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
    }

// Same shape as the client-side check in ActivateLicenseForm.tsx - server-side is the real gate,
// the client one is only for fast typo feedback.
const LICENSE_KEY_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i

export async function activateLicenseAction(licenseKeyInput: string): Promise<ActivateLicenseResult> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) {
    return { ok: false, reason: 'not_signed_in' }
  }

  const licenseKey = licenseKeyInput.trim().toUpperCase()
  if (!LICENSE_KEY_PATTERN.test(licenseKey)) {
    return { ok: false, reason: 'invalid_format' }
  }

  const berlangganConfig = getBerlangganConfig()
  if (!berlangganConfig) {
    return { ok: false, reason: 'not_configured' }
  }

  const fingerprint = deriveFingerprint(user.id, berlangganConfig.pepper)
  const result = await activate(berlangganConfig, licenseKey, fingerprint)

  if (result.status !== 'active') {
    if (result.status === 'unreachable') {
      return { ok: false, reason: 'unreachable' }
    }
    // Record the rejection for support visibility even though activation failed - a support
    // conversation about "my key doesn't work" benefits from seeing what Berlanggan actually said.
    const existing = await payload.find({
      collection: 'licenses',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { user_id: { equals: user.id } },
    })
    if (existing.docs[0]) {
      await payload.update({
        collection: 'licenses',
        id: existing.docs[0].id,
        overrideAccess: true,
        data: { last_error: result.message || result.status },
      })
    }
    return { ok: false, reason: result.status }
  }

  const data = {
    user_id: user.id,
    license_key: licenseKey,
    fingerprint,
    token: result.token,
    token_expires_at: result.token_expires_at,
    license_expires_at: result.license_expires_at ?? null,
    effective_status: 'active' as const,
    entitlements: result.entitlements ?? {},
    last_validated_at: new Date().toISOString(),
    last_error: null,
  }

  const existing = await payload.find({
    collection: 'licenses',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { user_id: { equals: user.id } },
  })

  if (existing.docs[0]) {
    await payload.update({ collection: 'licenses', id: existing.docs[0].id, overrideAccess: true, data })
  } else {
    await payload.create({ collection: 'licenses', overrideAccess: true, data })
  }

  return { ok: true }
}
