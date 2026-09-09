// AUDIT_TOURNAMENT_STANDARDS SEC-08: activateLicenseAction validates the XXXX-XXXX-XXXX shape and
// then calls Berlanggan's /v1/activate with no attempt counter at all - a signed-in user could
// script guesses against other customers' keys (a hit both leaks a valid key and can seize/deny
// that seat). Same in-memory, single-instance limitation as registrationRateLimit.ts / proxy.ts:
// not shared across replicas, not durable across a restart - the provisioned-but-unused redis
// service is the documented upgrade path.

type WindowState = { count: number; windowStartedAt: number }

const WINDOW_MS = 10 * 60_000 // 10 minutes
const LIMIT = 8 // activation attempts per identity per window
const buckets = new Map<string, WindowState>()

/** Returns true while the identity is under the limit, false once it should be locked out for the
 * rest of the window. Call once per attempt. Keyed per-user AND per-IP by the caller so neither a
 * single account nor a single host can outrun it. */
export const checkActivationRateLimit = (key: string): boolean => {
  const now = Date.now()
  const state = buckets.get(key)

  if (!state || now - state.windowStartedAt > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStartedAt: now })
    return true
  }

  state.count += 1
  return state.count <= LIMIT
}
