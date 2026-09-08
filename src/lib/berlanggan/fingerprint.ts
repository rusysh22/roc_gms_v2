import { createHash } from 'crypto'

// Berlanggan's Activation API was built for installed software, where a "device" gets a real
// hardware fingerprint. InTourney is a multi-tenant web app with no device - one InTourney
// account is treated as one seat/"device" instead, so the fingerprint is derived deterministically
// from the account id plus a local, non-secret-to-Berlanggan pepper (BERLANGGAN_FINGERPRINT_PEPPER)
// so the same account always re-derives the same fingerprint without storing it redundantly
// anywhere else. Pure function, no I/O - safe to call from both Server Actions and tests.
export const deriveFingerprint = (userId: string | number, pepper: string): string =>
  createHash('sha256').update(`${userId}:${pepper}`).digest('hex')
