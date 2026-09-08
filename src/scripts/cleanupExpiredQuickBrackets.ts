import { getPayload } from 'payload'

import config from '@payload-config'

// Deletes "Quick Bracket Tournament" rows (prd/design/QUICK_BRACKET_TOURNAMENT_DESIGN.md) past
// their expires_at that were never claimed (status stays 'active' - claiming sets 'claimed', which
// this never touches). No relationship cascade is needed here (unlike cleanupAbandonedDrafts.ts's
// event cascade) since quick-brackets has no foreign keys into the authenticated system at all -
// deleting the row deletes everything.
//
// Run (there is no cron in this repo - same host-scheduler TODO as drafts:cleanup):
//   npm run quick-brackets:cleanup
//   npm run quick-brackets:cleanup -- --dry-run

const hasFlag = (name: string) => process.argv.includes(`--${name}`)
const dryRun = hasFlag('dry-run')

const payload = await getPayload({ config })
const now = new Date().toISOString()

const expired = await payload.find({
  collection: 'quick-brackets',
  depth: 0,
  limit: 1000,
  where: {
    and: [{ status: { equals: 'active' } }, { expires_at: { less_than: now } }],
  },
})

console.log(
  `[quick-brackets:cleanup] ${expired.docs.length} expired guest tournament(s)${dryRun ? ' (dry run)' : ''}`,
)

let deleted = 0
for (const doc of expired.docs) {
  if (dryRun) {
    console.log(`  would delete quick bracket ${doc.id} "${doc.name}" (expired ${doc.expires_at})`)
    deleted += 1
    continue
  }
  await payload.delete({ collection: 'quick-brackets', id: doc.id })
  console.log(`  deleted quick bracket ${doc.id} "${doc.name}"`)
  deleted += 1
}

console.log(`[quick-brackets:cleanup] done - ${deleted} deleted`)
process.exit(0)
