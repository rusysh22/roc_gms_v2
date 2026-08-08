'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { getWizardEvent, slugify, text, wizardPage } from './wizardShared'

const sportTypes = new Set(['court', 'field', 'table', 'board', 'esport', 'track', 'other'])
const scoreTypes = new Set(['points', 'goals', 'sets', 'time', 'result', 'custom'])

export async function addSportAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const name = text(formData, 'name')
  const sportType = text(formData, 'sportType') || 'court'
  const slug = slugify(text(formData, 'slug') || name)

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  if (!name || !slug || !sportTypes.has(sportType)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=sports&wizardError=invalid_sport`)
  }

  const duplicate = await payload.find({
    collection: 'sports',
    depth: 0,
    limit: 1,
    where: { and: [{ slug: { equals: slug } }, { event_id: { equals: eventId } }] },
  })
  if (duplicate.docs.length > 0) {
    redirect(`${wizardPage}?eventId=${eventId}&step=sports&wizardError=duplicate_slug`)
  }

  const data = {
    event_id: Number(eventId),
    name,
    slug,
    sport_type: sportType as
      | 'court'
      | 'field'
      | 'table'
      | 'board'
      | 'esport'
      | 'track'
      | 'other',
    is_active: true,
  }
  const created = await payload.create({ collection: 'sports', data })
  await recordAuditLog({
    payload,
    action: 'sport.create',
    entityType: 'sports',
    entityId: created.id,
    before: null,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=sports&wizardUpdated=1`)
}

// Mirrors deleteCategoryAction's guard (categoryActions.ts) - no cascade delete of anything with
// real competition data. Courts and matches are checked directly (both denormalize sport_id);
// categories are checked too since a sport backing a category should be retired via that
// category, not out from under it. Rulesets have no delete UI of their own and no value without
// their sport, so they're removed along with it rather than left permanently orphaned.
export async function deleteSportAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const sportId = text(formData, 'sportId')

  const sport = await payload.findByID({ collection: 'sports', id: sportId, depth: 0 }).catch(() => null)
  if (!sport || String(sport.event_id) !== String(eventId)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=sports&wizardError=invalid_relationship`)
  }

  const [categories, courts, matches] = await Promise.all([
    payload.count({ collection: 'competition-categories', where: { sport_id: { equals: sportId } } }),
    payload.count({ collection: 'courts', where: { sport_id: { equals: sportId } } }),
    payload.count({ collection: 'matches', where: { sport_id: { equals: sportId } } }),
  ])
  if (categories.totalDocs > 0 || courts.totalDocs > 0 || matches.totalDocs > 0) {
    redirect(`${wizardPage}?eventId=${eventId}&step=sports&wizardError=sport_in_use`)
  }

  const rulesets = await payload.find({ collection: 'rulesets', depth: 0, limit: 200, where: { sport_id: { equals: sportId } } })
  for (const ruleset of rulesets.docs) {
    await payload.delete({ collection: 'rulesets', id: ruleset.id })
  }

  await payload.delete({ collection: 'sports', id: sportId })
  await recordAuditLog({
    payload,
    action: 'sport.delete',
    entityType: 'sports',
    entityId: sportId,
    before: sport,
    after: null,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=sports&wizardUpdated=1`)
}

export async function addRulesetAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const sportId = text(formData, 'sportId')
  const name = text(formData, 'name')
  const slug = slugify(text(formData, 'slug') || name)
  const scoreType = text(formData, 'scoreType') || 'points'
  const bestOf = text(formData, 'bestOf')

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  if (!name || !slug || !sportId || !scoreTypes.has(scoreType)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=sports&wizardError=invalid_ruleset`)
  }

  const sport = await payload
    .findByID({ collection: 'sports', id: sportId, depth: 0 })
    .catch(() => null)
  if (!sport || String(sport.event_id) !== String(eventId)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=sports&wizardError=invalid_relationship`)
  }

  const duplicate = await payload.find({
    collection: 'rulesets',
    depth: 0,
    limit: 1,
    where: { and: [{ slug: { equals: slug } }, { event_id: { equals: eventId } }] },
  })
  if (duplicate.docs.length > 0) {
    redirect(`${wizardPage}?eventId=${eventId}&step=sports&wizardError=duplicate_slug`)
  }

  const data = {
    event_id: Number(eventId),
    sport_id: Number(sportId),
    name,
    slug,
    score_type: scoreType as 'custom' | 'time' | 'result' | 'points' | 'goals' | 'sets',
    set_based: text(formData, 'setBased') === 'on',
    allow_draw: text(formData, 'allowDraw') === 'on',
    best_of: bestOf ? Number(bestOf) : undefined,
  }
  const created = await payload.create({ collection: 'rulesets', data })
  await recordAuditLog({
    payload,
    action: 'ruleset.create',
    entityType: 'rulesets',
    entityId: created.id,
    before: null,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=sports&wizardUpdated=1`)
}
