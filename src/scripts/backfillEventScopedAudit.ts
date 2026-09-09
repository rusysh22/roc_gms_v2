import { getPayload } from 'payload'

import config from '@payload-config'
import { resolveEventIdForEntity } from '@/access/entityEventScope'

// AUDIT_TOURNAMENT_STANDARDS SEC-04 / SEC-05: `comments` and `audit-logs` gained a denormalised
// `event_id` for per-event access scoping. New rows get it on write (Comments.ts hook, audit.ts);
// this backfills the rows that predate that so they don't vanish from every non-super_admin view
// the moment the scoped `read` ships. Idempotent - re-running only touches rows still missing it.
//
//   npm run audit:backfill-event
//   npm run audit:backfill-event -- --dry-run

const dryRun = process.argv.includes('--dry-run')

const payload = await getPayload({ config })

for (const collection of ['comments', 'audit-logs'] as const) {
  let page = 1
  let filled = 0
  let skipped = 0

  for (;;) {
    const batch = await payload.find({
      collection,
      depth: 0,
      limit: 200,
      page,
      overrideAccess: true,
      where: { event_id: { exists: false } },
    })
    if (batch.docs.length === 0) break

    for (const doc of batch.docs) {
      const entityType = String((doc as { entity_type?: unknown }).entity_type ?? '')
      const entityId = (doc as { entity_id?: string | number }).entity_id
      const eventId =
        entityType && entityId != null
          ? await resolveEventIdForEntity(payload, entityType, entityId)
          : null

      if (eventId == null) {
        skipped += 1
        continue
      }
      if (!dryRun) {
        await payload.update({ collection, id: doc.id, overrideAccess: true, data: { event_id: eventId } })
      }
      filled += 1
    }

    // Not advancing the page when we actually wrote: the `exists: false` filter shrinks under us.
    if (dryRun) page += 1
  }

  console.log(`[${collection}] ${dryRun ? 'would fill' : 'filled'} ${filled}, unresolved ${skipped}`)
}

process.exit(0)
