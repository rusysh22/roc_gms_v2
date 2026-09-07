'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { slugify } from '@/lib/slugify'
import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/event-admin/sports'
const text = (data: FormData, key: string) =>
  typeof data.get(key) === 'string' ? String(data.get(key)).trim() : ''
const SPORT_TYPES = new Set(['court', 'field', 'table', 'board', 'esport', 'track', 'other'])

export async function saveSportAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: page,
  })
  const event = await getActiveEvent(payload)
  const id = text(formData, 'id')
  const name = text(formData, 'name')
  const requestedSlug = text(formData, 'slug')
  const sportType = text(formData, 'sportType') || 'court'
  const rulesetId = text(formData, 'defaultRulesetId')
  const slug = slugify(requestedSlug || name)
  if (!event || !name || !slug || !SPORT_TYPES.has(sportType)) redirect(`${page}?sportError=invalid_input`)

  const duplicate = await payload.find({
    collection: 'sports',
    depth: 0,
    limit: 10,
    where: { and: [{ slug: { equals: slug } }, { event_id: { equals: event.id } }] },
  })
  if (duplicate.docs.some((sport) => String(sport.id) !== id)) redirect(`${page}?sportError=duplicate_slug`)

  if (rulesetId) {
    const ruleset = (await payload
      .findByID({ collection: 'rulesets', id: rulesetId, depth: 0 })
      .catch(() => null)) as { event_id?: string | number } | null
    if (!ruleset || String(ruleset.event_id) !== String(event.id)) {
      redirect(`${page}?sportError=invalid_relationship`)
    }
  }

  const data = {
    event_id: Number(event.id),
    name,
    slug,
    sport_type: sportType as 'court' | 'field' | 'table' | 'board' | 'esport' | 'track' | 'other',
    description: text(formData, 'description') || undefined,
    icon: text(formData, 'icon') || undefined,
    default_ruleset_id: rulesetId ? Number(rulesetId) : null,
    is_active: formData.get('isActive') != null,
  }

  if (id) {
    const before = await payload.findByID({ collection: 'sports', id, depth: 0 })
    await payload.update({ collection: 'sports', id, data })
    await recordAuditLog({ payload, action: 'sport.update', entityType: 'sports', entityId: id, before, after: data, actorUserId: user.id })
  } else {
    const created = await payload.create({ collection: 'sports', data })
    await recordAuditLog({ payload, action: 'sport.create', entityType: 'sports', entityId: created.id, before: null, after: data, actorUserId: user.id })
  }
  revalidatePath(page)
  revalidatePath('/workspaces/event-admin')
  redirect(`${page}?sportUpdated=1`)
}

export async function deleteSportAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: page,
  })
  const event = await getActiveEvent(payload)
  const id = text(formData, 'id')
  if (!event || !id) redirect(`${page}?sportError=invalid_input`)

  const sport = await payload.findByID({ collection: 'sports', id, depth: 0 }).catch(() => null)
  if (!sport || String(sport.event_id) !== String(event.id)) redirect(`${page}?sportError=invalid_relationship`)

  const [categories, rulesets, courts] = await Promise.all([
    payload.count({ collection: 'competition-categories', where: { sport_id: { equals: id } } }),
    payload.count({ collection: 'rulesets', where: { sport_id: { equals: id } } }),
    payload.count({ collection: 'courts', where: { sport_id: { equals: id } } }),
  ])
  if (categories.totalDocs + rulesets.totalDocs + courts.totalDocs > 0) {
    redirect(`${page}?sportError=sport_in_use`)
  }

  await payload.delete({ collection: 'sports', id })
  await recordAuditLog({ payload, action: 'sport.delete', entityType: 'sports', entityId: id, before: sport, after: null, actorUserId: user.id })
  revalidatePath(page)
  revalidatePath('/workspaces/event-admin')
  redirect(`${page}?sportUpdated=1`)
}
