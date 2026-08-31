import { getPayload } from 'payload'

import config from '@payload-config'
import { deleteEventCascade, eventIsAbandonable } from '@/lib/cascadeDelete'

// Deletes anonymous "Create New Event" drafts that were never claimed by an account. An unclaimed
// draft still has events.draft_claim_token set (it's cleared the moment someone registers/logs in
// and claims it) and no EventMemberships row, so it is invisible to every workspace and only
// reachable by the original visitor's cookie. After ANON_DRAFT_TTL_DAYS we assume that visitor is
// not coming back.
//
// Run (there is no cron in this repo - wire into the host's scheduler, like the TLS renew job):
//   npm run drafts:cleanup                 # default 14-day TTL, dry run off
//   npm run drafts:cleanup -- --days=30
//   npm run drafts:cleanup -- --dry-run

const getArg = (name: string) => {
  const prefix = `--${name}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg?.slice(prefix.length) || process.env[name.toUpperCase().replace(/-/g, '_')]
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`)

const ttlDays = Number(getArg('days')) || 14
const dryRun = hasFlag('dry-run')

const payload = await getPayload({ config })
const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString()

const stale = await payload.find({
  collection: 'events',
  depth: 0,
  limit: 1000,
  where: {
    and: [{ draft_claim_token: { exists: true } }, { createdAt: { less_than: cutoff } }],
  },
})

console.log(
  `[drafts:cleanup] ${stale.docs.length} unclaimed anonymous draft(s) older than ${ttlDays}d${
    dryRun ? ' (dry run)' : ''
  }`,
)

let deleted = 0
let skipped = 0
for (const event of stale.docs) {
  const abandonable = await eventIsAbandonable(payload, event.id)
  if (!abandonable.ok) {
    // Should not happen (an anon visitor can't generate matches), but never bulk-delete an event
    // with real scheduling/scoring work.
    console.warn(`  skip event ${event.id} "${event.name}" - ${abandonable.reason}`)
    skipped += 1
    continue
  }
  if (dryRun) {
    console.log(`  would delete event ${event.id} "${event.name}" (created ${event.createdAt})`)
    deleted += 1
    continue
  }
  await deleteEventCascade(payload, event.id)
  console.log(`  deleted event ${event.id} "${event.name}"`)
  deleted += 1
}

console.log(`[drafts:cleanup] done - ${deleted} deleted, ${skipped} skipped`)
process.exit(0)
