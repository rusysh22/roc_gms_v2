'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { getWizardEvent, slugify, text, wizardPage } from './wizardShared'

const categoryStatuses = new Set(['draft', 'open', 'locked', 'published', 'archived'])
const participantModes = new Set(['individual', 'pair', 'team', 'club', 'open', 'tbd'])
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
    participant_mode: participantMode,
    roster_required: text(formData, 'rosterRequired') === 'on',
    min_roster_size: minRoster ? Number(minRoster) : 0,
    max_roster_size: maxRoster ? Number(maxRoster) : undefined,
    ruleset_id: rulesetId ? Number(rulesetId) : undefined,
    format_type: formatType,
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

  await payload.update({ collection: 'competition-categories', id: categoryId, data: { status } })
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
