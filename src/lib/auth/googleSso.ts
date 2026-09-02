// Shared, dependency-light config + helpers for "Sign in with Google" (OAuth 2.0
// authorization-code flow). The Payload-session side lives in ./googleSsoSession so this module
// stays safe to import from Server Components / the root layout.

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

export const OAUTH_STATE_COOKIE = 'g_oauth_state'
export const OAUTH_REDIRECT_COOKIE = 'g_oauth_redirect'
export const OAUTH_COOKIE_MAX_AGE = 600 // 10 minutes to complete the round-trip

export type GoogleOAuthConfig = { clientId: string; clientSecret: string }

/** Returns the configured Google OAuth credentials, or null when SSO isn't set up for this env. */
export const getGoogleOAuthConfig = (): GoogleOAuthConfig | null => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export const isGoogleSsoEnabled = () => getGoogleOAuthConfig() !== null

export const googleCallbackUrl = (origin: string) => `${origin}/api/auth/google/callback`

/** Only ever redirect within the app - an open `redirect` param is a phishing vector. */
export const sanitizeRedirect = (value: string | null | undefined, fallback = '/workspaces') => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback
  return value
}

export type GoogleIdTokenClaims = {
  email?: string
  email_verified?: boolean | string
  name?: string
  given_name?: string
  picture?: string
  sub?: string
}

/**
 * Decodes the payload of the id_token returned by Google's token endpoint. Signature
 * verification is intentionally skipped: the token was just fetched over TLS directly from
 * `oauth2.googleapis.com` using our client secret, so its authenticity is established by the
 * transport (standard for the server-side authorization-code flow).
 */
export const decodeGoogleIdToken = (idToken: string): GoogleIdTokenClaims => {
  const payloadSegment = idToken.split('.')[1]
  if (!payloadSegment) throw new Error('Malformed Google id_token')
  return JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as GoogleIdTokenClaims
}

export const exchangeCodeForTokens = async (params: {
  code: string
  config: GoogleOAuthConfig
  redirectUri: string
}): Promise<{ id_token: string; access_token: string }> => {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.config.clientId,
      client_secret: params.config.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status})`)
  }
  return response.json() as Promise<{ id_token: string; access_token: string }>
}
