import { randomUUID } from 'crypto'

import { type NextRequest, NextResponse } from 'next/server'

import {
  GOOGLE_AUTH_ENDPOINT,
  OAUTH_COOKIE_MAX_AGE,
  OAUTH_REDIRECT_COOKIE,
  OAUTH_STATE_COOKIE,
  getGoogleOAuthConfig,
  googleCallbackUrl,
  sanitizeRedirect,
} from '@/lib/auth/googleSso'

export const dynamic = 'force-dynamic'

// Step 1 of the Google sign-in flow: stash a CSRF `state` + the post-login redirect target in
// short-lived cookies, then bounce the browser to Google's consent screen.
export function GET(request: NextRequest) {
  const config = getGoogleOAuthConfig()
  const origin = request.nextUrl.origin

  if (!config) {
    return NextResponse.redirect(new URL('/login?error=sso_unavailable', origin))
  }

  const redirectTarget = sanitizeRedirect(request.nextUrl.searchParams.get('redirect'))
  const state = randomUUID()

  const authUrl = new URL(GOOGLE_AUTH_ENDPOINT)
  authUrl.searchParams.set('client_id', config.clientId)
  authUrl.searchParams.set('redirect_uri', googleCallbackUrl(origin))
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('prompt', 'select_account')

  const response = NextResponse.redirect(authUrl)
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: OAUTH_COOKIE_MAX_AGE,
  }
  response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions)
  response.cookies.set(OAUTH_REDIRECT_COOKIE, redirectTarget, cookieOptions)
  return response
}
