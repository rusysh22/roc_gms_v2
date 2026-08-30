'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { recalculateResultCachesBestEffort } from '../../../matches/matchActions'
import { getWizardEvent, text, wizardPage } from './wizardShared'

const UNSTARTED_MATCH_STATUSES = new Set([
  'draft',
  'ready_for_scheduling',
  'scheduled',
  'published',
  'check_in_open',
  'ready_to_start',
])
const relId = (value: unknown): string | number | null => {
  if (value == null) return null
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return (value as { id: string | number }).id
  }
  return value as string | number
}

// "pair" entries are backed by Teams (not bare Players) because Rosters always require a
// team_id - a doubles pair is modeled as a 2-player team.
const sourceCollectionByMode = (mode: string): 'teams' | 'clubs' | 'players' =>
  mode === 'team' || mode === 'pair' ? 'teams'
  : mode === 'club' ? 'clubs'
  : 'players'

const entryTypeByMode = (mode: string): 'team' | 'club' | 'pair' | 'individual' | 'open' =>
  mode === 'team' ? 'team'
  : mode === 'club' ? 'club'
  : mode === 'pair' ? 'pair'
  : mode === 'individual' ? 'individual'
  : 'open'

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 6: registering entries one row-click at a time doesn't
// scale to a 80-player roster - accepts one or many source ids in a single submit (the checkbox
// list in EntriesStep always posts through this, whether one box is checked or fifty).
export async function addEntriesAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  const sourceIds = formData.getAll('sourceIds').map(String).filter(Boolean)

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  if (!categoryId || sourceIds.length === 0) {
    redirect(
      `${wizardPage}?eventId=${eventId}&step=registration&categoryId=${categoryId}&wizardError=invalid_entry`,
    )
  }

  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  if (!category || String(category.event_id) !== String(eventId)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=registration&wizardError=invalid_relationship`)
  }

  const mode = String(category!.participant_mode || 'open')
  const collection = sourceCollectionByMode(mode)
  const entryType = entryTypeByMode(mode)

  const existing = await payload.find({
    collection: 'competition-entries',
    depth: 0,
    limit: 500,
    where: { category_id: { equals: categoryId } },
  })
  const linkedIdOf = (entry: (typeof existing.docs)[number]) =>
    String(collection === 'teams' ? entry.team_id : collection === 'clubs' ? entry.club_id : entry.player_id)
  const enteredSourceIds = new Set(existing.docs.map(linkedIdOf))
  // A previously withdrawn entry for the same source is reactivated rather than skipped - "add"
  // then "withdraw" then "add again" now round-trips (previously the second add did nothing).
  const withdrawnBySource = new Map<string, (typeof existing.docs)[number]>()
  for (const entry of existing.docs) {
    if (entry.status === 'withdrawn') withdrawnBySource.set(linkedIdOf(entry), entry)
  }
  let nextSeed =
    existing.docs.reduce((max, entry) => Math.max(max, Number(entry.seed_number) || 0), 0) + 1

  let addedCount = 0
  for (const sourceId of sourceIds) {
    const withdrawn = withdrawnBySource.get(sourceId)
    if (withdrawn) {
      await payload.update({ collection: 'competition-entries', id: withdrawn.id, data: { status: 'confirmed' } })
      await recordAuditLog({
        payload,
        action: 'competition_entry.reinstate',
        entityType: 'competition-entries',
        entityId: withdrawn.id,
        before: withdrawn,
        after: { ...withdrawn, status: 'confirmed' },
        actorUserId: user.id,
      })
      addedCount += 1
      continue
    }
    // Silently skip already-entered/invalid sources instead of failing the whole batch - the
    // checklist can't fully prevent a stale checkbox (another admin adding the same person in a
    // race, or a duplicate row before the page refreshed) from being submitted alongside valid ones.
    if (enteredSourceIds.has(sourceId)) {
      continue
    }
    const source = await payload.findByID({ collection, id: sourceId, depth: 0 }).catch(() => null)
    if (!source || String(source.event_id) !== String(eventId)) {
      continue
    }

    const data = {
      event_id: Number(eventId),
      category_id: Number(categoryId),
      display_name: String(source.name),
      entry_type: entryType,
      status: 'confirmed' as const,
      seed_number: nextSeed,
      player_id: collection === 'players' ? Number(sourceId) : undefined,
      team_id: collection === 'teams' ? Number(sourceId) : undefined,
      club_id: collection === 'clubs' ? Number(sourceId) : undefined,
    }
    const created = await payload.create({ collection: 'competition-entries', data })
    await recordAuditLog({
      payload,
      action: 'competition_entry.create',
      entityType: 'competition-entries',
      entityId: created.id,
      before: null,
      after: data,
      actorUserId: user.id,
    })
    enteredSourceIds.add(sourceId)
    nextSeed += 1
    addedCount += 1
  }

  revalidatePath(wizardPage)
  const suffix = addedCount === 0 ? '&wizardError=duplicate_entry' : `&wizardUpdated=1&wizardBulkAdded=${addedCount}`
  redirect(`${wizardPage}?eventId=${eventId}&step=registration&categoryId=${categoryId}${suffix}`)
}

// Registration normally works one category at a time (see addEntriesAction) - fine for a single
// sport, but tedious for an admin setting up an event with several team/club-mode sports at once
// (e.g. "Club A's Team A1 plays Futsal, Club B plays Chess as a club entry"). This lets one submit
// check cells across a club x category / team x category matrix and creates every entry in one go.
// Scoped to team/pair/club modes only - individual-mode categories can have dozens of players and
// would make the matrix unusably wide, so those still go through the single-category flow above.
export async function addBulkCategoryAssignmentsAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }

  // Each checked cell posts as "<sourceCollection>:<sourceId>:<categoryId>" - the collection is
  // carried alongside the id because a bare id is ambiguous between the teams and clubs collections.
  const raw = formData.getAll('assignments').map(String).filter(Boolean)
  const parsed = raw
    .map((value) => {
      const [collection, sourceId, categoryId] = value.split(':')
      return collection && sourceId && categoryId ? { collection, sourceId, categoryId } : null
    })
    .filter((v): v is { collection: string; sourceId: string; categoryId: string } => v !== null)

  if (parsed.length === 0) {
    redirect(`${wizardPage}?eventId=${eventId}&step=registration&wizardError=invalid_entry`)
  }

  const categoryIds = [...new Set(parsed.map((p) => p.categoryId))]
  const categories = await payload.find({
    collection: 'competition-categories',
    depth: 0,
    limit: 200,
    where: { and: [{ event_id: { equals: eventId } }, { id: { in: categoryIds } }] },
  })
  const categoryById = new Map(categories.docs.map((c) => [String(c.id), c]))

  const existing = await payload.find({
    collection: 'competition-entries',
    depth: 0,
    limit: 5000,
    where: { category_id: { in: categoryIds } },
  })
  const enteredKeys = new Set(
    existing.docs.map((entry) => {
      const collection =
        entry.team_id !== null && entry.team_id !== undefined ? 'teams'
        : entry.club_id !== null && entry.club_id !== undefined ? 'clubs'
        : 'players'
      const linkedId = collection === 'teams' ? entry.team_id : collection === 'clubs' ? entry.club_id : entry.player_id
      return `${collection}:${linkedId}:${entry.category_id}`
    }),
  )
  const nextSeedByCategory = new Map<string, number>()
  for (const entry of existing.docs) {
    const catKey = String(entry.category_id)
    nextSeedByCategory.set(
      catKey,
      Math.max(nextSeedByCategory.get(catKey) || 0, Number(entry.seed_number) || 0) + 1,
    )
  }

  let addedCount = 0
  for (const { collection, sourceId, categoryId } of parsed) {
    const category = categoryById.get(categoryId)
    if (!category) continue
    const mode = String(category.participant_mode || 'open')
    // Reject a cell whose collection doesn't match its column's category mode - guards against a
    // tampered/stale form post, not something the matrix UI itself can produce.
    if (sourceCollectionByMode(mode) !== collection || (collection !== 'teams' && collection !== 'clubs')) {
      continue
    }
    const key = `${collection}:${sourceId}:${categoryId}`
    if (enteredKeys.has(key)) continue

    const source = await payload.findByID({ collection, id: sourceId, depth: 0 }).catch(() => null)
    if (!source || String(source.event_id) !== String(eventId)) continue

    const seed = nextSeedByCategory.get(categoryId) || 1
    const data = {
      event_id: Number(eventId),
      category_id: Number(categoryId),
      display_name: String(source.name),
      entry_type: entryTypeByMode(mode),
      status: 'confirmed' as const,
      seed_number: seed,
      team_id: collection === 'teams' ? Number(sourceId) : undefined,
      club_id: collection === 'clubs' ? Number(sourceId) : undefined,
    }
    const created = await payload.create({ collection: 'competition-entries', data })
    await recordAuditLog({
      payload,
      action: 'competition_entry.create',
      entityType: 'competition-entries',
      entityId: created.id,
      before: null,
      after: data,
      actorUserId: user.id,
    })
    enteredKeys.add(key)
    nextSeedByCategory.set(categoryId, seed + 1)
    addedCount += 1
  }

  revalidatePath(wizardPage)
  const suffix = addedCount === 0 ? '&wizardError=duplicate_entry' : `&wizardUpdated=1&wizardBulkAdded=${addedCount}`
  redirect(`${wizardPage}?eventId=${eventId}&step=registration${suffix}`)
}

export async function shuffleSeedsAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  if (!categoryId) {
    redirect(`${wizardPage}?eventId=${eventId}&step=draw&wizardError=invalid_entry`)
  }

  const entries = await payload.find({
    collection: 'competition-entries',
    depth: 0,
    limit: 500,
    where: {
      and: [
        { category_id: { equals: categoryId } },
        { status: { equals: 'confirmed' } },
      ],
    },
  })

  const shuffled = [...entries.docs]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  await Promise.all(
    shuffled.map((entry, index) =>
      payload.update({
        collection: 'competition-entries',
        id: entry.id,
        data: { seed_number: index + 1 },
      }),
    ),
  )

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=draw&categoryId=${categoryId}&wizardShuffled=1`)
}

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 7: there was no way to fix a mis-entered participant short
// of deleting it directly through Advanced Data Administration - a soft withdraw (not a hard
// delete) keeps the audit trail and lets the same participant be re-added later without losing
// history. Withdrawn entries drop out of EntriesStep's "current entries" list (and therefore out of
// `enteredSourceIds`), so the participant becomes available to add again immediately.
//
// `entryId` is a *bound* argument (`withdrawEntryAction.bind(null, String(entry.id))`), not a form
// field - Next.js's server-action wiring already claims the submit button's own `name` attribute to
// encode which action to invoke, so a same-named form field on that button is silently dropped.
// Binding is the supported way to carry a per-row id into a shared action.
export async function withdrawEntryAction(entryId: string, formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  if (!entryId) {
    redirect(`${wizardPage}?eventId=${eventId}&step=registration&categoryId=${categoryId}&wizardError=invalid_entry`)
  }

  const before = await payload.findByID({ collection: 'competition-entries', id: entryId, depth: 0 }).catch(() => null)
  if (!before || String(before.event_id) !== String(eventId)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=registration&categoryId=${categoryId}&wizardError=invalid_relationship`)
  }

  const data = { status: 'withdrawn' as const }
  await payload.update({ collection: 'competition-entries', id: entryId, data })
  await recordAuditLog({
    payload,
    action: 'competition_entry.withdraw',
    entityType: 'competition-entries',
    entityId: entryId,
    before,
    after: { ...before, ...data },
    actorUserId: user.id,
  })

  // A withdrawal before an already-generated match is played hands that match to the opponent as a
  // walkover (the standard bracket behaviour). Only fully-populated, not-yet-started matches - one
  // with a still-TBD opponent, or one already in progress, is left for the officer.
  const pendingMatches = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 200,
    where: {
      and: [
        { or: [{ participant_a_entry_id: { equals: entryId } }, { participant_b_entry_id: { equals: entryId } }] },
        { status: { in: [...UNSTARTED_MATCH_STATUSES] } },
      ],
    },
  })
  let walkoverCount = 0
  for (const match of pendingMatches.docs) {
    const aId = relId(match.participant_a_entry_id)
    const bId = relId(match.participant_b_entry_id)
    const opponentId = String(aId) === String(entryId) ? bId : aId
    if (!opponentId) continue

    const updated = { status: 'walkover' as const, winner_entry_id: Number(opponentId), actual_end_at: new Date().toISOString() }
    await payload.update({ collection: 'matches', id: match.id, data: updated, user })
    await recordAuditLog({
      payload,
      action: 'match.walkover_on_withdrawal',
      entityType: 'matches',
      entityId: match.id,
      before: { status: match.status },
      after: updated,
      actorUserId: user.id,
    })
    await recalculateResultCachesBestEffort({
      payload,
      match: { ...(match as unknown as Record<string, unknown>), ...updated } as Parameters<
        typeof recalculateResultCachesBestEffort
      >[0]['match'],
      matchNumber: String(match.match_number),
      action: 'match.walkover_on_withdrawal',
      actorUserId: user.id,
    })
    walkoverCount += 1
  }

  revalidatePath(wizardPage)
  const suffix = walkoverCount > 0 ? `&wizardWalkovers=${walkoverCount}` : '&wizardUpdated=1'
  redirect(`${wizardPage}?eventId=${eventId}&step=registration&categoryId=${categoryId}${suffix}`)
}

// The reverse of withdrawEntryAction: put a withdrawn entry back to `confirmed`. Its seed number is
// kept; if a bracket was already generated the entry re-appears where it was. Any walkovers the
// withdrawal handed to opponents stay - use "Undo Walkover" on those matches (Match Details) to
// reverse them, one at a time, while the opponent hasn't progressed.
export async function reinstateEntryAction(entryId: string, formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  const back = `${wizardPage}?eventId=${eventId}&step=registration&categoryId=${categoryId}`
  if (!entryId) {
    redirect(`${back}&wizardError=invalid_entry`)
  }

  const before = await payload.findByID({ collection: 'competition-entries', id: entryId, depth: 0 }).catch(() => null)
  if (!before || String(before.event_id) !== String(eventId)) {
    redirect(`${back}&wizardError=invalid_relationship`)
  }
  if (before.status !== 'withdrawn') {
    redirect(`${back}&wizardError=entry_not_withdrawn`)
  }

  const data = { status: 'confirmed' as const }
  await payload.update({ collection: 'competition-entries', id: entryId, data })
  await recordAuditLog({
    payload,
    action: 'competition_entry.reinstate',
    entityType: 'competition-entries',
    entityId: entryId,
    before,
    after: { ...before, ...data },
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(`${back}&wizardUpdated=1`)
}

export async function saveSeedOrderAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  if (!categoryId) {
    redirect(`${wizardPage}?eventId=${eventId}&step=draw&wizardError=invalid_entry`)
  }

  const updates: Array<{ id: string; seed: number }> = []
  for (const [key, value] of formData.entries()) {
    const match = /^seed_(.+)$/.exec(key)
    if (!match || typeof value !== 'string') {
      continue
    }
    const seed = Number(value)
    if (Number.isInteger(seed) && seed >= 1) {
      updates.push({ id: match[1], seed })
    }
  }

  // Safety net behind SeedOrderTable's client-side duplicate check (item 4, option B) - a form
  // submitted with JS disabled, or a stale tab, could still post duplicate seed numbers.
  const seenSeeds = new Set<number>()
  for (const update of updates) {
    if (seenSeeds.has(update.seed)) {
      redirect(`${wizardPage}?eventId=${eventId}&step=draw&categoryId=${categoryId}&wizardError=duplicate_seed`)
    }
    seenSeeds.add(update.seed)
  }

  await Promise.all(
    updates.map(({ id, seed }) =>
      payload.update({ collection: 'competition-entries', id, data: { seed_number: seed } }),
    ),
  )

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=draw&categoryId=${categoryId}&wizardUpdated=1`)
}
