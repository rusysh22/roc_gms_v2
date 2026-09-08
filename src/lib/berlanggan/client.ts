import type { BerlangganConfig, BerlangganPricingConfig } from './config'
import type { BerlangganStatus } from './effectiveStatus'

// Thin wrapper around Berlanggan's (berlanggan.web.id) public catalog + Activation API. Plain
// fetch(), no SDK/retry wrapper - matches the precedent in src/lib/auth/googleSso.ts and
// src/lib/quickBracketTurnstile.ts. Every function takes its config as an explicit parameter
// (never reads process.env internally) so callers - and tests - can pass a fixed config without
// env-var stubbing.

export type PlanDto = {
  id: number | string
  name: string
  price: number
  interval: 'none' | 'monthly' | 'yearly'
  seat_limit: number
  sort_order: number
  entitlements: Record<string, unknown>
  checkout_url: string
}

export type FetchPlansResult = { ok: true; plans: PlanDto[] } | { ok: false; error: 'unreachable' }

/** GET /v1/catalog/products/{slug}/plans - no auth required, this is Berlanggan's own public
 * storefront listing endpoint. Revalidated hourly by the caller (see /pricing) via Next's fetch
 * cache, not here - this function stays cache-policy-agnostic so tests can call it directly. */
export const fetchPlans = async (
  config: BerlangganPricingConfig,
  init?: RequestInit,
): Promise<FetchPlansResult> => {
  try {
    const response = await fetch(
      `${config.baseUrl}/v1/catalog/products/${encodeURIComponent(config.productSlug)}/plans`,
      init,
    )
    if (!response.ok) {
      return { ok: false, error: 'unreachable' }
    }
    const plans = (await response.json()) as PlanDto[]
    return { ok: true, plans }
  } catch {
    return { ok: false, error: 'unreachable' }
  }
}

type ActivationEnvelope = {
  token?: string
  token_expires_at?: string
  license_expires_at?: string
  entitlements?: Record<string, unknown>
}

export type ActivateResult =
  | ({ status: 'active' } & Required<Pick<ActivationEnvelope, 'token' | 'token_expires_at'>> &
      Pick<ActivationEnvelope, 'license_expires_at' | 'entitlements'>)
  | { status: 'invalid' | 'expired' | 'seat_full' | 'revoked' | 'suspended'; message?: string }
  | { status: 'unreachable' }

export type ValidateResult =
  | ({ status: BerlangganStatus } & ActivationEnvelope)
  | { status: 'unreachable' }

export type DeactivateResult = { status: 'deactivated' } | { status: 'unreachable' }

const activationHeaders = (config: BerlangganConfig): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-Berlanggan-Secret': config.activationSecret,
})

/** POST /v1/activate - registers this InTourney account's derived fingerprint as a "seat" against
 * a license key. Idempotent on Berlanggan's side for an already-registered fingerprint (re-running
 * this for the same account never consumes a second seat). */
export const activate = async (
  config: BerlangganConfig,
  licenseKey: string,
  fingerprint: string,
): Promise<ActivateResult> => {
  try {
    const response = await fetch(`${config.baseUrl}/v1/activate`, {
      method: 'POST',
      headers: activationHeaders(config),
      body: JSON.stringify({ license_key: licenseKey, fingerprint }),
    })
    return (await response.json()) as ActivateResult
  } catch {
    return { status: 'unreachable' }
  }
}

/** POST /v1/validate - the heartbeat call. Called lazily (see subscriptionGate.ts), not on a
 * schedule - this repo has no cron infrastructure, so re-validation happens opportunistically when
 * a signed-in user actually opens a gated page and the cached status has gone stale. */
export const validate = async (
  config: BerlangganConfig,
  licenseKey: string,
  fingerprint: string,
  token: string,
): Promise<ValidateResult> => {
  try {
    const response = await fetch(`${config.baseUrl}/v1/validate`, {
      method: 'POST',
      headers: activationHeaders(config),
      body: JSON.stringify({ license_key: licenseKey, fingerprint, token }),
    })
    return (await response.json()) as ValidateResult
  } catch {
    return { status: 'unreachable' }
  }
}

/** POST /v1/deactivate - frees the seat. Not wired into any UI yet (see the plan's documented v1
 * limitation on license reassignment) - exported now so a super_admin support fix or a future
 * self-service "detach my account" action has it ready to call. */
export const deactivate = async (
  config: BerlangganConfig,
  licenseKey: string,
  fingerprint: string,
): Promise<DeactivateResult> => {
  try {
    const response = await fetch(`${config.baseUrl}/v1/deactivate`, {
      method: 'POST',
      headers: activationHeaders(config),
      body: JSON.stringify({ license_key: licenseKey, fingerprint }),
    })
    return (await response.json()) as DeactivateResult
  } catch {
    return { status: 'unreachable' }
  }
}
