import { getPayload } from 'payload'

import config from '@payload-config'
import { recalculateMedalsForCategory } from '@/lib/medals'

// MSG-02 backfill: recalculates medals for every medal_eligible category in one event. Needed the
// first time an already-running event turns medal_tally_enabled on, since match-result transitions
// only trigger recalculation going forward, not retroactively for results already published.
const getArg = (name: string) => {
  const prefix = `--${name}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))

  return arg?.slice(prefix.length) || process.env[name.toUpperCase()] || process.env[`npm_config_${name}`]
}

const requireArg = (name: string) => {
  const value = getArg(name)
  if (!value) {
    throw new Error(`Missing --${name}=...`)
  }

  return value
}

const payload = await getPayload({ config })
const eventId = requireArg('event')

const categories = await payload.find({
  collection: 'competition-categories',
  depth: 0,
  limit: 500,
  where: { and: [{ event_id: { equals: eventId } }, { medal_eligible: { equals: true } }] },
})

const summary: Array<{ categoryId: string | number; written: number; finished: boolean; blockedByTie: boolean }> = []
for (const category of categories.docs) {
  const result = await recalculateMedalsForCategory(payload, category.id)
  summary.push({ categoryId: category.id, written: result.written, finished: result.finished, blockedByTie: result.blockedByTie })
}

payload.logger.info(
  `Recalculated medals for ${summary.length} categor${summary.length === 1 ? 'y' : 'ies'} in event ${eventId}.`,
)
console.log(JSON.stringify(summary, null, 2))
process.exit(0)
