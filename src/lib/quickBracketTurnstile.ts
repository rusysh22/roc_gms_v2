// Cloudflare Turnstile bot check for Quick Bracket Tournament creation (the one no-login write
// surface in this app with no CAPTCHA of any kind in front of it yet - see
// prd/design/QUICK_BRACKET_TOURNAMENT_DESIGN.md section 3/8). Deliberately degrades to "open" (no
// check performed) when the env vars aren't configured, rather than hard-failing the whole
// feature - the honeypot + IP rate limit + participant cap still apply either way. Once
// TURNSTILE_SECRET_KEY is set, verification becomes real and fails CLOSED on any error (a bad/
// missing token, or Cloudflare's own siteverify endpoint being unreachable) - see the design doc's
// risk note: a guest losing one submission attempt is low-cost, an unverified bot submission is not.

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export const verifyQuickBracketTurnstileToken = async (
  token: string | null,
  remoteIp: string,
): Promise<boolean> => {
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  if (!secretKey) {
    // Not configured yet - the other anti-abuse layers (honeypot, rate limit, size cap) still run.
    return true
  }
  if (!token) {
    return false
  }

  try {
    const body = new URLSearchParams({ secret: secretKey, response: token, remoteip: remoteIp })
    const response = await fetch(SITEVERIFY_URL, { method: 'POST', body })
    if (!response.ok) {
      return false
    }
    const result = (await response.json()) as { success?: boolean }
    return result.success === true
  } catch {
    // Network/DNS failure talking to Cloudflare - fail closed, per the design doc's risk note.
    return false
  }
}
