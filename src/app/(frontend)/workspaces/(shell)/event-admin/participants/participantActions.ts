'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { recordAuditLog } from '@/lib/audit'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/event-admin/participants'
const text = (form: FormData, key: string) => typeof form.get(key) === 'string' ? String(form.get(key)).trim() : ''
const emailValid = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const roles = new Set(['player', 'captain', 'coach', 'manager', 'substitute'])
const statuses = new Set(['active', 'pending', 'inactive', 'withdrawn'])
const refresh = () => { revalidatePath(page); revalidatePath('/workspaces/event-admin'); revalidatePath('/workspaces/scheduler') }

const activeEvent = async (payload: Awaited<ReturnType<typeof assertWorkspaceActionAccess>>['payload']) => (await payload.find({ collection: 'events', depth: 0, limit: 1, sort: 'event_start_at' })).docs[0] as { id: string | number } | undefined
const belongsToEvent = async (payload: Awaited<ReturnType<typeof assertWorkspaceActionAccess>>['payload'], collection: 'clubs' | 'players' | 'teams' | 'competition-categories', id: string, eventId: string | number) => {
  if (!id) return
  const doc = await payload.findByID({ collection, id, depth: 0 }) as { event_id?: string | number }
  if (String(doc.event_id) !== String(eventId)) throw new Error('invalid_relationship')
}

export async function savePlayerAction(form: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.eventAdmin, returnTo: page }); const event = await activeEvent(payload)
  const id = text(form, 'id'); const name = text(form, 'name'); const clubId = text(form, 'clubId'); const email = text(form, 'email'); const gender = text(form, 'gender')
  if (!event || !name || !emailValid(email) || (gender && !['male', 'female', 'other', 'prefer_not_to_say'].includes(gender))) redirect(`${page}?participantError=invalid_player`)
  try { await belongsToEvent(payload, 'clubs', clubId, event.id) } catch { redirect(`${page}?participantError=invalid_relationship`) }
  const data = { event_id: event.id, name, club_id: clubId || undefined, employee_id: text(form, 'employeeId') || undefined, email: email || undefined, phone: text(form, 'phone') || undefined, photo: text(form, 'photo') || undefined, bio: text(form, 'bio') || undefined, gender: gender || undefined }
  if (id) { const before = await payload.findByID({ collection: 'players', id, depth: 0 }); await payload.update({ collection: 'players', id, data }); await recordAuditLog({ payload, action: 'player.update', entityType: 'players', entityId: id, before, after: data, actorUserId: user.id }) } else { const created = await payload.create({ collection: 'players', data }); await recordAuditLog({ payload, action: 'player.create', entityType: 'players', entityId: created.id, before: null, after: data, actorUserId: user.id }) }
  refresh(); redirect(`${page}?playerUpdated=1`)
}

export async function saveTeamAction(form: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.eventAdmin, returnTo: page }); const event = await activeEvent(payload)
  const id = text(form, 'id'); const name = text(form, 'name'); const slug = (text(form, 'slug') || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); const clubId = text(form, 'clubId'); const captainId = text(form, 'captainId'); const email = text(form, 'email')
  if (!event || !name || !slug || !emailValid(email)) redirect(`${page}?participantError=invalid_team`)
  try { await Promise.all([belongsToEvent(payload, 'clubs', clubId, event.id), belongsToEvent(payload, 'players', captainId, event.id)]) } catch { redirect(`${page}?participantError=invalid_relationship`) }
  const duplicate = await payload.find({ collection: 'teams', depth: 0, limit: 10, where: { slug: { equals: slug } } }); if (duplicate.docs.some((team) => String(team.id) !== id)) redirect(`${page}?participantError=duplicate_slug`)
  const data = { event_id: event.id, name, slug, club_id: clubId || undefined, captain_player_id: captainId || undefined, contact_email: email || undefined, logo: text(form, 'logo') || undefined, description: text(form, 'description') || undefined }
  if (id) { const before = await payload.findByID({ collection: 'teams', id, depth: 0 }); await payload.update({ collection: 'teams', id, data }); await recordAuditLog({ payload, action: 'team.update', entityType: 'teams', entityId: id, before, after: data, actorUserId: user.id }) } else { const created = await payload.create({ collection: 'teams', data }); await recordAuditLog({ payload, action: 'team.create', entityType: 'teams', entityId: created.id, before: null, after: data, actorUserId: user.id }) }
  refresh(); redirect(`${page}?teamUpdated=1`)
}

export async function saveRosterAction(form: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: WORKSPACE_ROLES.eventAdmin, returnTo: page }); const event = await activeEvent(payload)
  const id = text(form, 'id'); const teamId = text(form, 'teamId'); const playerId = text(form, 'playerId'); const categoryId = text(form, 'categoryId'); const role = text(form, 'role'); const status = text(form, 'status')
  if (!event || !teamId || !playerId || !roles.has(role) || !statuses.has(status)) redirect(`${page}?participantError=invalid_roster`)
  try { await Promise.all([belongsToEvent(payload, 'teams', teamId, event.id), belongsToEvent(payload, 'players', playerId, event.id), belongsToEvent(payload, 'competition-categories', categoryId, event.id)]) } catch { redirect(`${page}?participantError=invalid_relationship`) }
  const same = await payload.find({ collection: 'rosters', depth: 0, limit: 10, where: { and: [{ team_id: { equals: teamId } }, { player_id: { equals: playerId } }, { category_id: { equals: categoryId || null } }] } }); if (same.docs.some((item) => String(item.id) !== id)) redirect(`${page}?participantError=duplicate_roster`)
  const data = { event_id: event.id, team_id: teamId, player_id: playerId, category_id: categoryId || undefined, role, status }
  if (id) { const before = await payload.findByID({ collection: 'rosters', id, depth: 0 }); await payload.update({ collection: 'rosters', id, data }); await recordAuditLog({ payload, action: 'roster.update', entityType: 'rosters', entityId: id, before, after: data, actorUserId: user.id }) } else { const created = await payload.create({ collection: 'rosters', data }); await recordAuditLog({ payload, action: 'roster.create', entityType: 'rosters', entityId: created.id, before: null, after: data, actorUserId: user.id }) }
  refresh(); redirect(`${page}?rosterUpdated=1`)
}
