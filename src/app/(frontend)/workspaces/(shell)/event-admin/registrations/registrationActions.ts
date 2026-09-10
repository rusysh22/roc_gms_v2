'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Payload } from 'payload'

import { canAccessEvent, getRelationId } from '@/access/eventMembership'
import { recordAuditLog } from '@/lib/audit'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'

const basePage = '/workspaces/event-admin/registrations'

// AUDIT_TOURNAMENT_STANDARDS SEC-01: a submission is loaded by its own id from the form and
// WORKSPACE_ROLES.registrationDesk is a global role check - without this an event_admin /
// registration staffer of Event A could approve or reject Event B's pending submissions (approval
// creates real Club/Team/Player/Entry rows in that event). Membership in the submission's event is
// required.
const assertSubmissionEventAccess = async (
  payload: Payload,
  user: { id: string | number; roles?: readonly string[] | null },
  submissionEventId: unknown,
) => {
  const eventId = getRelationId(submissionEventId)
  if (eventId && !(await canAccessEvent(payload, user, eventId))) {
    redirect(`${basePage}?registrationError=not_pending`)
  }
}

const text = (form: FormData, key: string) =>
  typeof form.get(key) === 'string' ? String(form.get(key)).trim() : ''

// Mirrors wizardShared.ts's slugify - duplicated rather than imported across an unrelated
// workspace area for a 6-line pure function.
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

const uniqueSlug = async (payload: Payload, collection: 'clubs' | 'teams', eventId: number, base: string) => {
  let slug = base || 'entry'
  for (let suffix = 2; suffix <= 50; suffix += 1) {
    const existing = await payload.count({
      collection,
      where: { and: [{ slug: { equals: slug } }, { event_id: { equals: eventId } }] },
    })
    if (existing.totalDocs === 0) return slug
    slug = `${base}-${suffix}`.slice(0, 80)
  }
  return `${base}-${Date.now()}`.slice(0, 80)
}

// Reuses an existing Club by case-insensitive name within the event, or creates one - the public
// form only collects a free-text club name (a visitor can't reliably pick from internal Club
// records), so this is where that text gets reconciled against real data.
const findOrCreateClub = async (
  payload: Payload,
  eventId: number,
  name: string,
): Promise<number | undefined> => {
  if (!name) return undefined
  const existing = await payload.find({
    collection: 'clubs',
    depth: 0,
    limit: 1,
    where: { and: [{ event_id: { equals: eventId } }, { name: { equals: name } }] },
  })
  if (existing.docs[0]) {
    return Number(existing.docs[0].id)
  }
  const slug = await uniqueSlug(payload, 'clubs', eventId, slugify(name))
  const created = await payload.create({ collection: 'clubs', data: { event_id: eventId, name, slug } })
  return Number(created.id)
}

type RosterRow = { name: string; email?: string | null; phone?: string | null }

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md P2 item 2: approving a submission is what actually creates the
// real Club/Team/Player/CompetitionEntry records - see events/[eventSlug]/register/
// registrationActions.ts's submitRegistrationAction for how the pending row got here in the first
// place. Scope decision: no fuzzy name-matching against existing Players (a submission always
// creates fresh Player rows) - staff can merge obvious duplicates later via the existing
// Participants workspace, same as bulk CSV import already leaves for club/team name collisions.
export async function approveRegistrationSubmissionAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.registrationDesk,
    returnTo: basePage,
  })

  const submissionId = text(formData, 'submissionId')
  const reviewNotes = text(formData, 'reviewNotes')
  if (!submissionId) {
    redirect(`${basePage}?registrationError=invalid_request`)
  }

  const submission = await payload.findByID({ collection: 'registration-submissions', id: submissionId, depth: 0 }).catch(() => null)
  if (!submission || submission.status !== 'pending') {
    redirect(`${basePage}?registrationError=not_pending`)
  }
  await assertSubmissionEventAccess(payload, user, submission!.event_id)

  const eventId = Number(submission!.event_id)
  const categoryId = Number(submission!.category_id)
  const mode = String(submission!.participant_mode)
  const roster = (submission!.roster || []) as RosterRow[]

  // REG-02: don't approve a second entry for someone already registered in this category. Match on
  // the contact email an approved submission recorded, or the exact display name.
  const email = String(submission!.contact_email || '').trim().toLowerCase()
  const priorApproved = await payload.find({
    collection: 'registration-submissions',
    depth: 0,
    limit: 1,
    where: {
      and: [
        { category_id: { equals: categoryId } },
        { status: { equals: 'approved' } },
        { id: { not_equals: submissionId } },
        email
          ? { or: [{ contact_email: { equals: email } }, { display_name: { equals: submission!.display_name } }] }
          : { display_name: { equals: submission!.display_name } },
      ],
    },
  })
  if (priorApproved.totalDocs > 0) {
    redirect(`${basePage}?registrationError=duplicate_registration`)
  }

  const clubId = await findOrCreateClub(
    payload,
    eventId,
    mode === 'club' ? String(submission!.display_name) : String(submission!.club_name || ''),
  )

  const createdPlayerIds: number[] = []
  const createPlayer = async (row: RosterRow) => {
    const created = await payload.create({
      collection: 'players',
      data: {
        event_id: eventId,
        club_id: clubId,
        name: row.name,
        email: row.email || undefined,
        phone: row.phone || undefined,
      },
    })
    await recordAuditLog({
      payload,
      action: 'player.create',
      entityType: 'players',
      entityId: created.id,
      before: null,
      after: { event_id: eventId, name: row.name },
      actorUserId: user.id,
    })
    createdPlayerIds.push(Number(created.id))
    return Number(created.id)
  }

  let teamId: number | undefined
  let entryPlayerId: number | undefined

  if (mode === 'individual') {
    if (roster[0]) {
      entryPlayerId = await createPlayer(roster[0])
    }
  } else if (mode === 'pair' || mode === 'team') {
    const slug = await uniqueSlug(payload, 'teams', eventId, slugify(String(submission!.display_name)))
    const team = await payload.create({
      collection: 'teams',
      data: { event_id: eventId, club_id: clubId, name: String(submission!.display_name), slug },
    })
    teamId = Number(team.id)
    await recordAuditLog({
      payload,
      action: 'team.create',
      entityType: 'teams',
      entityId: team.id,
      before: null,
      after: { event_id: eventId, name: submission!.display_name },
      actorUserId: user.id,
    })

    for (const row of roster) {
      const playerId = await createPlayer(row)
      const roster_ = await payload.create({
        collection: 'rosters',
        data: { event_id: eventId, team_id: teamId, player_id: playerId, role: 'player', status: 'active' },
      })
      await recordAuditLog({
        payload,
        action: 'roster.create',
        entityType: 'rosters',
        entityId: roster_.id,
        before: null,
        after: { team_id: teamId, player_id: playerId },
        actorUserId: user.id,
      })
    }
  }

  const entryType = mode === 'pair' ? 'pair' : mode === 'team' ? 'team' : mode === 'club' ? 'club' : 'individual'
  const existingEntries = await payload.find({
    collection: 'competition-entries',
    depth: 0,
    limit: 2000,
    where: { category_id: { equals: categoryId } },
  })
  const nextSeed = existingEntries.docs.reduce((max, entry) => Math.max(max, Number(entry.seed_number) || 0), 0) + 1

  // REG-01: once a category hits its max_entries of confirmed entries, further approvals land on
  // the waitlist instead of silently overfilling the draw. promoteWaitlistedEntryAction moves them
  // up when a confirmed entry withdraws.
  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  const maxEntries = category?.max_entries ?? 0
  const confirmedCount = existingEntries.docs.filter((e) => e.status === 'confirmed').length
  const entryStatus: 'confirmed' | 'waitlisted' =
    maxEntries > 0 && confirmedCount >= maxEntries ? 'waitlisted' : 'confirmed'

  const entryData = {
    event_id: eventId,
    category_id: categoryId,
    display_name: String(submission!.display_name),
    entry_type: entryType as 'individual' | 'pair' | 'team' | 'club',
    status: entryStatus,
    seed_number: nextSeed,
    player_id: mode === 'individual' ? entryPlayerId : undefined,
    team_id: teamId,
    club_id: mode === 'club' ? clubId : undefined,
  }
  const entry = await payload.create({ collection: 'competition-entries', data: entryData })
  await recordAuditLog({
    payload,
    action: 'competition_entry.create',
    entityType: 'competition-entries',
    entityId: entry.id,
    before: null,
    after: entryData,
    actorUserId: user.id,
  })

  const submissionUpdate = {
    status: 'approved' as const,
    review_notes: reviewNotes || undefined,
    reviewed_by: Number(user.id),
    reviewed_at: new Date().toISOString(),
    created_club_id: clubId,
    created_team_id: teamId,
    created_player_ids: createdPlayerIds.length > 0 ? createdPlayerIds : undefined,
    created_entry_id: Number(entry.id),
  }
  await payload.update({ collection: 'registration-submissions', id: submissionId, data: submissionUpdate })
  await recordAuditLog({
    payload,
    action: 'registration_submission.approve',
    entityType: 'registration-submissions',
    entityId: submissionId,
    before: { status: 'pending' },
    after: submissionUpdate,
    actorUserId: user.id,
  })

  revalidatePath(basePage)
  redirect(`${basePage}?registrationUpdated=${entryStatus === 'waitlisted' ? 'waitlisted' : 'approved'}`)
}

// REG-01: move a waitlisted entry up to confirmed - after a confirmed entry withdraws, or after an
// admin raises max_entries. Refuses if the category is still full.
export async function promoteWaitlistedEntryAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.registrationDesk,
    returnTo: basePage,
  })

  const entryId = text(formData, 'entryId')
  if (!entryId) {
    redirect(`${basePage}?registrationError=invalid_request`)
  }

  const entry = await payload
    .findByID({ collection: 'competition-entries', id: entryId, depth: 0 })
    .catch(() => null)
  if (!entry || entry.status !== 'waitlisted') {
    redirect(`${basePage}?registrationError=not_waitlisted`)
  }
  await assertSubmissionEventAccess(payload, user, entry!.event_id)

  const categoryId = Number(entry!.category_id)
  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  const maxEntries = category?.max_entries ?? 0
  if (maxEntries > 0) {
    const confirmed = await payload.count({
      collection: 'competition-entries',
      where: { and: [{ category_id: { equals: categoryId } }, { status: { equals: 'confirmed' } }] },
    })
    if (confirmed.totalDocs >= maxEntries) {
      redirect(`${basePage}?registrationError=category_full`)
    }
  }

  await payload.update({ collection: 'competition-entries', id: entryId, data: { status: 'confirmed' } })
  await recordAuditLog({
    payload,
    action: 'competition_entry.promote_from_waitlist',
    entityType: 'competition-entries',
    entityId: entryId,
    before: { status: 'waitlisted' },
    after: { status: 'confirmed' },
    actorUserId: user.id,
  })

  revalidatePath(basePage)
  redirect(`${basePage}?registrationUpdated=promoted`)
}

export async function rejectRegistrationSubmissionAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.registrationDesk,
    returnTo: basePage,
  })

  const submissionId = text(formData, 'submissionId')
  const reviewNotes = text(formData, 'reviewNotes')
  if (!submissionId || !reviewNotes) {
    redirect(`${basePage}?registrationError=reason_required`)
  }

  const submission = await payload.findByID({ collection: 'registration-submissions', id: submissionId, depth: 0 }).catch(() => null)
  if (!submission || submission.status !== 'pending') {
    redirect(`${basePage}?registrationError=not_pending`)
  }
  await assertSubmissionEventAccess(payload, user, submission!.event_id)

  const data = {
    status: 'rejected' as const,
    review_notes: reviewNotes,
    reviewed_by: Number(user.id),
    reviewed_at: new Date().toISOString(),
  }
  await payload.update({ collection: 'registration-submissions', id: submissionId, data })
  await recordAuditLog({
    payload,
    action: 'registration_submission.reject',
    entityType: 'registration-submissions',
    entityId: submissionId,
    before: { status: 'pending' },
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(basePage)
  redirect(`${basePage}?registrationUpdated=rejected`)
}
