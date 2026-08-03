// The public registration portal (NOVICE_ADMIN_FLOW_UX_REDESIGN.md P2 item 2) is the first
// unauthenticated write surface in this app - src/proxy.ts's rate limiter only matches
// `/api/:path*` and never sees Server Action POSTs (they hit the page route itself), so it does
// not protect this form at all. This is a second, independent limiter with the exact same
// documented limitation as proxy.ts's: in-memory, single-instance, does NOT survive a process
// restart and does NOT coordinate across horizontally-scaled replicas. The docker-compose `redis`
// service is already provisioned but unused - same noted upgrade path as proxy.ts.

type WindowState = { count: number; windowStartedAt: number }

const WINDOW_MS = 60 * 60_000 // 1 hour
const LIMIT = 5 // submissions per IP per event per hour
const buckets = new Map<string, WindowState>()

export const checkRegistrationRateLimit = (ip: string, eventId: string | number): boolean => {
  const key = `${ip}:${eventId}`
  const now = Date.now()
  const state = buckets.get(key)

  if (!state || now - state.windowStartedAt > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStartedAt: now })
    return true
  }

  state.count += 1
  return state.count <= LIMIT
}
