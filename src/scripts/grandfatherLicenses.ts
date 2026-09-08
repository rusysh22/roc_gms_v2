import { getPayload } from 'payload'

import config from '@payload-config'

// Seeds an "active" Licenses row for pre-existing accounts (see src/collections/Licenses.ts and
// workspaceAuth.tsx's subscription gate) - run this ONCE, right before setting the real
// BERLANGGAN_ACTIVATION_SECRET/BERLANGGAN_FINGERPRINT_PEPPER env vars in production, so nobody who
// was already using /workspaces gets locked out the moment gating actually turns on. While those
// env vars are unset, gating is inert and this script isn't needed yet - see
// src/lib/berlanggan/config.ts.
//
// Run (there is no cron in this repo - same host-scheduler TODO as drafts:cleanup):
//   npm run licenses:grandfather -- admin@intourney.local another@example.com
//   npm run licenses:grandfather -- admin@intourney.local --dry-run

const GRANDFATHERED_LICENSE_KEY = 'GRANDFATHERED'

const hasFlag = (name: string) => process.argv.includes(`--${name}`)
const dryRun = hasFlag('dry-run')
const emails = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))

if (emails.length === 0) {
  console.error('[licenses:grandfather] usage: npm run licenses:grandfather -- <email> [<email> ...] [--dry-run]')
  process.exit(1)
}

const payload = await getPayload({ config })
let grandfathered = 0
let skipped = 0

for (const email of emails) {
  const users = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    where: { email: { equals: email } },
  })
  const user = users.docs[0]
  if (!user) {
    console.log(`  skip: no user found for "${email}"`)
    skipped += 1
    continue
  }

  const existing = await payload.find({
    collection: 'licenses',
    depth: 0,
    limit: 1,
    where: { user_id: { equals: user.id } },
  })
  if (existing.docs[0]) {
    console.log(`  skip: ${email} already has a license row (status: ${existing.docs[0].effective_status})`)
    skipped += 1
    continue
  }

  if (dryRun) {
    console.log(`  would grandfather ${email} (user ${user.id})`)
    grandfathered += 1
    continue
  }

  await payload.create({
    collection: 'licenses',
    overrideAccess: true,
    data: {
      user_id: user.id,
      license_key: GRANDFATHERED_LICENSE_KEY,
      fingerprint: 'grandfathered',
      effective_status: 'active',
      entitlements: {},
      last_validated_at: new Date().toISOString(),
    },
  })
  console.log(`  grandfathered ${email} (user ${user.id})`)
  grandfathered += 1
}

console.log(
  `[licenses:grandfather] done${dryRun ? ' (dry run)' : ''} - ${grandfathered} grandfathered, ${skipped} skipped`,
)
process.exit(0)
