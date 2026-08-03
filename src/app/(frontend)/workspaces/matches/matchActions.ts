'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'

import { recordAuditLog } from '@/lib/audit'
import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import { attemptDoubleEliminationAdvancement, recalculateDoubleEliminationBracket } from '@/lib/doubleElimination'
import { postMatchAnnouncement } from '@/lib/matchNotifications'
import {
  countSetWinsForSide,
  isBestOfAlreadyDecided,
  loadRulesetForMatch,
  validateSetScore,
} from '@/lib/ruleValidation'
import { recalculateRankingStandingsForScope, recalculateStandingsForScope } from '@/lib/standings'
import { attemptSingleEliminationWinnerAdvancement } from '@/lib/winnerAdvancement'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../workspaceAuth'
import { MATCH_TRANSITIONS, isValidTransition } from './matchLifecycle'

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md 15.6: only status changes a spectator would actually care
// about post to the public "Match Updates" feed - ongoing/paused/finished/under_review are
// internal operating states with no public-facing meaning of their own (finished still says
// "Provisional" until result_published; under_review shouldn't alarm anyone).
const PUBLIC_STATUS_NOTICES: Record<string, { urgency: 'warning' | 'urgent' | 'result'; displayMode: 'banner' | 'urgent_alert' | 'feed'; label: string }> = {
  postponed: { urgency: 'warning', displayMode: 'banner', label: 'postponed' },
  cancelled: { urgency: 'warning', displayMode: 'banner', label: 'cancelled' },
  disputed: { urgency: 'urgent', displayMode: 'urgent_alert', label: 'marked disputed' },
  result_published: { urgency: 'result', displayMode: 'feed', label: 'result published' },
  walkover: { urgency: 'result', displayMode: 'feed', label: 'decided by walkover' },
}

type MinimalMatch = {
  id: string | number
  event_id?: string | number | null
  category_id?: string | number | null
  stage_id?: string | number | null
  group_id?: string | number | null
  status: string
  actual_start_at?: string | null
  actual_end_at?: string | null
  participant_a_entry_id?: string | number | null
  participant_b_entry_id?: string | number | null
  winner_entry_id?: string | number | null
  result_value?: number | null
  result_qualifier?: string | null
}

type MinimalStage = {
  id: string | number
  stage_type?: string | null
}

type MinimalMatchSet = {
  id: string | number
  match_id?: string | number | null
  set_number: number
  participant_a_score?: number | null
  participant_b_score?: number | null
  winner_entry_id?: string | number | null
  notes?: string | null
}

const toStringField = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value.trim() : ''

const parseScore = (value: FormDataEntryValue | null) => {
  const text = toStringField(value)
  if (text === '') {
    return 0
  }

  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return Math.round(parsed)
}

const getSafeReturnTo = (formData: FormData, fallback: string) => {
  const returnTo = toStringField(formData.get('returnTo'))
  return returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : fallback
}

const findMatchByNumber = async (payload: Payload, matchNumber: string) => {
  const matches = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 1,
    where: { match_number: { equals: matchNumber } },
  })

  return { payload, match: matches.docs[0] as MinimalMatch | undefined }
}

const revalidateMatch = (matchNumber: string) => {
  revalidatePath(`/workspaces/matches/${matchNumber}`)
  revalidatePath(`/matches/${matchNumber}`)
  revalidatePath('/standings')
  revalidatePath('/brackets')
  revalidatePath('/workspaces/standings')
  revalidatePath('/workspaces/brackets')
}

const standingStageTypes = new Set(['group_stage', 'round_robin', 'league', 'swiss'])
const standingResultStatuses = new Set(['finished', 'result_published'])
const ACTIVE_SCORE_ENTRY_STATUSES = new Set(['ongoing', 'paused', 'under_review'])
const rankingStageTypes = new Set(['time_trial', 'score_ranking'])

const recalculateResultCachesBestEffort = async ({
  payload,
  match,
  matchNumber,
  action,
  actorUserId,
}: {
  payload: Payload
  match: MinimalMatch
  matchNumber: string
  action: string
  actorUserId: string | number | null
}) => {
  if (!match.stage_id || !match.category_id) {
    return
  }

  let stage: MinimalStage
  try {
    stage = (await payload.findByID({
      collection: 'stages',
      id: match.stage_id,
      depth: 0,
    })) as MinimalStage
  } catch (error) {
    payload.logger.error(
      `Failed to load stage for result cache recalculation after ${action} on match ${matchNumber}: ${error}`,
    )
    return
  }

  if (stage.stage_type && standingStageTypes.has(stage.stage_type)) {
    if (!standingResultStatuses.has(match.status)) {
      return
    }

    try {
      const result = await recalculateStandingsForScope(payload, {
        eventId: match.event_id || undefined,
        categoryId: match.category_id,
        stageId: match.stage_id,
        groupId: match.group_id || undefined,
      })

      await recordAuditLog({
        payload,
        action: 'standing.cache_recalculate',
        entityType: 'matches',
        entityId: match.id,
        before: null,
        after: {
          reason: action,
          match_number: matchNumber,
          row_count: result.rows.length,
          finished_match_count: result.finishedMatchCount,
        },
        actorUserId,
      })
    } catch (error) {
      payload.logger.error(
        `Failed to recalculate standings after ${action} on match ${matchNumber}: ${error}`,
      )
    }

    return
  }

  if (stage.stage_type === 'single_elimination') {
    if (match.status === 'result_published' && match.winner_entry_id) {
      try {
        const advancement = await attemptSingleEliminationWinnerAdvancement(payload, match.id)

        await recordAuditLog({
          payload,
          action: advancement.advanced ? 'winner_advancement.advance' : 'winner_advancement.skip',
          entityType: 'matches',
          entityId: match.id,
          before: null,
          after: {
            reason: action,
            match_number: matchNumber,
            outcome: advancement.outcome,
            skipped_reason: advancement.reason,
            winner_entry_id: advancement.winnerEntryId,
            winner_label: advancement.winnerLabel,
            target_match_id: advancement.targetMatchId,
            target_match_number: advancement.targetMatchNumber,
            target_slot: advancement.targetSlot,
            advanced: advancement.advanced,
          },
          actorUserId,
        })

        if (advancement.targetMatchNumber) {
          revalidatePath(`/workspaces/matches/${advancement.targetMatchNumber}`)
          revalidatePath(`/matches/${advancement.targetMatchNumber}`)
        }
      } catch (error) {
        payload.logger.error(
          `Failed to attempt winner advancement after ${action} on match ${matchNumber}: ${error}`,
        )
      }
    }

    try {
      const result = await recalculateSingleEliminationBracket(payload, {
        stageId: match.stage_id,
      })

      await recordAuditLog({
        payload,
        action: 'bracket.cache_recalculate',
        entityType: 'matches',
        entityId: match.id,
        before: null,
        after: {
          reason: action,
          match_number: matchNumber,
          bracket_id: result.bracketId,
          match_count: result.matchCount,
          round_count: result.roundCount,
        },
        actorUserId,
      })
    } catch (error) {
      payload.logger.error(
        `Failed to recalculate bracket after ${action} on match ${matchNumber}: ${error}`,
      )
    }
    return
  }

  if (stage.stage_type === 'double_elimination') {
    if (match.status === 'result_published' && match.winner_entry_id) {
      try {
        const advancement = await attemptDoubleEliminationAdvancement(payload, match.id)

        await recordAuditLog({
          payload,
          action: 'winner_advancement.double_elimination',
          entityType: 'matches',
          entityId: match.id,
          before: null,
          after: {
            reason: action,
            match_number: matchNumber,
            outcome: advancement.outcome,
            details: advancement.details,
          },
          actorUserId,
        })
      } catch (error) {
        payload.logger.error(
          `Failed to attempt double-elimination advancement after ${action} on match ${matchNumber}: ${error}`,
        )
      }
    }

    try {
      const result = await recalculateDoubleEliminationBracket(payload, {
        stageId: match.stage_id,
      })

      await recordAuditLog({
        payload,
        action: 'bracket.cache_recalculate',
        entityType: 'matches',
        entityId: match.id,
        before: null,
        after: {
          reason: action,
          match_number: matchNumber,
          bracket_id: result.bracketId,
          match_count: result.matchCount,
          round_count: result.roundCount,
        },
        actorUserId,
      })
    } catch (error) {
      payload.logger.error(
        `Failed to recalculate double-elimination bracket after ${action} on match ${matchNumber}: ${error}`,
      )
    }
    return
  }

  if (rankingStageTypes.has(stage.stage_type || '')) {
    if (match.status !== 'result_published') {
      return
    }

    try {
      const result = await recalculateRankingStandingsForScope(payload, {
        eventId: match.event_id || undefined,
        categoryId: match.category_id,
        stageId: match.stage_id,
      })

      await recordAuditLog({
        payload,
        action: 'standing.cache_recalculate',
        entityType: 'matches',
        entityId: match.id,
        before: null,
        after: {
          reason: action,
          match_number: matchNumber,
          row_count: result.rows.length,
          finished_match_count: result.finishedMatchCount,
        },
        actorUserId,
      })
    } catch (error) {
      payload.logger.error(
        `Failed to recalculate ranking standings after ${action} on match ${matchNumber}: ${error}`,
      )
    }
  }
}

export async function transitionMatchStatusAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const targetStatus = toStringField(formData.get('targetStatus'))
  const winnerSide = toStringField(formData.get('winnerSide'))
  const returnTo = getSafeReturnTo(
    formData,
    matchNumber ? `/workspaces/matches/${matchNumber}` : '/workspaces/match-officer',
  )

  if (!matchNumber || !targetStatus) {
    redirect(`${returnTo}?matchError=invalid_request`)
  }

  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.matchOfficer,
    returnTo,
  })
  const { match } = await findMatchByNumber(payload, matchNumber)

  if (!match) {
    redirect(`${returnTo}?matchError=not_found`)
  }

  if (!isValidTransition(match.status, targetStatus)) {
    redirect(`${returnTo}?matchError=invalid_transition`)
  }

  const updateData: Record<string, unknown> = { status: targetStatus }

  if (targetStatus === 'ongoing' && !match.actual_start_at) {
    updateData.actual_start_at = new Date().toISOString()
  }

  if (targetStatus === 'finished' && !match.actual_end_at) {
    updateData.actual_end_at = new Date().toISOString()
  }

  if (targetStatus === 'result_published' || targetStatus === 'walkover') {
    const winnerEntryId =
      winnerSide === 'a'
        ? match.participant_a_entry_id
        : winnerSide === 'b'
          ? match.participant_b_entry_id
          : null

    if (winnerEntryId) {
      updateData.winner_entry_id = winnerEntryId
    }
  }

  // AUDIT_E2E MAT-02: `requiresWinnerSelection` on the transition table was previously only UI
  // metadata (used to decide whether the confirm dialog shows a winner picker) - the action itself
  // never checked it, so a match could be published/walked-over with no winner_entry_id at all,
  // which then silently broke standings/bracket advancement downstream. Enforced here, at the one
  // place every status transition goes through.
  const transition = MATCH_TRANSITIONS.find(
    (candidate) => candidate.from.includes(match.status) && candidate.to === targetStatus,
  )
  if (transition?.requiresWinnerSelection && !updateData.winner_entry_id) {
    redirect(`${returnTo}?matchError=winner_required`)
  }

  const beforeSnapshot = {
    status: match.status,
    actual_start_at: match.actual_start_at ?? null,
    actual_end_at: match.actual_end_at ?? null,
    winner_entry_id: match.winner_entry_id ?? null,
  }

  // AUDIT_UI_UX_CSS: enforceMatchMutationCapabilities (src/access/roles.ts) reads req.user to
  // decide whether this status change is allowed on an already-locked match - Payload's Local API
  // does not otherwise know who's calling, so omitting `user` here made every transition off a
  // finished/result_published/walkover/disputed match throw Forbidden unconditionally, for every
  // role including super_admin. This was the actual reason "Confirm and Publish Result" never
  // worked, discovered while adding the dispute-workflow transitions (which hit the exact same
  // path from a different angle).
  await payload.update({
    collection: 'matches',
    id: match.id,
    data: updateData,
    user,
  })

  const actorUserId = user.id

  await recordAuditLog({
    payload,
    action: 'match.status_transition',
    entityType: 'matches',
    entityId: match.id,
    before: beforeSnapshot,
    after: { ...beforeSnapshot, ...updateData },
    actorUserId,
  })

  await recalculateResultCachesBestEffort({
    payload,
    match: { ...match, ...updateData, status: targetStatus },
    matchNumber,
    action: 'match.status_transition',
    actorUserId,
  })

  const notice = PUBLIC_STATUS_NOTICES[targetStatus]
  if (notice && match.event_id) {
    await postMatchAnnouncement({
      payload,
      eventId: match.event_id,
      categoryId: match.category_id,
      matchId: match.id,
      matchNumber,
      title: `${matchNumber} ${notice.label}`,
      summary: `${matchNumber} was ${notice.label}.`,
      urgency: notice.urgency,
      displayMode: notice.displayMode,
    })
  }

  revalidateMatch(matchNumber)
  redirect(`${returnTo}?matchUpdated=1`)
}

export async function updateMatchSetScoreAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const matchSetId = toStringField(formData.get('matchSetId'))
  const winnerSide = toStringField(formData.get('winnerSide'))
  const notes = toStringField(formData.get('notes'))
  const revisionReason = toStringField(formData.get('revisionReason'))
  const participantAScore = parseScore(formData.get('participantAScore'))
  const participantBScore = parseScore(formData.get('participantBScore'))

  const returnTo = getSafeReturnTo(
    formData,
    `/workspaces/matches/${matchNumber || ''}`,
  )

  if (!matchNumber || !matchSetId) {
    redirect(`${returnTo}?matchError=invalid_request`)
  }

  if (participantAScore === null || participantBScore === null) {
    redirect(`${returnTo}?matchError=invalid_score`)
  }

  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.matchOfficer,
    returnTo,
  })
  const { match } = await findMatchByNumber(payload, matchNumber)

  if (!match) {
    redirect(`${returnTo}?matchError=not_found`)
  }

  const winnerSideValue = winnerSide === 'a' || winnerSide === 'b' ? winnerSide : null
  const winnerEntryId =
    winnerSideValue === 'a'
      ? match.participant_a_entry_id
      : winnerSideValue === 'b'
        ? match.participant_b_entry_id
        : null

  const existingSet = (await payload.findByID({
    collection: 'match-sets',
    id: matchSetId,
    depth: 0,
  })) as MinimalMatchSet

  if (String(existingSet.match_id || '') !== String(match.id)) {
    redirect(`${returnTo}?matchError=invalid_request`)
  }

  // AUDIT_E2E RULE-01: the ruleset's target_score/max_score/deuce_enabled/allow_draw were
  // previously never read at all - any score plus any winner selection was accepted outright.
  const ruleset = await loadRulesetForMatch(payload, match.category_id)
  const scoreValidation = validateSetScore({
    ruleset,
    participantAScore,
    participantBScore,
    winnerSide: winnerSideValue,
  })
  if (!scoreValidation.valid) {
    redirect(`${returnTo}?matchError=ruleset_violation`)
  }

  const lockedResult = ['finished', 'result_published'].includes(match.status)
  const canReviseFinishedScore = user.roles?.some((role) =>
    ['super_admin', 'event_admin'].includes(role),
  )
  if (lockedResult && (!canReviseFinishedScore || !revisionReason)) {
    redirect(`${returnTo}?matchError=${canReviseFinishedScore ? 'revision_reason_required' : 'revision_requires_approval'}`)
  }

  // AUDIT_E2E MAT-05: score entry had no lifecycle guard at all - a draft, scheduled, cancelled,
  // postponed, disputed, or walkover match could still receive set-score edits. Only a match that
  // is actually being played (ongoing/paused/under_review) accepts a normal edit; finished/
  // result_published are handled by the revision-reason branch above; everything else is rejected.
  if (!lockedResult && !ACTIVE_SCORE_ENTRY_STATUSES.has(match.status)) {
    redirect(`${returnTo}?matchError=invalid_match_state`)
  }

  const beforeSnapshot = {
    participant_a_score: existingSet.participant_a_score ?? null,
    participant_b_score: existingSet.participant_b_score ?? null,
    winner_entry_id: existingSet.winner_entry_id ?? null,
    notes: existingSet.notes ?? null,
  }
  const afterSnapshot = {
    participant_a_score: participantAScore,
    participant_b_score: participantBScore,
    winner_entry_id: winnerEntryId == null ? winnerEntryId : Number(winnerEntryId),
    notes: notes || null,
  }

  // Same enforceMatchSetMutationCapabilities/req.user gap as transitionMatchStatusAction above -
  // without `user`, this would throw Forbidden even for the already-verified event_admin/
  // super_admin revision path checked at canReviseFinishedScore just above.
  await payload.update({
    collection: 'match-sets',
    id: matchSetId,
    data: afterSnapshot,
    user,
  })

  const actorUserId = user.id

  await recordAuditLog({
    payload,
    action: lockedResult ? 'match_set.score_revision' : 'match_set.score_update',
    entityType: 'match-sets',
    entityId: matchSetId,
    before: beforeSnapshot,
    after: { ...afterSnapshot, revision_reason: lockedResult ? revisionReason : null },
    actorUserId,
  })

  await recalculateResultCachesBestEffort({
    payload,
    match,
    matchNumber,
    action: 'match_set.score_update',
    actorUserId,
  })

  revalidateMatch(matchNumber)
  redirect(`${returnTo}?matchUpdated=1`)
}

export async function addMatchSetAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const returnTo = getSafeReturnTo(
    formData,
    matchNumber ? `/workspaces/matches/${matchNumber}` : '/workspaces/scheduler',
  )

  if (!matchNumber) {
    redirect(`${returnTo}?matchError=invalid_request`)
  }

  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.matchOfficer,
    returnTo,
  })
  const { match } = await findMatchByNumber(payload, matchNumber)

  if (!match) {
    redirect(`${returnTo}?matchError=not_found`)
  }

  const existingSets = await payload.find({
    collection: 'match-sets',
    depth: 0,
    limit: 50,
    sort: '-set_number',
    where: { match_id: { equals: match.id } },
  })
  const existingSetDocs = existingSets.docs as MinimalMatchSet[]
  const lastSet = existingSetDocs[0]
  const nextSetNumber = (lastSet?.set_number || 0) + 1

  // AUDIT_E2E RULE-01: best_of previously had no effect at all - a best-of-3 match could keep
  // accumulating a 4th, 5th, ... set indefinitely even after one side had already clinched it.
  const ruleset = await loadRulesetForMatch(payload, match.category_id)
  const winsA = countSetWinsForSide(existingSetDocs, match.participant_a_entry_id)
  const winsB = countSetWinsForSide(existingSetDocs, match.participant_b_entry_id)
  if (isBestOfAlreadyDecided(ruleset?.best_of, winsA, winsB)) {
    redirect(`${returnTo}?matchError=best_of_decided`)
  }

  // enforceMatchSetMutationCapabilities runs on create too (no operation guard, unlike the
  // matches-collection hook) - without `user`, adding a set on an already-locked match would
  // throw Forbidden even for an admin, same root cause as the two fixes above.
  const createdSet = await payload.create({
    collection: 'match-sets',
    data: {
      event_id: Number(match.event_id),
      match_id: Number(match.id),
      set_number: nextSetNumber,
      participant_a_score: 0,
      participant_b_score: 0,
    },
    user,
  })

  const actorUserId = user.id

  await recordAuditLog({
    payload,
    action: 'match_set.create',
    entityType: 'match-sets',
    entityId: createdSet.id,
    before: null,
    after: {
      set_number: nextSetNumber,
      participant_a_score: 0,
      participant_b_score: 0,
    },
    actorUserId,
  })

  await recalculateResultCachesBestEffort({
    payload,
    match,
    matchNumber,
    action: 'match_set.create',
    actorUserId,
  })

  revalidateMatch(matchNumber)
  redirect(`${returnTo}?matchUpdated=1`)
}

// ADMIN_EVENT_CREATION_NUSANTARA_GRAND_GAMES_2026.md F-13: time_trial/score_ranking matches are
// solo attempts (see createRankingAttemptMatches), not a live head-to-head game - the ongoing/
// paused/finished/under_review lifecycle in matchLifecycle.ts doesn't fit them. This action
// deliberately bypasses MATCH_TRANSITIONS/isValidTransition and records the result directly:
// exactly one of a numeric resultValue or a DNS/DNF/DSQ resultQualifier moves the match straight
// to result_published (mirroring updateMatchSetScoreAction's revision-reason gate for correcting
// an already-published result).
export async function recordRankingResultAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const resultValueRaw = toStringField(formData.get('resultValue'))
  const resultQualifierRaw = toStringField(formData.get('resultQualifier'))
  const revisionReason = toStringField(formData.get('revisionReason'))
  const returnTo = getSafeReturnTo(formData, `/workspaces/matches/${matchNumber || ''}`)

  if (!matchNumber) {
    redirect(`${returnTo}?matchError=invalid_request`)
  }

  const hasQualifier = ['dns', 'dnf', 'dsq'].includes(resultQualifierRaw)
  const hasValue = resultValueRaw !== ''
  if (hasQualifier === hasValue) {
    redirect(`${returnTo}?matchError=invalid_ranking_result`)
  }

  const resultValue = hasValue ? Number(resultValueRaw) : null
  if (resultValue !== null && (!Number.isFinite(resultValue) || resultValue < 0)) {
    redirect(`${returnTo}?matchError=invalid_score`)
  }

  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.matchOfficer,
    returnTo,
  })
  const { match } = await findMatchByNumber(payload, matchNumber)

  if (!match) {
    redirect(`${returnTo}?matchError=not_found`)
  }
  if (!match.participant_a_entry_id) {
    redirect(`${returnTo}?matchError=invalid_request`)
  }

  const lockedResult = match.status === 'result_published'
  const canReviseResult = user.roles?.some((role) => ['super_admin', 'event_admin'].includes(role))
  if (lockedResult && (!canReviseResult || !revisionReason)) {
    redirect(`${returnTo}?matchError=${canReviseResult ? 'revision_reason_required' : 'revision_requires_approval'}`)
  }

  const beforeSnapshot = {
    result_value: match.result_value ?? null,
    result_qualifier: match.result_qualifier ?? null,
    status: match.status,
  }
  const updateData: Record<string, unknown> = {
    result_value: resultValue,
    result_qualifier: hasQualifier ? resultQualifierRaw : null,
    status: 'result_published',
    // The solo entrant is recorded as winner_entry_id purely so any generic code reading that
    // field (audit trail, PUBLIC_STATUS_NOTICES) has something sensible - ranking itself is
    // computed from result_value via calculateRankingStandingsForScope, not from this field.
    winner_entry_id: Number(match.participant_a_entry_id),
  }
  if (!match.actual_end_at) {
    updateData.actual_end_at = new Date().toISOString()
  }

  await payload.update({
    collection: 'matches',
    id: match.id,
    data: updateData,
    user,
  })

  const actorUserId = user.id
  const auditAction = lockedResult ? 'match.ranking_result_revision' : 'match.ranking_result_record'

  await recordAuditLog({
    payload,
    action: auditAction,
    entityType: 'matches',
    entityId: match.id,
    before: beforeSnapshot,
    after: { ...updateData, revision_reason: lockedResult ? revisionReason : null },
    actorUserId,
  })

  await recalculateResultCachesBestEffort({
    payload,
    match: { ...match, ...updateData, status: 'result_published' },
    matchNumber,
    action: auditAction,
    actorUserId,
  })

  const notice = PUBLIC_STATUS_NOTICES.result_published
  if (notice && match.event_id && !lockedResult) {
    await postMatchAnnouncement({
      payload,
      eventId: match.event_id,
      categoryId: match.category_id,
      matchId: match.id,
      matchNumber,
      title: `${matchNumber} ${notice.label}`,
      summary: `${matchNumber} was ${notice.label}.`,
      urgency: notice.urgency,
      displayMode: notice.displayMode,
    })
  }

  revalidateMatch(matchNumber)
  redirect(`${returnTo}?matchUpdated=1`)
}

// AUDIT_E2E MAT-07: previously there was no assignment concept at all - the match officer
// workspace's "Assigned Match List" actually showed every scheduled match on the active event, to
// every match officer, regardless of who was really supposed to run it. Scheduler/event_admin
// assign officers here; leaving the list empty keeps a match open to any match officer (same
// open-by-default pattern as EventMemberships, so nothing breaks for events that don't use this).
export async function assignMatchOfficersAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const returnTo = getSafeReturnTo(formData, `/workspaces/matches/${matchNumber || ''}`)

  if (!matchNumber) {
    redirect(`${returnTo}?matchError=invalid_request`)
  }

  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.scheduler,
    returnTo,
  })
  const { match } = await findMatchByNumber(payload, matchNumber)

  if (!match) {
    redirect(`${returnTo}?matchError=not_found`)
  }

  const officerIds = formData.getAll('officerIds').map((value) => String(value)).filter(Boolean)

  await payload.update({
    collection: 'matches',
    id: match.id,
    data: { officer_ids: officerIds.map(Number) },
    user,
  })

  await recordAuditLog({
    payload,
    action: 'match.officers_assigned',
    entityType: 'matches',
    entityId: match.id,
    before: null,
    after: { officer_ids: officerIds },
    actorUserId: user.id,
  })

  revalidateMatch(matchNumber)
  redirect(`${returnTo}?matchUpdated=1`)
}

// AUDIT_E2E MAT-03: the live-score "+1"/"Undo" buttons used to compute the new score in the
// browser from whatever the page last rendered, then submitted that absolute number - two rapid
// taps (or two officers/devices open on the same match) could both read the same stale score and
// submit the same "+1" result, silently losing a point. This action instead issues a single atomic
// `UPDATE ... SET score = score + delta` statement executed by Postgres itself - there is no
// separate read-then-write in application code for a race to land between, and Postgres serializes
// concurrent UPDATEs to the same row automatically.
export async function addLiveScorePointAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const matchSetId = toStringField(formData.get('matchSetId'))
  const side = toStringField(formData.get('side'))
  const deltaRaw = toStringField(formData.get('delta'))
  const returnTo = getSafeReturnTo(
    formData,
    matchNumber ? `/workspaces/matches/${matchNumber}/live-score` : '/workspaces/match-officer',
  )

  if (!matchNumber || !matchSetId || (side !== 'a' && side !== 'b') || (deltaRaw !== '1' && deltaRaw !== '-1')) {
    redirect(`${returnTo}?matchError=invalid_request`)
  }

  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.matchOfficer,
    returnTo,
  })
  const { match } = await findMatchByNumber(payload, matchNumber)

  if (!match) {
    redirect(`${returnTo}?matchError=not_found`)
  }

  // AUDIT_E2E MAT-05: same lifecycle guard as updateMatchSetScoreAction - point taps only make
  // sense while a match is actually being played.
  if (!ACTIVE_SCORE_ENTRY_STATUSES.has(match.status)) {
    redirect(`${returnTo}?matchError=invalid_match_state`)
  }

  const existingSet = await payload
    .findByID({ collection: 'match-sets', id: matchSetId, depth: 0 })
    .catch(() => null)
  if (!existingSet || String(existingSet.match_id || '') !== String(match.id)) {
    redirect(`${returnTo}?matchError=invalid_request`)
  }

  const ruleset = await loadRulesetForMatch(payload, match.category_id)
  const delta = deltaRaw === '1' ? 1 : -1
  const column = side === 'a' ? 'participant_a_score' : 'participant_b_score'
  const maxScore = ruleset?.max_score

  const capExpression =
    maxScore !== null && maxScore !== undefined
      ? sql`LEAST(${maxScore}, GREATEST(0, ${sql.identifier(column)} + ${delta}))`
      : sql`GREATEST(0, ${sql.identifier(column)} + ${delta})`

  const result = await payload.db.drizzle.execute(sql`
    UPDATE match_sets
    SET ${sql.identifier(column)} = ${capExpression}
    WHERE id = ${Number(matchSetId)}
    RETURNING participant_a_score, participant_b_score
  `)

  const updatedRow = (result as { rows?: Array<Record<string, unknown>> }).rows?.[0]
  const actorUserId = user.id

  await recordAuditLog({
    payload,
    action: 'match_set.point_increment',
    entityType: 'match-sets',
    entityId: matchSetId,
    before: {
      participant_a_score: existingSet.participant_a_score ?? null,
      participant_b_score: existingSet.participant_b_score ?? null,
    },
    after: updatedRow || null,
    actorUserId,
  })

  await recalculateResultCachesBestEffort({
    payload,
    match,
    matchNumber,
    action: 'match_set.point_increment',
    actorUserId,
  })

  revalidateMatch(matchNumber)
  redirect(`${returnTo}?matchUpdated=1`)
}
