'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/event-admin/categories'
const text = (data: FormData, key: string) =>
  typeof data.get(key) === 'string' ? String(data.get(key)).trim() : ''
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
const num = (value: string) => {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const PARTICIPANT_MODES = new Set(['individual', 'pair', 'team', 'club', 'open', 'tbd'])
const FORMAT_TYPES = new Set([
  'single_elimination',
  'double_elimination',
  'round_robin',
  'group_stage_to_knockout',
  'league',
  'friendly',
  'time_trial',
  'score_ranking',
])
const STATUSES = new Set(['draft', 'open', 'locked', 'published', 'archived'])
const THIRD_PLACE = new Set(['none', 'match', 'shared'])

export async function saveCategoryAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: page,
  })
  const event = await getActiveEvent(payload)
  const id = text(formData, 'id')
  const name = text(formData, 'name')
  const sportId = text(formData, 'sportId')
  const rulesetId = text(formData, 'rulesetId')
  const participantMode = text(formData, 'participantMode') || 'open'
  const formatType = text(formData, 'formatType') || 'single_elimination'
  const status = text(formData, 'status') || 'draft'
  const thirdPlace = text(formData, 'thirdPlacePolicy') || 'none'
  const slug = slugify(text(formData, 'slug') || name)

  if (
    !event ||
    !name ||
    !slug ||
    !sportId ||
    !PARTICIPANT_MODES.has(participantMode) ||
    !FORMAT_TYPES.has(formatType) ||
    !STATUSES.has(status) ||
    !THIRD_PLACE.has(thirdPlace)
  ) {
    redirect(`${page}?categoryError=invalid_input`)
  }

  // Both FKs must belong to the active event.
  const [sport, ruleset] = await Promise.all([
    payload.findByID({ collection: 'sports', id: sportId, depth: 0 }).catch(() => null),
    rulesetId ? payload.findByID({ collection: 'rulesets', id: rulesetId, depth: 0 }).catch(() => null) : null,
  ])
  if (!sport || String((sport as { event_id?: string | number }).event_id) !== String(event.id)) {
    redirect(`${page}?categoryError=invalid_relationship`)
  }
  if (rulesetId && (!ruleset || String((ruleset as { event_id?: string | number }).event_id) !== String(event.id))) {
    redirect(`${page}?categoryError=invalid_relationship`)
  }

  // Slug is unique per (event, sport).
  const duplicate = await payload.find({
    collection: 'competition-categories',
    depth: 0,
    limit: 10,
    where: {
      and: [{ slug: { equals: slug } }, { event_id: { equals: event.id } }, { sport_id: { equals: sportId } }],
    },
  })
  if (duplicate.docs.some((doc) => String(doc.id) !== id)) {
    redirect(`${page}?categoryError=duplicate_slug`)
  }

  const data = {
    event_id: Number(event.id),
    sport_id: Number(sportId),
    name,
    slug,
    ruleset_id: rulesetId ? Number(rulesetId) : null,
    participant_mode: participantMode as 'individual' | 'pair' | 'team' | 'club' | 'open' | 'tbd',
    format_type: formatType as
      | 'single_elimination'
      | 'double_elimination'
      | 'round_robin'
      | 'group_stage_to_knockout'
      | 'league'
      | 'friendly'
      | 'time_trial'
      | 'score_ranking',
    status: status as 'draft' | 'open' | 'locked' | 'published' | 'archived',
    roster_required: formData.get('rosterRequired') != null,
    min_roster_size: num(text(formData, 'minRosterSize')) ?? 0,
    max_roster_size: num(text(formData, 'maxRosterSize')),
    group_qualify_count: num(text(formData, 'groupQualifyCount')),
    third_place_policy: thirdPlace as 'none' | 'match' | 'shared',
    result_unit: text(formData, 'resultUnit') || undefined,
    medal_eligible: formData.get('medalEligible') != null,
    medal_weight: num(text(formData, 'medalWeight')) ?? 1,
  }

  if (id) {
    const before = await payload.findByID({ collection: 'competition-categories', id, depth: 0 })
    await payload.update({ collection: 'competition-categories', id, data })
    await recordAuditLog({ payload, action: 'competition_category.update', entityType: 'competition-categories', entityId: id, before, after: data, actorUserId: user.id })
  } else {
    const created = await payload.create({ collection: 'competition-categories', data })
    await recordAuditLog({ payload, action: 'competition_category.create', entityType: 'competition-categories', entityId: created.id, before: null, after: data, actorUserId: user.id })
  }
  revalidatePath(page)
  revalidatePath('/workspaces/event-admin')
  redirect(`${page}?categoryUpdated=1`)
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: page,
  })
  const event = await getActiveEvent(payload)
  const id = text(formData, 'id')
  if (!event || !id) redirect(`${page}?categoryError=invalid_input`)

  const category = await payload.findByID({ collection: 'competition-categories', id, depth: 0 }).catch(() => null)
  if (!category || String(category.event_id) !== String(event.id)) {
    redirect(`${page}?categoryError=invalid_relationship`)
  }

  const [entries, stages, rosters, matches] = await Promise.all([
    payload.count({ collection: 'competition-entries', where: { category_id: { equals: id } } }),
    payload.count({ collection: 'stages', where: { category_id: { equals: id } } }),
    payload.count({ collection: 'rosters', where: { category_id: { equals: id } } }),
    payload.count({ collection: 'matches', where: { category_id: { equals: id } } }),
  ])
  if (entries.totalDocs + stages.totalDocs + rosters.totalDocs + matches.totalDocs > 0) {
    redirect(`${page}?categoryError=category_in_use`)
  }

  await payload.delete({ collection: 'competition-categories', id })
  await recordAuditLog({ payload, action: 'competition_category.delete', entityType: 'competition-categories', entityId: id, before: category, after: null, actorUserId: user.id })
  revalidatePath(page)
  revalidatePath('/workspaces/event-admin')
  redirect(`${page}?categoryUpdated=1`)
}
