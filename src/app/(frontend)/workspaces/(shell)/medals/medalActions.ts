'use server'

import { redirect } from 'next/navigation'

import { recalculateMedalsForCategory, resolveEntryClubIds } from '@/lib/medals'
import { getActiveEvent } from '../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../workspaceAuth'

const text = (form: FormData, key: string) =>
  typeof form.get(key) === 'string' ? String(form.get(key)).trim() : ''

// Recalculates every medal_eligible category in the active event - the workspace-triggered
// equivalent of `npm run medals:recalculate`, for an admin who just turned medal_tally_enabled on
// and wants existing results backfilled without touching a terminal.
export async function recalculateAllMedalsAction(): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.medals,
    returnTo: '/workspaces/medals',
  })

  const activeEvent = await getActiveEvent(payload)
  if (!activeEvent) {
    redirect('/workspaces/medals?medalError=no_active_event')
  }

  const categories = await payload.find({
    collection: 'competition-categories',
    depth: 0,
    limit: 500,
    where: { and: [{ event_id: { equals: activeEvent!.id } }, { medal_eligible: { equals: true } }] },
  })

  let totalWritten = 0
  for (const category of categories.docs) {
    const result = await recalculateMedalsForCategory(payload, category.id)
    totalWritten += result.written
  }

  redirect(`/workspaces/medals?medalRecalculated=1&written=${totalWritten}`)
}

// MSG-02: an admin decision that overrides whatever recalculation would otherwise produce for this
// (category, medal) slot - e.g. a post-result disqualification, or a category format recalculation
// doesn't support yet (double elimination). Creating a manual row for a slot that already has a
// non-manual row replaces it, mirroring how recalculation itself upserts by (category, medal).
export async function setManualMedalAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.medals,
    returnTo: '/workspaces/medals',
  })

  const categoryId = text(formData, 'categoryId')
  const entryId = text(formData, 'entryId')
  const medal = text(formData, 'medal')
  const note = text(formData, 'note')

  if (!categoryId || !entryId || !['gold', 'silver', 'bronze'].includes(medal)) {
    redirect('/workspaces/medals?medalError=invalid_override')
  }

  const [category, entry] = await Promise.all([
    payload.findByID({ collection: 'competition-categories', id: categoryId, depth: 0 }).catch(() => null),
    payload.findByID({ collection: 'competition-entries', id: entryId, depth: 0 }).catch(() => null),
  ])
  if (!category || !entry || String(entry.category_id) !== String(categoryId)) {
    redirect('/workspaces/medals?medalError=invalid_override')
  }

  const clubIdByEntryId = await resolveEntryClubIds(payload, [entryId])

  const existingResult = await payload.find({
    collection: 'medal-records',
    depth: 0,
    limit: 5,
    where: { and: [{ category_id: { equals: categoryId } }, { medal: { equals: medal } }] },
  })

  const data = {
    event_id: Number(category!.event_id),
    category_id: Number(categoryId),
    entry_id: Number(entryId),
    club_id: clubIdByEntryId.has(entryId) ? Number(clubIdByEntryId.get(entryId)) : undefined,
    medal: medal as 'gold' | 'silver' | 'bronze',
    source: 'manual' as const,
    is_manual: true,
    note: note || undefined,
  }

  const existingForSlot = existingResult.docs[0]
  if (existingForSlot) {
    await payload.update({ collection: 'medal-records', id: existingForSlot.id, data })
  } else {
    await payload.create({ collection: 'medal-records', data })
  }

  redirect('/workspaces/medals?medalOverrideSet=1')
}

export async function clearMedalOverrideAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.medals,
    returnTo: '/workspaces/medals',
  })

  const recordId = text(formData, 'recordId')
  const categoryId = text(formData, 'categoryId')
  if (!recordId) {
    redirect('/workspaces/medals?medalError=invalid_override')
  }

  await payload.delete({ collection: 'medal-records', id: recordId })
  // The deleted row was a manual override - recalculating puts the derived result (if any) back
  // in its place instead of leaving that medal slot empty.
  if (categoryId) {
    await recalculateMedalsForCategory(payload, categoryId)
  }

  redirect('/workspaces/medals?medalOverrideCleared=1')
}
