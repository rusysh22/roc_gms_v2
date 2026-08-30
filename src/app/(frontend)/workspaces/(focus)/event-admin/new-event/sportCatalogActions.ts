'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { getCatalogSport } from '@/lib/sportCatalog'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { getWizardEvent, slugify, text, wizardPage } from './wizardShared'

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
const participantModes = new Set(['individual', 'pair', 'team', 'club', 'open'])

const MAX_ISSUES_IN_URL = 25
const encodeIssues = (issues: { name: string; reason: string }[]) => ({
  issuesParam: issues.length > 0 ? encodeURIComponent(JSON.stringify(issues.slice(0, MAX_ISSUES_IN_URL))) : '',
  moreIssues: issues.length > MAX_ISSUES_IN_URL ? issues.length - MAX_ISSUES_IN_URL : 0,
})

// MSG-07: turns "pick a catalog sport, tick its events" into one Sport + one Ruleset (both
// find-or-create, so adding the same catalog sport twice - e.g. more events later - never
// duplicates either) + one CompetitionCategory per ticked event, all in one submit. Everything it
// creates lands in the same sports/rulesets/competition-categories collections the manual
// "Add a sport"/"Add a category" forms use - there's no separate catalog-backed data path, so
// anything created this way is editable/deletable exactly like anything created manually.
export async function addSportFromCatalogAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const sportKey = text(formData, 'sportKey')
  const formatType = text(formData, 'formatType') || 'single_elimination'
  const customEventName = text(formData, 'customEventName')
  const customParticipantModeRaw = text(formData, 'customParticipantMode')
  const customParticipantMode = participantModes.has(customParticipantModeRaw)
    ? customParticipantModeRaw
    : 'open'

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }

  const catalogSport = getCatalogSport(sportKey)
  if (!catalogSport || !formatTypes.has(formatType)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=sports&wizardError=invalid_catalog_sport`)
  }

  const selectedEventNames = new Set(formData.getAll('eventName').map((value) => String(value)))
  const eventsToCreate = catalogSport!.events.filter((catalogEvent) => selectedEventNames.has(catalogEvent.name))
  if (customEventName) {
    eventsToCreate.push({ name: customEventName, participantMode: customParticipantMode as never })
  }
  if (eventsToCreate.length === 0) {
    redirect(`${wizardPage}?eventId=${eventId}&step=sports&wizardError=empty_catalog_selection`)
  }

  // Find-or-create the Sport.
  let sportId: number
  let sportCreated = false
  const existingSport = await payload.find({
    collection: 'sports',
    depth: 0,
    limit: 1,
    where: { and: [{ slug: { equals: catalogSport!.key } }, { event_id: { equals: eventId } }] },
  })
  if (existingSport.docs[0]) {
    sportId = Number(existingSport.docs[0].id)
  } else {
    const sportData = {
      event_id: Number(eventId),
      name: catalogSport!.name,
      slug: catalogSport!.key,
      sport_type: catalogSport!.sportType,
      is_active: true,
    }
    const createdSport = await payload.create({ collection: 'sports', data: sportData })
    sportId = Number(createdSport.id)
    sportCreated = true
    await recordAuditLog({
      payload,
      action: 'sport.create',
      entityType: 'sports',
      entityId: createdSport.id,
      before: null,
      after: sportData,
      actorUserId: user.id,
    })
  }

  // Find-or-create the catalog Ruleset for this sport.
  const rulesetSlug = `${catalogSport!.key}-standard`
  let rulesetId: number
  const existingRuleset = await payload.find({
    collection: 'rulesets',
    depth: 0,
    limit: 1,
    where: { and: [{ slug: { equals: rulesetSlug } }, { event_id: { equals: eventId } }] },
  })
  if (existingRuleset.docs[0]) {
    rulesetId = Number(existingRuleset.docs[0].id)
  } else {
    const preset = catalogSport!.ruleset
    const rulesetData = {
      event_id: Number(eventId),
      sport_id: sportId,
      name: preset.name,
      slug: rulesetSlug,
      score_type: preset.scoreType,
      set_based: preset.setBased,
      allow_draw: preset.allowDraw ?? false,
      best_of: preset.bestOf,
      target_score: preset.targetScore,
      max_score: preset.maxScore,
      deuce_enabled: preset.deuceEnabled ?? false,
      period_count: preset.periodCount,
      period_duration: preset.periodDuration,
      default_duration_minutes: preset.defaultDurationMinutes,
      min_rest_minutes: preset.minRestMinutes,
      points_win: preset.pointsWin,
      points_draw: preset.pointsDraw,
      points_loss: preset.pointsLoss,
      tie_breakers: preset.tieBreakers,
    }
    const createdRuleset = await payload.create({ collection: 'rulesets', data: rulesetData })
    rulesetId = Number(createdRuleset.id)
    await recordAuditLog({
      payload,
      action: 'ruleset.create',
      entityType: 'rulesets',
      entityId: createdRuleset.id,
      before: null,
      after: rulesetData,
      actorUserId: user.id,
    })
  }

  // Create one CompetitionCategory per selected catalog event - naming collisions (e.g. the sport
  // was already added manually with an overlapping category name) are reported and skipped, not
  // fatal to the rest of the batch.
  let created = 0
  const issues: { name: string; reason: string }[] = []
  for (const catalogEvent of eventsToCreate) {
    const slug = slugify(catalogEvent.name)
    if (!slug) {
      issues.push({ name: catalogEvent.name, reason: 'Could not derive a URL slug' })
      continue
    }
    // Scoped to this sport - a same-named category under a *different* sport in the event is not a
    // collision (see CompetitionCategories.ts index).
    const duplicate = await payload.find({
      collection: 'competition-categories',
      depth: 0,
      limit: 1,
      where: {
        and: [
          { slug: { equals: slug } },
          { event_id: { equals: eventId } },
          { sport_id: { equals: sportId } },
        ],
      },
    })
    if (duplicate.docs.length > 0) {
      issues.push({ name: catalogEvent.name, reason: 'This sport already has a category with this name' })
      continue
    }
    const categoryData = {
      event_id: Number(eventId),
      sport_id: sportId,
      name: catalogEvent.name,
      slug,
      participant_mode: catalogEvent.participantMode,
      roster_required: catalogEvent.rosterRequired ?? false,
      min_roster_size: catalogEvent.minRosterSize ?? 0,
      max_roster_size: catalogEvent.maxRosterSize,
      ruleset_id: rulesetId,
      format_type: formatType as
        | 'single_elimination'
        | 'double_elimination'
        | 'round_robin'
        | 'group_stage_to_knockout'
        | 'league'
        | 'friendly'
        | 'time_trial'
        | 'score_ranking',
      third_place_policy: 'none' as const,
      status: 'draft' as const,
    }
    const createdCategory = await payload.create({ collection: 'competition-categories', data: categoryData })
    created += 1
    await recordAuditLog({
      payload,
      action: 'competition_category.create',
      entityType: 'competition-categories',
      entityId: createdCategory.id,
      before: null,
      after: categoryData,
      actorUserId: user.id,
    })
  }

  await recordAuditLog({
    payload,
    action: 'sport_catalog.add_batch',
    entityType: 'sports',
    entityId: sportId,
    before: null,
    after: { sportKey: catalogSport!.key, sportCreated, categoriesCreated: created, issues },
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  const { issuesParam, moreIssues } = encodeIssues(issues)
  redirect(
    `${wizardPage}?eventId=${eventId}&step=sports&wizardCatalogAdded=${created}` +
      (issuesParam ? `&wizardCatalogIssues=${issuesParam}` : '') +
      (moreIssues ? `&wizardCatalogMoreIssues=${moreIssues}` : ''),
  )
}
