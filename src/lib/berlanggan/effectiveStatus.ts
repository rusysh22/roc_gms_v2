// Mirrors Berlanggan's own server-side priority order (its apps/licensing/services.py
// `_effective_access_status`, read from its source while researching this integration - see
// docs/26-license-subscription-integration.md §B3 in that platform's repo): the most restrictive
// status always wins. `active` and `grace` both mean "let the user in" - grace is Berlanggan's own
// short window where a renewal payment is overdue but access hasn't been cut yet - everything else
// blocks.
export type BerlangganStatus = 'active' | 'grace' | 'expired' | 'revoked' | 'suspended'

// The Licenses collection's own `effective_status` field additionally allows "not_activated" (its
// defaultValue, for a row nothing has ever activated) - a status Berlanggan itself never returns.
// effectiveStatusBucket accepts that wider type too so callers reading straight from the DB never
// need a lossy cast; it's handled the same as any other unrecognized value, via the safe default.
export type StoredLicenseStatus = BerlangganStatus | 'not_activated'

export type EffectiveStatusBucket = 'active' | 'grace' | 'blocked'

const STATUS_PRIORITY: BerlangganStatus[] = ['revoked', 'expired', 'suspended', 'grace', 'active']

/** Given every status seen for a license (normally just one, from the latest /validate response,
 * but pure/order-independent so callers never have to think about which one "wins" themselves).
 * Anything other than "active"/"grace" - including "not_activated" and any future/unknown value -
 * safely defaults to "blocked". */
export const effectiveStatusBucket = (status: StoredLicenseStatus): EffectiveStatusBucket => {
  if (status === 'active') return 'active'
  if (status === 'grace') return 'grace'
  return 'blocked'
}

/** Picks the single most-restrictive status out of a set, per STATUS_PRIORITY - not currently
 * needed by any caller (each call site only ever has one status at a time), kept small and
 * exported since it documents the priority order in one place rather than callers re-deriving it. */
export const mostRestrictiveStatus = (statuses: BerlangganStatus[]): BerlangganStatus | null => {
  for (const candidate of STATUS_PRIORITY) {
    if (statuses.includes(candidate)) return candidate
  }
  return null
}
