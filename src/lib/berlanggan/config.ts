// Shared config resolution for the Berlanggan (berlanggan.web.id) subscription-billing
// integration - mirrors src/lib/auth/googleSso.ts's getGoogleOAuthConfig/isGoogleSsoEnabled
// shape: returns null (rather than throwing) whenever the required env vars aren't set, so every
// caller can degrade gracefully instead of every caller re-checking three env vars itself.
//
// Two configuration levels, not one, because the two things Berlanggan powers here have
// different auth requirements:
// - /pricing reads the public catalog endpoint (GET /v1/catalog/products/{slug}/plans), which
//   needs no secret at all - only the product slug.
// - Activating/validating a license (POST /v1/activate, /v1/validate, /v1/deactivate) needs the
//   product slug AND the shared activation secret AND a local pepper to derive a stable
//   fingerprint from an InTourney user id (see fingerprint.ts).
// This split lets /pricing go live before the operator has finished wiring up activation.

const DEFAULT_BASE_URL = 'https://berlanggan.web.id'

export type BerlangganPricingConfig = {
  baseUrl: string
  productSlug: string
}

export type BerlangganConfig = BerlangganPricingConfig & {
  activationSecret: string
  pepper: string
}

const resolveBaseUrl = () => (process.env.BERLANGGAN_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')

/** Enough to fetch the public plan catalog - no secret required. Null until a product slug is set. */
export const getBerlangganPricingConfig = (): BerlangganPricingConfig | null => {
  const productSlug = process.env.BERLANGGAN_PRODUCT_SLUG
  if (!productSlug) return null
  return { baseUrl: resolveBaseUrl(), productSlug }
}

/** Full config needed to activate/validate/deactivate a license. Null until all three vars are set
 * - callers (subscriptionGate.ts, activateLicenseAction.ts) treat null as "gating is inert", not
 * as an error - see docs on checkSubscription for why that matters at rollout. */
export const getBerlangganConfig = (): BerlangganConfig | null => {
  const pricing = getBerlangganPricingConfig()
  const activationSecret = process.env.BERLANGGAN_ACTIVATION_SECRET
  const pepper = process.env.BERLANGGAN_FINGERPRINT_PEPPER
  if (!pricing || !activationSecret || !pepper) return null
  return { ...pricing, activationSecret, pepper }
}

export const isPricingConfigured = () => getBerlangganPricingConfig() !== null
export const isGatingConfigured = () => getBerlangganConfig() !== null
