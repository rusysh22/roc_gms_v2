'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { recordAuditLog } from '@/lib/audit'
import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/event-admin/entries'
const text = (formData: FormData, key: string) => typeof formData.get(key) === 'string' ? String(formData.get(key)).trim() : ''
const validTypes = new Set(['individual', 'pair', 'team', 'club', 'open', 'tbd'])
const validStatuses = new Set(['pending', 'confirmed', 'waitlisted', 'withdrawn', 'disqualified'])

export async function saveCompetitionEntryAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.eventAdmin, returnTo: page })
  const event = await getActiveEvent(payload)
  const id = text(formData, 'id'); const displayName = text(formData, 'displayName'); const categoryId = text(formData, 'categoryId'); const entryType = text(formData, 'entryType'); const status = text(formData, 'status'); const sourceId = text(formData, 'sourceId')
  if (!event || !displayName || !categoryId || !validTypes.has(entryType) || !validStatuses.has(status)) redirect(`${page}?entryError=invalid_input`)
  try {
    const category = await payload.findByID({ collection: 'competition-categories', id: categoryId, depth: 0 }) as { event_id?: string | number }
    if (String(category.event_id) !== String(event.id)) throw new Error('category')
    if (sourceId && ['individual', 'team', 'club'].includes(entryType)) {
      const collection = entryType === 'individual' ? 'players' : entryType === 'team' ? 'teams' : 'clubs'
      const source = await payload.findByID({ collection, id: sourceId, depth: 0 }) as { event_id?: string | number }
      if (String(source.event_id) !== String(event.id)) throw new Error('source')
    }
  } catch { redirect(`${page}?entryError=invalid_relationship`) }
  const seed = text(formData, 'seedNumber'); const seedNumber = seed ? Number(seed) : undefined
  if (seedNumber !== undefined && (!Number.isInteger(seedNumber) || seedNumber < 1)) redirect(`${page}?entryError=invalid_input`)
  const data = { event_id: event.id, category_id: categoryId, display_name: displayName, entry_type: entryType, status, seed_number: seedNumber, player_id: entryType === 'individual' ? sourceId || undefined : undefined, team_id: entryType === 'team' ? sourceId || undefined : undefined, club_id: entryType === 'club' ? sourceId || undefined : undefined }
  if (id) { const before = await payload.findByID({ collection: 'competition-entries', id, depth: 0 }); await payload.update({ collection: 'competition-entries', id, data }); await recordAuditLog({ payload, action: 'competition_entry.update', entityType: 'competition-entries', entityId: id, before, after: data, actorUserId: user.id }) }
  else { const created = await payload.create({ collection: 'competition-entries', data }); await recordAuditLog({ payload, action: 'competition_entry.create', entityType: 'competition-entries', entityId: created.id, before: null, after: data, actorUserId: user.id }) }
  revalidatePath(page); revalidatePath('/workspaces/event-admin'); revalidatePath('/workspaces/scheduler'); redirect(`${page}?entryUpdated=1`)
}
