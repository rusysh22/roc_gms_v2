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

export type BerlangganWebhookConfig = BerlangganConfig & {
  webhookSecret: string
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

/** Full activation config PLUS the shared secret Berlanggan signs its outgoing `order.paid` /
 * `subscription.*` webhooks with (see src/app/(frontend)/api/berlanggan/webhook/route.ts). Null
 * until BERLANGGAN_WEBHOOK_SECRET is also set - the webhook route treats null as "auto-activation
 * isn't wired up yet" and 404s, so a missing secret can never be mistaken for an accepted call.
 * Requires the activation config too because handling `license.issued` calls POST /v1/activate to
 * register the account's seat and get a heartbeat token. */
export const getBerlangganWebhookConfig = (): BerlangganWebhookConfig | null => {
  const full = getBerlangganConfig()
  const webhookSecret = process.env.BERLANGGAN_WEBHOOK_SECRET
  if (!full || !webhookSecret) return null
  return { ...full, webhookSecret }
}

export const isPricingConfigured = () => getBerlangganPricingConfig() !== null
export const isGatingConfigured = () => getBerlangganConfig() !== null
export const isWebhookConfigured = () => getBerlangganWebhookConfig() !== null
