import { NextResponse, type NextRequest } from 'next/server'

// AUDIT_E2E SEC-02: no rate limiting or abuse protection existed anywhere in the app. This is a
// deliberately simple in-memory, single-instance sliding-window limiter - sufficient for the
// current single-container deployment, but it does NOT survive a process restart and does NOT
// coordinate across horizontally-scaled replicas. If this app is ever scaled beyond one instance,
// replace the Map below with a shared store - the docker-compose `redis` service is already
// provisioned but currently unused (see AUDIT_E2E OPS-03), and is the natural upgrade path.
//
// Login itself has a second, independent line of defense: Users.auth.maxLoginAttempts/lockTime
// (src/collections/Users.ts) locks an *account* after repeated failures regardless of which IP is
// attempting them. This proxy instead limits by *IP*, which is what stops a single attacker from
// hammering many different accounts or hitting the wider REST/GraphQL API.
//
// Named `proxy.ts`/`proxy()` per Next.js 16's renamed convention (the old `middleware.ts`/
// `middleware()` still works but is deprecated - https://nextjs.org/docs/messages/middleware-to-proxy).
// Proxy always runs on the Node.js runtime, which suits a stateful in-memory Map better than the
// old default Edge runtime did.

type WindowState = { count: number; windowStartedAt: number }

const WINDOW_MS = 60_000
const DEFAULT_LIMIT = 120
const LOGIN_LIMIT = 20
const buckets = new Map<string, WindowState>()

const getClientIp = (request: NextRequest) => {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

export function proxy(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === '/api/users/login'
  const ip = getClientIp(request)
  const key = `${ip}:${isLogin ? 'login' : 'api'}`
  const limit = isLogin ? LOGIN_LIMIT : DEFAULT_LIMIT
  const now = Date.now()

  const state = buckets.get(key)
  if (!state || now - state.windowStartedAt > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStartedAt: now })
    return NextResponse.next()
  }

  state.count += 1
  if (state.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - state.windowStartedAt)) / 1000))
    return NextResponse.json(
      { error: 'Too many requests. Please slow down and try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
