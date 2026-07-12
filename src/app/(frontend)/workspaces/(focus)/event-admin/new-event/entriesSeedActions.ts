'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { getWizardEvent, text, wizardPage } from './wizardShared'

const sourceCollectionByMode = (mode: string): 'teams' | 'clubs' | 'players' =>
  mode === 'team' ? 'teams'
  : mode === 'club' ? 'clubs'
  : 'players'

const entryTypeByMode = (mode: string) =>
  mode === 'team' ? 'team'
  : mode === 'club' ? 'club'
  : mode === 'pair' ? 'pair'
  : mode === 'individual' ? 'individual'
  : 'open'

export async function addEntryAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  const sourceId = text(formData, 'sourceId')

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  if (!categoryId || !sourceId) {
    redirect(`${wizardPage}?eventId=${eventId}&step=entries&wizardError=invalid_entry`)
  }

  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  if (!category || String(category.event_id) !== String(eventId)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=entries&wizardError=invalid_relationship`)
  }

  const mode = String(category!.participant_mode || 'open')
  const collection = sourceCollectionByMode(mode)
  const entryType = entryTypeByMode(mode)

  const source = await payload.findByID({ collection, id: sourceId, depth: 0 }).catch(() => null)
  if (!source || String(source.event_id) !== String(eventId)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=entries&wizardError=invalid_relationship`)
  }

  const existing = await payload.find({
    collection: 'competition-entries',
    depth: 0,
    limit: 500,
    where: { category_id: { equals: categoryId } },
  })
  const alreadyEntered = existing.docs.some((entry) => {
    const linkedId =
      collection === 'teams' ? entry.team_id
      : collection === 'clubs' ? entry.club_id
      : entry.player_id
    return String(linkedId) === String(sourceId)
  })
  if (alreadyEntered) {
    redirect(`${wizardPage}?eventId=${eventId}&step=entries&wizardError=duplicate_entry`)
  }

  const nextSeed =
    existing.docs.reduce((max, entry) => Math.max(max, Number(entry.seed_number) || 0), 0) + 1

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

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=entries&categoryId=${categoryId}&wizardUpdated=1`)
}

export async function shuffleSeedsAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  if (!categoryId) {
    redirect(`${wizardPage}?eventId=${eventId}&step=entries&wizardError=invalid_entry`)
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
  redirect(`${wizardPage}?eventId=${eventId}&step=entries&categoryId=${categoryId}&wizardShuffled=1`)
}

export async function saveSeedOrderAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  if (!categoryId) {
    redirect(`${wizardPage}?eventId=${eventId}&step=entries&wizardError=invalid_entry`)
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

  await Promise.all(
    updates.map(({ id, seed }) =>
      payload.update({ collection: 'competition-entries', id, data: { seed_number: seed } }),
    ),
  )

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=entries&categoryId=${categoryId}&wizardUpdated=1`)
}
