// One-time cleanup used while reshaping the ROC Olympic 2026 demo scenario: earlier seed runs
// generated round-robin matches with purely sequence-based match_numbers (see
// src/lib/matchGeneration.ts). Changing the underlying entry set (this session added/removed
// participants) shifts which pairing lands on which sequence number, which can collide with a
// stale row from a previous run. Matches/match-sets/standings/brackets/documentation/comments are
// all safely regenerable from demoScenario.ts, so this clears just those collections for the demo
// event and leaves reference data (clubs, players, teams, entries, venues, courts, categories,
// sports, rulesets, the event itself) untouched. Not part of the normal seed - run manually, once.
import { getPayload } from 'payload'

import config from '@payload-config'

const run = async () => {
  const payload = await getPayload({ config })
  const events = await payload.find({
    collection: 'events',
    limit: 1,
    where: { slug: { equals: 'roc-olympic-2026' } },
  })
  const eventId = events.docs[0]?.id

  if (!eventId) {
    console.log('No demo event found, nothing to reset.')
    return
  }

  for (const collection of ['match-sets', 'documentation-assets', 'standings', 'brackets'] as const) {
    const result = await payload.find({ collection, limit: 500, where: { event_id: { equals: eventId } } })
    for (const doc of result.docs) {
      await payload.delete({ collection, id: doc.id })
    }
    console.log(`Deleted ${result.docs.length} ${collection}`)
  }

  const comments = await payload.find({
    collection: 'comments',
    limit: 500,
    where: { entity_type: { equals: 'matches' } },
  })
  for (const doc of comments.docs) {
    await payload.delete({ collection: 'comments', id: doc.id })
  }
  console.log(`Deleted ${comments.docs.length} match comments`)

  const matches = await payload.find({
    collection: 'matches',
    limit: 500,
    where: { event_id: { equals: eventId } },
  })
  for (const doc of matches.docs) {
    await payload.delete({ collection: 'matches', id: doc.id })
  }
  console.log(`Deleted ${matches.docs.length} matches`)
}

await run()
process.exit(0)
