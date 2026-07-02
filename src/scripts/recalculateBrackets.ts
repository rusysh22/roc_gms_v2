import { getPayload } from 'payload'

import config from '@payload-config'
import { recalculateSingleEliminationBracket } from '@/lib/brackets'

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
const stageId = requireArg('stage')
const result = await recalculateSingleEliminationBracket(payload, { stageId })

payload.logger.info(
  `Recalculated bracket ${result.bracketId} with ${result.matchCount} match(es) across ${result.roundCount} round(s).`,
)
console.log(JSON.stringify(result, null, 2))
process.exit(0)
