import { type NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import {
  OAUTH_REDIRECT_COOKIE,
  OAUTH_STATE_COOKIE,
  decodeGoogleIdToken,
  exchangeCodeForTokens,
  getGoogleOAuthConfig,
  googleCallbackUrl,
  sanitizeRedirect,
} from '@/lib/auth/googleSso'
import { buildPayloadSessionCookie, findOrCreateSsoUser } from '@/lib/auth/googleSsoSession'

export const dynamic = 'force-dynamic'

// Step 2: Google redirects back here with an authorization `code`. Validate `state`, exchange the
// code for an id_token, resolve/create the Payload user, and hand the browser a real Payload
// session cookie before redirecting on.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const params = request.nextUrl.searchParams
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin))

  const oauthConfig = getGoogleOAuthConfig()
  if (!oauthConfig) return fail('sso_unavailable')

  if (params.get('error')) return fail('sso_denied')

  const code = params.get('code')
  const state = params.get('state')
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value
  const redirectTarget = sanitizeRedirect(request.cookies.get(OAUTH_REDIRECT_COOKIE)?.value)

  if (!code || !state || !expectedState || state !== expectedState) {
    return fail('sso_state')
  }

  let sessionCookie: string
  try {
    const tokens = await exchangeCodeForTokens({
      code,
      config: oauthConfig,
      redirectUri: googleCallbackUrl(origin),
    })
    const claims = decodeGoogleIdToken(tokens.id_token)
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true'
    if (!claims.email || !emailVerified) {
      return fail('sso_email')
    }

    const payload = await getPayload({ config })
    const user = await findOrCreateSsoUser(payload, { email: claims.email, name: claims.name })
    sessionCookie = await buildPayloadSessionCookie(payload, user)
  } catch (error) {
    payloadWarn(error)
    return fail('sso_failed')
  }

  // All cookies go through headers.append (not response.cookies) so nothing clobbers the raw
  // Payload session cookie string.
  const response = NextResponse.redirect(new URL(redirectTarget, origin))
  response.headers.append('Set-Cookie', sessionCookie)
  response.headers.append('Set-Cookie', `${OAUTH_STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`)
  response.headers.append('Set-Cookie', `${OAUTH_REDIRECT_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`)
  return response
}

const payloadWarn = (error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[google-sso] callback failed:', error instanceof Error ? error.message : error)
}
