// The anonymous "Create New Event" wizard is a second unauthenticated write surface (after the
// public registration form). src/proxy.ts's rate limiter only matches `/api/:path*` and never
// sees Server Action POSTs, so - exactly like src/lib/registrationRateLimit.ts - this is an
// independent in-memory limiter with the same documented limitation: single-instance, does NOT
// survive a process restart and does NOT coordinate across horizontally-scaled replicas. The
// docker-compose `redis` service is provisioned but unused - the noted upgrade path.

type WindowState = { count: number; windowStartedAt: number }

const WINDOW_MS = 60 * 60_000 // 1 hour
const LIMIT = 3 // anonymous event creations per IP per hour
const buckets = new Map<string, WindowState>()

export const checkAnonymousDraftRateLimit = (ip: string): boolean => {
  const now = Date.now()
  const state = buckets.get(ip)

  if (!state || now - state.windowStartedAt > WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStartedAt: now })
    return true
  }

  state.count += 1
  return state.count <= LIMIT
}
