'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { categoryHasStartedMatch, deleteCategoryCascade } from '@/lib/cascadeDelete'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { getWizardEvent, slugify, text, wizardPage } from './wizardShared'

const categoryStatuses = new Set(['draft', 'open', 'locked', 'published', 'archived'])
const participantModes = new Set(['individual', 'pair', 'team', 'club', 'open', 'tbd'])
const thirdPlacePolicies = new Set(['none', 'match', 'shared'])
const formatTypes = new Set([
  'single_elimination',
  'double_elimination',
  'round_robin',
  'group_stage_to_knockout',
  'league',
  'friendly',
  'time_trial',
  'score_ranking',
])

export async function addCategoryAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const sportId = text(formData, 'sportId')
  const name = text(formData, 'name')
  const slug = slugify(text(formData, 'slug') || name)
  const participantMode = text(formData, 'participantMode') || 'open'
  const formatType = text(formData, 'formatType') || 'single_elimination'
  const rulesetId = text(formData, 'rulesetId')
  const minRoster = text(formData, 'minRosterSize')
  const maxRoster = text(formData, 'maxRosterSize')
  const thirdPlacePolicyRaw = text(formData, 'thirdPlacePolicy')
  const thirdPlacePolicy = thirdPlacePolicies.has(thirdPlacePolicyRaw) ? thirdPlacePolicyRaw : 'none'

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  if (
    !name ||
    !slug ||
    !sportId ||
    !participantModes.has(participantMode) ||
    !formatTypes.has(formatType)
  ) {
    redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardError=invalid_category`)
  }

  try {
    const sport = await payload.findByID({ collection: 'sports', id: sportId, depth: 0 })
    if (String(sport.event_id) !== String(eventId)) {
      throw new Error('invalid_relationship')
    }
    if (rulesetId) {
      const ruleset = await payload.findByID({ collection: 'rulesets', id: rulesetId, depth: 0 })
      if (String(ruleset.event_id) !== String(eventId)) {
        throw new Error('invalid_relationship')
      }
    }
  } catch {
    redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardError=invalid_relationship`)
  }

  const duplicate = await payload.find({
    collection: 'competition-categories',
    depth: 0,
    limit: 1,
    where: { and: [{ slug: { equals: slug } }, { event_id: { equals: eventId } }] },
  })
  if (duplicate.docs.length > 0) {
    redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardError=duplicate_slug`)
  }

  const data = {
    event_id: Number(eventId),
    sport_id: Number(sportId),
    name,
    slug,
    participant_mode: participantMode as
      | 'individual'
      | 'pair'
      | 'team'
      | 'club'
      | 'open'
      | 'tbd',
    roster_required: text(formData, 'rosterRequired') === 'on',
    min_roster_size: minRoster ? Number(minRoster) : 0,
    max_roster_size: maxRoster ? Number(maxRoster) : undefined,
    ruleset_id: rulesetId ? Number(rulesetId) : undefined,
    format_type: formatType as
      | 'single_elimination'
      | 'double_elimination'
      | 'round_robin'
      | 'group_stage_to_knockout'
      | 'league'
      | 'friendly'
      | 'time_trial'
      | 'score_ranking',
    third_place_policy: thirdPlacePolicy as 'none' | 'match' | 'shared',
    status: 'draft' as const,
  }
  const created = await payload.create({ collection: 'competition-categories', data })
  await recordAuditLog({
    payload,
    action: 'competition_category.create',
    entityType: 'competition-categories',
    entityId: created.id,
    before: null,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardUpdated=1`)
}

// Categories are created as 'draft' and stay invisible on the public site until this is used to
// move them to 'open'/'locked'/'published' - without it there was no in-app way to publish a
// category once created (the wizard's create form doesn't expose status).
export async function updateCategoryStatusAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  const status = text(formData, 'status')
  if (!categoryId || !categoryStatuses.has(status)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardError=invalid_category_status`)
  }

  const before = await payload.findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
  if (String(before.event_id) !== String(eventId)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardError=invalid_relationship`)
  }

  await payload.update({
    collection: 'competition-categories',
    id: categoryId,
    data: { status: status as 'draft' | 'open' | 'locked' | 'published' | 'archived' },
  })
  await recordAuditLog({
    payload,
    action: 'competition_category.status_update',
    entityType: 'competition-categories',
    entityId: categoryId,
    before: { status: before.status },
    after: { status },
    actorUserId: user.id,
  })

  const event = await getWizardEvent(payload, eventId)
  revalidatePath(wizardPage)
  if (event?.slug) {
    revalidatePath(`/events/${event.slug}/sports`)
  }
  redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardUpdated=1`)
}

// MSG-09: the category list previously only let you change status - a typo in the name or a
// wrong format pick was a dead end, since the only recovery was creating a fresh category and
// abandoning the old one as clutter. Deliberately does not touch `slug` (existing public URLs to
// this category keep working) or `status` (that stays updateCategoryStatusAction's job).
export async function updateCategoryAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  const name = text(formData, 'name')
  const participantMode = text(formData, 'participantMode') || 'open'
  const formatType = text(formData, 'formatType') || 'single_elimination'
  const rulesetId = text(formData, 'rulesetId')
  const minRoster = text(formData, 'minRosterSize')
  const maxRoster = text(formData, 'maxRosterSize')
  const thirdPlacePolicyRaw = text(formData, 'thirdPlacePolicy')
  const thirdPlacePolicy = thirdPlacePolicies.has(thirdPlacePolicyRaw) ? thirdPlacePolicyRaw : 'none'

  if (!categoryId || !name || !participantModes.has(participantMode) || !formatTypes.has(formatType)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardError=invalid_category`)
  }

  const before = await payload.findByID({ collection: 'competition-categories', id: categoryId, depth: 0 }).catch(() => null)
  if (!before || String(before.event_id) !== String(eventId)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardError=invalid_relationship`)
  }
  if (rulesetId) {
    const ruleset = await payload.findByID({ collection: 'rulesets', id: rulesetId, depth: 0 }).catch(() => null)
    if (!ruleset || String(ruleset.event_id) !== String(eventId)) {
      redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardError=invalid_relationship`)
    }
  }

  const data = {
    name,
    participant_mode: participantMode as 'individual' | 'pair' | 'team' | 'club' | 'open' | 'tbd',
    roster_required: text(formData, 'rosterRequired') === 'on',
    min_roster_size: minRoster ? Number(minRoster) : 0,
    max_roster_size: maxRoster ? Number(maxRoster) : undefined,
    ruleset_id: rulesetId ? Number(rulesetId) : undefined,
    format_type: formatType as
      | 'single_elimination'
      | 'double_elimination'
      | 'round_robin'
      | 'group_stage_to_knockout'
      | 'league'
      | 'friendly'
      | 'time_trial'
      | 'score_ranking',
    third_place_policy: thirdPlacePolicy as 'none' | 'match' | 'shared',
  }
  await payload.update({ collection: 'competition-categories', id: categoryId, data })
  await recordAuditLog({
    payload,
    action: 'competition_category.update',
    entityType: 'competition-categories',
    entityId: categoryId,
    before,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardUpdated=1`)
}

// MSG-09: the fastest way to build a non-standard variant ("Futsal U-38 Men") is to copy an
// existing category and rename it, rather than filling the add-category form from scratch.
// Deliberately does not open a dialog first - straight to a renamed draft copy - so making several
// variants in a row (U-16/U-38/Veterans) is several clicks, not several full form fills.
// Entries/stages/matches are never copied - those belong to a specific competition run, not to
// the category's configuration.
export async function duplicateCategoryAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')

  const source = await payload.findByID({ collection: 'competition-categories', id: categoryId, depth: 0 }).catch(() => null)
  if (!source || String(source.event_id) !== String(eventId)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardError=invalid_relationship`)
  }

  const baseName = `${source!.name} (copy)`
  let name = baseName
  let slug = slugify(name)
  let attempt = 1
  // Slugs are unique per event - "(copy)", "(copy) 2", "(copy) 3"... until one doesn't collide,
  // covering the case where a category has already been duplicated once before.
  while (
    (
      await payload.find({
        collection: 'competition-categories',
        depth: 0,
        limit: 1,
        where: { and: [{ slug: { equals: slug } }, { event_id: { equals: eventId } }] },
      })
    ).docs.length > 0
  ) {
    attempt += 1
    name = `${baseName} ${attempt}`
    slug = slugify(name)
  }

  const data = {
    event_id: Number(eventId),
    sport_id: source!.sport_id,
    name,
    slug,
    participant_mode: source!.participant_mode,
    roster_required: source!.roster_required ?? false,
    min_roster_size: source!.min_roster_size ?? 0,
    max_roster_size: source!.max_roster_size ?? undefined,
    ruleset_id: source!.ruleset_id ?? undefined,
    format_type: source!.format_type,
    third_place_policy: source!.third_place_policy ?? 'none',
    status: 'draft' as const,
  }
  const created = await payload.create({ collection: 'competition-categories', data })
  await recordAuditLog({
    payload,
    action: 'competition_category.duplicate',
    entityType: 'competition-categories',
    entityId: created.id,
    before: null,
    after: { ...data, duplicatedFrom: categoryId },
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardUpdated=1`)
}

// MSG-09: deleting a category that already has real competition data (entries, stages, matches)
// would silently destroy match results - deliberately no cascade delete. `archived` status is the
// supported way to retire a category that's already been used; hard delete is reserved for a
// category that was never actually used (e.g. created by mistake, or a leftover before-duplicate
// draft).
export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')

  const category = await payload.findByID({ collection: 'competition-categories', id: categoryId, depth: 0 }).catch(() => null)
  if (!category || String(category.event_id) !== String(eventId)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardError=invalid_relationship`)
  }

  // `cascade=1` (behind an extra confirm in the UI) removes the category and everything under it:
  // entries, stages, groups, matches + sets, rosters, medals, pending registrations, the cached
  // bracket/standings. Still refuses once any match has started - a real result is not bulk-deletable.
  const cascade = text(formData, 'cascade') === '1'

  const [entries, stages, matches] = await Promise.all([
    payload.count({ collection: 'competition-entries', where: { category_id: { equals: categoryId } } }),
    payload.count({ collection: 'stages', where: { category_id: { equals: categoryId } } }),
    payload.count({ collection: 'matches', where: { category_id: { equals: categoryId } } }),
  ])
  const hasData = entries.totalDocs > 0 || stages.totalDocs > 0 || matches.totalDocs > 0

  if (hasData && !cascade) {
    redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardError=category_in_use`)
  }

  if (cascade && (await categoryHasStartedMatch(payload, categoryId))) {
    redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardError=category_has_started_match`)
  }

  await deleteCategoryCascade(payload, categoryId)
  await recordAuditLog({
    payload,
    action: cascade ? 'competition_category.delete_cascade' : 'competition_category.delete',
    entityType: 'competition-categories',
    entityId: categoryId,
    before: { ...category, entryCount: entries.totalDocs, matchCount: matches.totalDocs },
    after: null,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=categories&wizardUpdated=1`)
}
