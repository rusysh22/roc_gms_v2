import type { Payload } from 'payload'

type Id = string | number
type Stage = {
  event_id?: Id | { id?: Id } | null
  category_id?: Id | { id?: Id; sport_id?: Id | { id?: Id } | null } | null
}
type Match = { match_number: string; round_name?: string | null }
const idOf = (value: Id | { id?: Id } | null | undefined): number | undefined => {
  const raw = typeof value === 'object' ? value?.id : value
  return raw === undefined || raw === null ? undefined : Number(raw)
}
const nameFor = (remaining: number) => remaining === 0 ? 'Final' : remaining === 1 ? 'Semifinal' : remaining === 2 ? 'Quarterfinal' : `Round of ${2 ** (remaining + 1)}`

/** Safely fills downstream TBD fixtures for legacy wizard brackets. Existing fixtures are never changed. */
export const ensureSingleEliminationBracketStructure = async (payload: Payload, stageId: Id) => {
  const stage = (await payload.findByID({ collection: 'stages', id: stageId, depth: 1 })) as Stage
  const eventId = idOf(stage.event_id); const categoryId = idOf(stage.category_id)
  const category = stage.category_id && typeof stage.category_id === 'object' ? stage.category_id : null
  const sportId = category ? idOf(category.sport_id) : undefined
  if (!eventId || !categoryId || !sportId) throw new Error('Bracket stage is missing required relationships.')
  const result = await payload.find({ collection: 'matches', depth: 0, limit: 500, sort: 'match_number', where: { stage_id: { equals: stageId } } })
  const matches = result.docs as unknown as Match[]
  const first = matches.filter((match) => (match.round_name || '').toLowerCase().includes('first'))
  if (first.length < 2) return { createdCount: 0 }
  const totalRounds = Math.ceil(Math.log2(first.length)) + 1
  const used = new Set(matches.map((match) => match.match_number)); let previousCount = first.length; let createdCount = 0
  for (let roundIndex = 1; roundIndex < totalRounds; roundIndex += 1) {
    const count = Math.ceil(previousCount / 2)
    for (let slot = 0; slot < count; slot += 1) {
      const key = `bracket-repair:${stageId}:round-${roundIndex}:slot-${slot}`
      const exists = await payload.find({ collection: 'matches', depth: 0, limit: 1, where: { generation_key: { equals: key } } })
      if (exists.docs.length) continue
      let number = `repair-${stageId}-r${roundIndex + 1}-${String(slot + 1).padStart(3, '0')}`; let suffix = 2
      while (used.has(number)) { number = `repair-${stageId}-r${roundIndex + 1}-${String(slot + 1).padStart(3, '0')}-${suffix}`; suffix += 1 }
      used.add(number)
      await payload.create({ collection: 'matches', data: { event_id: eventId, sport_id: sportId, category_id: categoryId, stage_id: Number(stageId), round_name: nameFor(totalRounds - roundIndex - 1), match_number: number, status: 'ready_for_scheduling', generation_source: 'single_elimination', generation_key: key, is_public: true, documentation_status: 'not_started' } })
      createdCount += 1
    }
    previousCount = count
  }
  return { createdCount }
}
