// Same shape and same documented limitation as src/lib/anonymousDraftRateLimit.ts and
// src/lib/registrationRateLimit.ts: an independent in-memory limiter because src/proxy.ts's
// rate limiter only matches `/api/:path*` and never sees Server Action POSTs. Single-instance,
// does NOT survive a process restart and does NOT coordinate across horizontally-scaled replicas
// (the docker-compose `redis` service is provisioned but unused - same accepted upgrade path as
// the other two limiters). Looser than the anonymous-draft limit (3/hour) since a Quick Bracket
// write is much cheaper than a full anonymous event draft.

type WindowState = { count: number; windowStartedAt: number }

const WINDOW_MS = 60 * 60_000 // 1 hour
const LIMIT = 8 // quick bracket creations per IP per hour
const buckets = new Map<string, WindowState>()

export const checkQuickBracketRateLimit = (ip: string): boolean => {
  const now = Date.now()
  const state = buckets.get(ip)

  if (!state || now - state.windowStartedAt > WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStartedAt: now })
    return true
  }

  state.count += 1
  return state.count <= LIMIT
}
