'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'

import { recordAuditLog } from '@/lib/audit'
import { getActiveEvent } from '../../../activeEvent'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const page = '/workspaces/event-admin/clubs'
const text = (data: FormData, key: string) =>
  typeof data.get(key) === 'string' ? String(data.get(key)).trim() : ''
const DIACRITICS_PATTERN = new RegExp(String.fromCharCode(0x5b, 0x5c, 0x75, 0x30, 0x33, 0x30, 0x30, 0x2d, 0x5c, 0x75, 0x30, 0x33, 0x36, 0x66, 0x5d), 'g')
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(DIACRITICS_PATTERN, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
const normalizeName = (value: string) => value.trim().toLowerCase()

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md P2 item 3: "copy participants from a previous event with
// duplicate reconciliation" - an organizer running the same tournament again shouldn't have to
// retype every club/team/player. Reconciliation is name-based (case-insensitive): anything
// already present in the target event by that name is reused rather than duplicated. Two
// deliberate simplifications, both documented rather than silently swallowed:
// - Team `captain_player_id` isn't carried over (it would need players copied first, which
//   creates a circular club->team->player->team dependency for no real payoff - an organizer can
//   re-set the captain in a few seconds after the copy).
// - Player `employee_id` is dropped, not copied - it's a *globally* unique field (not scoped per
//   event like slugs are), so copying it verbatim across events would collide constantly.
export async function copyParticipantsFromEventAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: page,
  })
  const targetEvent = await getActiveEvent(payload)
  const sourceEventId = text(formData, 'sourceEventId')

  if (!targetEvent || !sourceEventId || String(sourceEventId) === String(targetEvent.id)) {
    redirect(`${page}?copyError=invalid_input`)
  }

  const summary = await copyParticipants(payload, sourceEventId, String(targetEvent.id))

  await recordAuditLog({
    payload,
    action: 'participants.copy_from_event',
    entityType: 'events',
    entityId: targetEvent.id,
    before: null,
    after: { sourceEventId, ...summary },
    actorUserId: user.id,
  })

  revalidatePath(page)
  revalidatePath('/workspaces/event-admin/participants')
  redirect(
    `${page}?copySummary=${summary.clubsCreated}-${summary.teamsCreated}-${summary.playersCreated}`,
  )
}

async function copyParticipants(payload: Payload, sourceEventId: string, targetEventId: string) {
  const [sourceClubs, targetClubs] = await Promise.all([
    payload.find({ collection: 'clubs', depth: 0, limit: 500, where: { event_id: { equals: sourceEventId } } }),
    payload.find({ collection: 'clubs', depth: 0, limit: 500, where: { event_id: { equals: targetEventId } } }),
  ])
  const targetClubByName = new Map(targetClubs.docs.map((club) => [normalizeName(String(club.name)), club]))
  const clubIdMap = new Map<string, string>()
  let clubsCreated = 0

  for (const club of sourceClubs.docs) {
    const key = normalizeName(String(club.name))
    const existing = targetClubByName.get(key)
    if (existing) {
      clubIdMap.set(String(club.id), String(existing.id))
      continue
    }
    const created = await payload.create({
      collection: 'clubs',
      data: {
        event_id: Number(targetEventId),
        name: String(club.name),
        slug: slugify(String(club.name)),
        description: club.description || undefined,
        contact_person: club.contact_person || undefined,
        contact_email: club.contact_email || undefined,
      },
    })
    clubIdMap.set(String(club.id), String(created.id))
    targetClubByName.set(key, created)
    clubsCreated += 1
  }

  const [sourceTeams, targetTeams] = await Promise.all([
    payload.find({ collection: 'teams', depth: 0, limit: 1000, where: { event_id: { equals: sourceEventId } } }),
    payload.find({ collection: 'teams', depth: 0, limit: 1000, where: { event_id: { equals: targetEventId } } }),
  ])
  const targetTeamNames = new Set(targetTeams.docs.map((team) => normalizeName(String(team.name))))
  let teamsCreated = 0

  for (const team of sourceTeams.docs) {
    const key = normalizeName(String(team.name))
    if (targetTeamNames.has(key)) continue
    const sourceClubId = team.club_id ? String(team.club_id) : ''
    await payload.create({
      collection: 'teams',
      data: {
        event_id: Number(targetEventId),
        club_id: sourceClubId && clubIdMap.has(sourceClubId) ? Number(clubIdMap.get(sourceClubId)) : undefined,
        name: String(team.name),
        slug: slugify(String(team.name)),
        description: team.description || undefined,
        contact_email: team.contact_email || undefined,
      },
    })
    targetTeamNames.add(key)
    teamsCreated += 1
  }

  const [sourcePlayers, targetPlayers] = await Promise.all([
    payload.find({ collection: 'players', depth: 0, limit: 2000, where: { event_id: { equals: sourceEventId } } }),
    payload.find({ collection: 'players', depth: 0, limit: 2000, where: { event_id: { equals: targetEventId } } }),
  ])
  const targetPlayerNames = new Set(targetPlayers.docs.map((player) => normalizeName(String(player.name))))
  let playersCreated = 0

  for (const player of sourcePlayers.docs) {
    const key = normalizeName(String(player.name))
    if (targetPlayerNames.has(key)) continue
    const sourceClubId = player.club_id ? String(player.club_id) : ''
    await payload.create({
      collection: 'players',
      data: {
        event_id: Number(targetEventId),
        club_id: sourceClubId && clubIdMap.has(sourceClubId) ? Number(clubIdMap.get(sourceClubId)) : undefined,
        name: String(player.name),
        email: player.email || undefined,
        phone: player.phone || undefined,
        gender: player.gender || undefined,
        bio: player.bio || undefined,
      },
    })
    targetPlayerNames.add(key)
    playersCreated += 1
  }

  return { clubsCreated, teamsCreated, playersCreated }
}
