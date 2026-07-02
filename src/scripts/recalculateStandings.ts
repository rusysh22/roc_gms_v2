import { getPayload } from 'payload'

import config from '@payload-config'
import { recalculateStandingsForScope } from '@/lib/standings'

const getArg = (name: string) => {
  const prefix = `--${name}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))

  return (
    arg?.slice(prefix.length) ||
    process.env[name.toUpperCase()] ||
    process.env[`npm_config_${name}`]
  )
}

const requireArg = (name: string) => {
  const value = getArg(name)
  if (!value) {
    throw new Error(`Missing --${name}=...`)
  }

  return value
}

const payload = await getPayload({ config })
const categoryId = requireArg('category')
const stageId = requireArg('stage')
const groupId = getArg('group')
const eventId = getArg('event')

const result = await recalculateStandingsForScope(payload, {
  eventId,
  categoryId,
  stageId,
  groupId,
})

payload.logger.info(
  `Recalculated ${result.rows.length} standing row(s) from ${result.finishedMatchCount} result match(es).`,
)
console.log(JSON.stringify(result.rows, null, 2))
process.exit(0)
