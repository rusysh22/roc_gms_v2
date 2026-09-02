import { randomUUID } from 'crypto'

import type { Payload } from 'payload'
import { generatePayloadCookie, getFieldsToSign, jwtSign } from 'payload'

// Bridges a verified Google identity into Payload's own session/cookie machinery, so an SSO login
// is indistinguishable from an email+password one (same `payload-token` cookie, same
// `payload.auth()` result, same sessions array).

type SessionUser = { id: string | number; email?: string | null; sessions?: unknown }

/**
 * Finds the user for this verified Google email, creating one on first login. New accounts get the
 * `event_admin` role - the same default a public self-registration gets (see
 * src/collections/Users.ts) - so a first-time Google user can build their own event immediately,
 * while src/access/eventScope.ts still narrows that role to only the events they own.
 */
export const findOrCreateSsoUser = async (
  payload: Payload,
  claims: { email: string; name?: string },
): Promise<SessionUser> => {
  const email = claims.email.toLowerCase().trim()
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0]) return existing.docs[0] as SessionUser

  return (await payload.create({
    collection: 'users',
    depth: 0,
    overrideAccess: true,
    data: {
      email,
      name: claims.name?.trim() || email.split('@')[0],
      roles: ['event_admin'],
      // Local password login stays available but unknown until the user sets one via
      // "forgot password" - SSO never needs it.
      password: `${randomUUID()}${randomUUID()}`,
    },
  })) as SessionUser
}

/**
 * Mints a Payload session for `user` and returns the `Set-Cookie` string for the auth cookie -
 * the same one `/api/users/login` issues. Mirrors payload's own loginOperation
 * (addSessionToUser + getFieldsToSign + jwtSign + generatePayloadCookie).
 */
export const buildPayloadSessionCookie = async (
  payload: Payload,
  user: SessionUser,
): Promise<string> => {
  const collectionConfig = payload.collections.users.config
  const authConfig = collectionConfig.auth

  let sid: string | undefined
  if (authConfig.useSessions) {
    sid = randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + authConfig.tokenExpiration * 1000)
    const currentSessions = Array.isArray(user.sessions)
      ? (user.sessions as Array<{ id: string; createdAt?: string; expiresAt: string }>)
      : []
    const sessions = [
      ...currentSessions.filter((session) => new Date(session.expiresAt) > now),
      { id: sid, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() },
    ]
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { sessions },
      overrideAccess: true,
      depth: 0,
    })
  }

  const fieldsToSign = getFieldsToSign({
    collectionConfig,
    email: user.email ?? '',
    sid,
    user: { ...(user as Record<string, unknown>), collection: 'users' } as never,
  })

  const { token } = await jwtSign({
    fieldsToSign,
    secret: payload.secret,
    tokenExpiration: authConfig.tokenExpiration,
  })

  return generatePayloadCookie({
    collectionAuthConfig: authConfig,
    cookiePrefix: payload.config.cookiePrefix ?? 'payload',
    token,
  }) as string
}
