'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import { assertWorkspaceActionAccess, WORKSPACE_ROLES } from '../workspaces/workspaceAuth'

const text = (form: FormData, key: string) => typeof form.get(key) === 'string' ? String(form.get(key)).trim() : ''
const parseScore = (value: string) => value === '' ? null : Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null
const refresh = (matchNumber: string) => { revalidatePath('/brackets'); revalidatePath(`/matches/${matchNumber}`); revalidatePath('/workspaces/brackets') }

export async function updateBracketMatchAction(form: FormData): Promise<void> {
  const intent = text(form, 'intent'); const matchId = text(form, 'matchId'); const matchNumber = text(form, 'matchNumber')
  if (!matchId || !matchNumber || !['score', 'schedule'].includes(intent)) redirect('/brackets')
  const { payload, user } = await assertWorkspaceActionAccess({ allowedRoles: [...new Set([...WORKSPACE_ROLES.scheduler, ...WORKSPACE_ROLES.matchOfficer])], returnTo: '/workspaces' })
  const roles = user.roles || []; const canScore = roles.some((role) => ['super_admin', 'event_admin', 'match_officer'].includes(role)); const canSchedule = roles.some((role) => ['super_admin', 'event_admin', 'scheduler'].includes(role))
  const match = await payload.findByID({ collection: 'matches', id: matchId, depth: 0 }).catch(() => null) as { id: string | number; match_number: string; status: string; stage_id?: string | number | null; participant_a_entry_id?: string | number | null; participant_b_entry_id?: string | number | null; scheduled_start_at?: string | null; scheduled_end_at?: string | null } | null
  if (!match || match.match_number !== matchNumber) redirect('/brackets')
  if (intent === 'schedule') {
    if (!canSchedule) redirect(`/brackets?matchError=unauthorized`)
    const start = text(form, 'scheduledStart'); const end = text(form, 'scheduledEnd'); const startDate = new Date(start); const endDate = new Date(end)
    if (!start || !end || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) redirect(`/brackets?matchError=invalid_schedule`)
    const before = { scheduled_start_at: match.scheduled_start_at || null, scheduled_end_at: match.scheduled_end_at || null }
    await payload.update({ collection: 'matches', id: match.id, data: { scheduled_start_at: startDate.toISOString(), scheduled_end_at: endDate.toISOString(), status: ['draft', 'ready_for_scheduling'].includes(match.status) ? 'scheduled' : match.status } })
    await recordAuditLog({ payload, action: 'bracket_modal.schedule_update', entityType: 'matches', entityId: match.id, before, after: { scheduled_start_at: startDate.toISOString(), scheduled_end_at: endDate.toISOString() }, actorUserId: user.id })
  } else {
    if (!canScore || !match.participant_a_entry_id || !match.participant_b_entry_id) redirect(`/brackets?matchError=unauthorized`)
    const a = parseScore(text(form, 'scoreA')); const b = parseScore(text(form, 'scoreB'))
    if (a === null || b === null || a === b) redirect(`/brackets?matchError=invalid_score`)
    const winner = a > b ? match.participant_a_entry_id : match.participant_b_entry_id
    const sets = await payload.find({ collection: 'match-sets', depth: 0, limit: 1, sort: '-set_number', where: { match_id: { equals: match.id } } })
    const addSet = text(form, 'addSet') === 'on'; const existing = sets.docs[0] as { id: string | number; set_number: number } | undefined
    if (!existing || addSet) await payload.create({ collection: 'match-sets', data: { event_id: (await payload.findByID({ collection: 'matches', id: match.id, depth: 0 }) as unknown as { event_id: string | number }).event_id, match_id: match.id, set_number: (existing?.set_number || 0) + 1, participant_a_score: a, participant_b_score: b, winner_entry_id: winner } })
    else await payload.update({ collection: 'match-sets', id: existing.id, data: { participant_a_score: a, participant_b_score: b, winner_entry_id: winner } })
    await payload.update({ collection: 'matches', id: match.id, data: { winner_entry_id: winner, score_summary: `${a}-${b}`, status: ['ready_for_scheduling', 'scheduled', 'ready_to_start', 'ongoing'].includes(match.status) ? 'finished' : match.status } })
    await recordAuditLog({ payload, action: 'bracket_modal.score_update', entityType: 'matches', entityId: match.id, before: null, after: { score: `${a}-${b}`, winner_entry_id: winner, added_set: addSet }, actorUserId: user.id })
    if (match.stage_id) await recalculateSingleEliminationBracket(payload, { stageId: match.stage_id })
  }
  refresh(matchNumber); redirect('/brackets?matchUpdated=1')
}
