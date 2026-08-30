'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/event-admin/rulesets'
const scoreTypes = new Set(['points', 'goals', 'sets', 'time', 'result', 'custom'])
const tieBreakerValues = new Set([
  'points',
  'head_to_head',
  'score_difference',
  'score_for',
  'set_difference',
  'set_for',
  'fewest_penalties',
  'manual_decision',
])

const text = (form: FormData, key: string) =>
  typeof form.get(key) === 'string' ? String(form.get(key)).trim() : ''
const numberOrUndefined = (form: FormData, key: string) => {
  const value = text(form, key)
  return value === '' ? undefined : Number(value)
}
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

// MSG-08: the only place outside Payload admin a ruleset's full field set (scheduling duration/
// rest, standings points/tie-breakers, not just the wizard's original 4-field quick form) can be
// edited. Shares RulesetFieldset (src/components/ui/RulesetFieldset.tsx) with the sport catalog
// dialog's ruleset panel (MSG-07) for a single source of truth on layout/labels.
export async function saveRulesetAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: page,
  })
  const event = await getActiveEvent(payload)
  if (!event) {
    redirect(`${page}?rulesetError=invalid_input`)
  }

  const id = text(formData, 'id')
  const sportId = text(formData, 'sportId')
  const name = text(formData, 'name')
  const scoreType = text(formData, 'scoreType') || 'points'
  const tieBreakers = formData
    .getAll('tieBreaker')
    .map((value) => String(value))
    .filter((value) => tieBreakerValues.has(value))

  if (!name || !sportId || !scoreTypes.has(scoreType)) {
    redirect(`${page}?rulesetError=invalid_input`)
  }

  const sport = await payload.findByID({ collection: 'sports', id: sportId, depth: 0 }).catch(() => null)
  if (!sport || String(sport.event_id) !== String(event!.id)) {
    redirect(`${page}?rulesetError=invalid_relationship`)
  }

  const data = {
    event_id: Number(event!.id),
    sport_id: Number(sportId),
    name,
    score_type: scoreType as 'points' | 'goals' | 'sets' | 'time' | 'result' | 'custom',
    set_based: text(formData, 'setBased') === 'on',
    allow_draw: text(formData, 'allowDraw') === 'on',
    deuce_enabled: text(formData, 'deuceEnabled') === 'on',
    best_of: numberOrUndefined(formData, 'bestOf'),
    target_score: numberOrUndefined(formData, 'targetScore'),
    max_score: numberOrUndefined(formData, 'maxScore'),
    default_duration_minutes: numberOrUndefined(formData, 'defaultDurationMinutes'),
    min_rest_minutes: numberOrUndefined(formData, 'minRestMinutes'),
    points_win: numberOrUndefined(formData, 'pointsWin') ?? 3,
    points_draw: numberOrUndefined(formData, 'pointsDraw') ?? 1,
    points_loss: numberOrUndefined(formData, 'pointsLoss') ?? 0,
    tie_breakers: tieBreakers as (
      | 'points'
      | 'head_to_head'
      | 'score_difference'
      | 'score_for'
      | 'set_difference'
      | 'set_for'
      | 'fewest_penalties'
      | 'manual_decision'
    )[],
  }

  if (id) {
    const before = await payload.findByID({ collection: 'rulesets', id, depth: 0 }).catch(() => null)
    if (!before || String(before.event_id) !== String(event!.id)) {
      redirect(`${page}?rulesetError=invalid_relationship`)
    }
    await payload.update({ collection: 'rulesets', id, data })
    await recordAuditLog({
      payload,
      action: 'ruleset.update',
      entityType: 'rulesets',
      entityId: id,
      before,
      after: data,
      actorUserId: user.id,
    })
  } else {
    const slug = slugify(name)
    const duplicate = await payload.find({
      collection: 'rulesets',
      depth: 0,
      limit: 1,
      where: { and: [{ slug: { equals: slug } }, { event_id: { equals: event!.id } }] },
    })
    if (duplicate.docs.length > 0) {
      redirect(`${page}?rulesetError=duplicate_slug`)
    }
    const created = await payload.create({ collection: 'rulesets', data: { ...data, slug } })
    await recordAuditLog({
      payload,
      action: 'ruleset.create',
      entityType: 'rulesets',
      entityId: created.id,
      before: null,
      after: data,
      actorUserId: user.id,
    })
  }

  revalidatePath(page)
  redirect(`${page}?rulesetUpdated=1`)
}

export async function deleteRulesetAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: page,
  })
  const event = await getActiveEvent(payload)
  const id = text(formData, 'id')
  if (!event || !id) {
    redirect(`${page}?rulesetError=invalid_input`)
  }

  const ruleset = await payload.findByID({ collection: 'rulesets', id, depth: 0 }).catch(() => null)
  if (!ruleset || String(ruleset.event_id) !== String(event!.id)) {
    redirect(`${page}?rulesetError=invalid_relationship`)
  }

  const [categories, stages] = await Promise.all([
    payload.count({ collection: 'competition-categories', where: { ruleset_id: { equals: id } } }),
    payload.count({ collection: 'stages', where: { ruleset_id: { equals: id } } }),
  ])
  if (categories.totalDocs > 0 || stages.totalDocs > 0) {
    redirect(`${page}?rulesetError=ruleset_in_use`)
  }

  await payload.delete({ collection: 'rulesets', id })
  await recordAuditLog({
    payload,
    action: 'ruleset.delete',
    entityType: 'rulesets',
    entityId: id,
    before: ruleset,
    after: null,
    actorUserId: user.id,
  })

  revalidatePath(page)
  redirect(`${page}?rulesetUpdated=1`)
}
