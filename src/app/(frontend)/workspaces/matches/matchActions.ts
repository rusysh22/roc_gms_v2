'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { Forbidden } from 'payload'

import { recordAuditLog } from '@/lib/audit'
import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import { attemptDoubleEliminationAdvancement, recalculateDoubleEliminationBracket } from '@/lib/doubleElimination'
import { recalculateMedalsForCategory } from '@/lib/medals'
import { postMatchAnnouncement } from '@/lib/matchNotifications'
import {
  countSetWinsForSide,
  isBestOfAlreadyDecided,
  loadRulesetForMatch,
  validateSetScore,
} from '@/lib/ruleValidation'
import {
  deriveMatchOutcome,
  deriveSetWinnerSide,
  formatScoreSummary,
  type MatchOutcome,
  type OutcomeSet,
} from '@/lib/matchResult'
import { recalculateRankingStandingsForScope, recalculateStandingsForScope } from '@/lib/standings'
import { attemptSingleEliminationWinnerAdvancement } from '@/lib/winnerAdvancement'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../workspaceAuth'
import {
  MATCH_TRANSITIONS,
  PUBLIC_STATUS_NOTICES,
  SCOREABLE_MATCH_STATUSES,
  isValidTransition,
} from './matchLifecycle'

export type MinimalMatch = {
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
  score_summary?: string | null
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

// ---- ruleset-derived result helpers (src/lib/matchResult.ts) ----
// The officer enters the score; who won the set and the match is computed from the ruleset, not
// picked from a dropdown. A manual override path stays available for retirement / DQ / disputes.

const sideEntryId = (match: MinimalMatch, side: 'a' | 'b'): string | number | null | undefined =>
  side === 'a' ? match.participant_a_entry_id : match.participant_b_entry_id

const setWinnerSideFromDoc = (
  match: MinimalMatch,
  set: Pick<MinimalMatchSet, 'winner_entry_id'>,
): 'a' | 'b' | null => {
  if (set.winner_entry_id == null) return null
  if (String(set.winner_entry_id) === String(match.participant_a_entry_id)) return 'a'
  if (String(set.winner_entry_id) === String(match.participant_b_entry_id)) return 'b'
  return null
}

const loadMatchSets = async (payload: Payload, matchId: string | number): Promise<MinimalMatchSet[]> =>
  (
    await payload.find({
      collection: 'match-sets',
      depth: 0,
      limit: 50,
      sort: 'set_number',
      where: { match_id: { equals: matchId } },
    })
  ).docs as MinimalMatchSet[]

const outcomeSetsFrom = (match: MinimalMatch, sets: MinimalMatchSet[]): OutcomeSet[] =>
  sets.map((set) => ({
    participant_a_score: set.participant_a_score,
    participant_b_score: set.participant_b_score,
    winner_side: setWinnerSideFromDoc(match, set),
  }))

const loadParticipantLabels = async (payload: Payload, match: MinimalMatch) => {
  const load = async (id: string | number | null | undefined) => {
    if (id == null) return 'TBD'
    const doc = await payload
      .findByID({ collection: 'competition-entries', id, depth: 0 })
      .catch(() => null)
    return ((doc?.display_name as string | undefined) || 'TBD').trim()
  }
  const [a, b] = await Promise.all([
    load(match.participant_a_entry_id),
    load(match.participant_b_entry_id),
  ])
  return { a, b }
}

/** Recompute matches.score_summary from the current sets. Best-effort - never block a score edit
 * on the summary write. Must run with `user` so the match-mutation capability hook has a caller. */
const refreshScoreSummary = async (
  payload: Payload,
  match: MinimalMatch,
  ruleset: Parameters<typeof deriveMatchOutcome>[0],
  sets: MinimalMatchSet[],
  user: { id: string | number } | null,
) => {
  try {
    const labels = await loadParticipantLabels(payload, match)
    const outcomeSets = outcomeSetsFrom(match, sets)
    const outcome = deriveMatchOutcome(ruleset, outcomeSets)
    const summary = formatScoreSummary(labels.a, labels.b, outcomeSets, outcome)
    await payload.update({
      collection: 'matches',
      id: match.id,
      data: { score_summary: summary || null },
      user: user ?? undefined,
    })
  } catch (error) {
    payload.logger.error(`Failed to refresh score_summary for match ${match.id}: ${error}`)
  }
}

const standingStageTypes = new Set(['group_stage', 'round_robin', 'league', 'swiss'])
// 'walkover' included alongside 'finished'/'result_published' - live testing confirmed a
// round-robin match marked Walkover (a real, decided outcome with a winner_entry_id already set)
// left the standings table showing pre-walkover numbers indefinitely, since this gate previously
// never recognized that status.
const standingResultStatuses = new Set(['finished', 'result_published', 'walkover'])
const ACTIVE_SCORE_ENTRY_STATUSES = new Set<string>(SCOREABLE_MATCH_STATUSES)
const rankingStageTypes = new Set(['time_trial', 'score_ranking'])

// MSG-02: called from every branch of recalculateResultCachesBestEffort below, after that
// branch's own standings/bracket cache recalculation - medal derivation reads the standings/bracket
// state those just wrote, so it must run after them, not in parallel. A no-op (not even a
// database write) for any event with medal_tally_enabled off, which is every event by default.
const recalculateMedalsBestEffort = async ({
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
  if (!match.event_id || !match.category_id) {
    return
  }

  try {
    const event = await payload.findByID({ collection: 'events', id: match.event_id, depth: 0 })
    if (!event.medal_tally_enabled) {
      return
    }

    const result = await recalculateMedalsForCategory(payload, match.category_id)

    await recordAuditLog({
      payload,
      action: 'medal.recalculate',
      entityType: 'matches',
      entityId: match.id,
      before: null,
      after: {
        reason: action,
        match_number: matchNumber,
        category_id: match.category_id,
        written: result.written,
        skipped_manual: result.skippedManual,
        finished: result.finished,
        blocked_by_tie: result.blockedByTie,
      },
      actorUserId,
    })
  } catch (error) {
    payload.logger.error(`Failed to recalculate medals after ${action} on match ${matchNumber}: ${error}`)
  }
}

// Exported so schedulerActions.ts's bulk Excel import can keep standings/bracket/medal caches
// consistent after a status transition, the same way every single-match transition already does -
// reimplementing this per-stage-type recalculation logic a second time for the bulk path would be
// exactly the kind of divergence that quietly breaks one path and not the other.
export const recalculateResultCachesBestEffort = async ({
  payload,
  match,
  matchNumber,
  action,
  actorUserId,
  reverting = false,
}: {
  payload: Payload
  match: MinimalMatch
  matchNumber: string
  action: string
  actorUserId: string | number | null
  // A reverse transition (reopen / undo start / restore) removes a result that had been counted,
  // so standings must be recomputed even though the match's new status is not a "result" status.
  reverting?: boolean
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
    if (!standingResultStatuses.has(match.status) && !reverting) {
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

    await recalculateMedalsBestEffort({ payload, match, matchNumber, action, actorUserId })
    return
  }

  if (stage.stage_type === 'single_elimination') {
    // 'walkover' has a real winner_entry_id (requiresWinnerSelection on that transition already
    // enforces it) and needs to advance into the next round exactly like a result_published win -
    // otherwise a walkover'd match leaves its next-round slot empty forever. The seed script for
    // Nusantara Grand Games had to hand-wire bracket byes past this exact gap.
    if ((match.status === 'result_published' || match.status === 'walkover') && match.winner_entry_id) {
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
            // MSG-01: present only when this match is a semifinal wired to a Bronze Final.
            loser_target_match_id: advancement.loserTargetMatchId,
            loser_target_match_number: advancement.loserTargetMatchNumber,
            loser_target_slot: advancement.loserTargetSlot,
            loser_advanced: advancement.loserAdvanced,
          },
          actorUserId,
        })

        if (advancement.targetMatchNumber) {
          revalidatePath(`/workspaces/matches/${advancement.targetMatchNumber}`)
          revalidatePath(`/matches/${advancement.targetMatchNumber}`)
        }
        if (advancement.loserTargetMatchNumber) {
          revalidatePath(`/workspaces/matches/${advancement.loserTargetMatchNumber}`)
          revalidatePath(`/matches/${advancement.loserTargetMatchNumber}`)
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
    await recalculateMedalsBestEffort({ payload, match, matchNumber, action, actorUserId })
    return
  }

  if (stage.stage_type === 'double_elimination') {
    // MSG-02: no recalculateMedalsBestEffort call here - deriveMedalsForCategory has no
    // double-elimination strategy yet (winners/losers bracket + grand final reset has no clean
    // gold/silver/bronze mapping without more design work), so a category on this stage type
    // never produces medals even with medal_tally_enabled on.
    if ((match.status === 'result_published' || match.status === 'walkover') && match.winner_entry_id) {
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

    await recalculateMedalsBestEffort({ payload, match, matchNumber, action, actorUserId })
  }
}

type TransitionUser = { id: string | number; roles?: string[] | null }

/** The shared core of every match status change: validate the transition, write status (+ optional
 * winner / score summary / timestamps) with `user` in context for the capability hook, audit,
 * recalculate result caches, post the public notice, revalidate. Does NOT redirect - callers do.
 * `transitionMatchStatusAction` and `finishAndPublishMatchAction` both go through here so the
 * publish pipeline can never diverge. */
async function performMatchTransition(
  payload: Payload,
  user: TransitionUser,
  match: MinimalMatch,
  matchNumber: string,
  targetStatus: string,
  opts: { winnerEntryId?: string | number | null; scoreSummary?: string | null } = {},
): Promise<{ ok: true; match: MinimalMatch } | { ok: false; error: string }> {
  if (!isValidTransition(match.status, targetStatus)) {
    return { ok: false, error: 'invalid_transition' }
  }

  const updateData: Record<string, unknown> = { status: targetStatus }

  if (targetStatus === 'ongoing' && !match.actual_start_at) {
    updateData.actual_start_at = new Date().toISOString()
  }
  if (targetStatus === 'finished' && !match.actual_end_at) {
    updateData.actual_end_at = new Date().toISOString()
  }
  // The derived winner is recorded as soon as the match reaches `finished` (still provisional -
  // bracket advancement only fires on `result_published`), so a match officer who can finish but
  // not publish still leaves a complete, correct result for an admin to publish in one click.
  if (
    (targetStatus === 'finished' || targetStatus === 'result_published' || targetStatus === 'walkover') &&
    opts.winnerEntryId
  ) {
    updateData.winner_entry_id = opts.winnerEntryId
    if (!match.actual_end_at) updateData.actual_end_at = new Date().toISOString()
  }
  if (opts.scoreSummary !== undefined) {
    updateData.score_summary = opts.scoreSummary
  }

  // Reverse transitions (Undo Start / Reopen Match / Restore Match) unwind the timestamps + derived
  // winner + summary that the forward step set. Set scores stay - the winner re-derives from them.
  const isReverseToScheduled =
    targetStatus === 'scheduled' && ['ongoing', 'paused', 'cancelled'].includes(match.status)
  const isReopen = targetStatus === 'ongoing' && ['finished', 'under_review'].includes(match.status)
  if (isReverseToScheduled || isReopen) {
    updateData.winner_entry_id = null
    updateData.actual_end_at = null
    updateData.score_summary = null
    if (isReverseToScheduled) updateData.actual_start_at = null
  }

  // AUDIT_E2E MAT-02: `requiresWinnerSelection` is enforced here, the one place every transition
  // goes through - a publish/walkover with no winner_entry_id silently breaks standings/bracket
  // advancement downstream.
  const transition = MATCH_TRANSITIONS.find(
    (candidate) => candidate.from.includes(match.status) && candidate.to === targetStatus,
  )
  if (transition?.requiresWinnerSelection && !updateData.winner_entry_id) {
    return { ok: false, error: 'winner_required' }
  }

  const beforeSnapshot = {
    status: match.status,
    actual_start_at: match.actual_start_at ?? null,
    actual_end_at: match.actual_end_at ?? null,
    winner_entry_id: match.winner_entry_id ?? null,
    score_summary: match.score_summary ?? null,
  }

  // AUDIT_UI_UX_CSS: enforceMatchMutationCapabilities (src/access/roles.ts) reads req.user to
  // decide whether this change is allowed on an already-locked match - without `user`, a transition
  // off a finished/result_published/walkover/disputed match throws Forbidden for every role. A
  // match_officer hitting a locked-status transition (reopen/restore/publish) gets a clean message
  // instead of a 500.
  try {
    await payload.update({ collection: 'matches', id: match.id, data: updateData, user })
  } catch (error) {
    if (error instanceof Forbidden) {
      return { ok: false, error: 'transition_forbidden' }
    }
    throw error
  }

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

  const nextMatch = { ...match, ...updateData, status: targetStatus } as MinimalMatch

  await recalculateResultCachesBestEffort({
    payload,
    match: nextMatch,
    matchNumber,
    action: 'match.status_transition',
    actorUserId,
    reverting: isReverseToScheduled || isReopen,
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
  return { ok: true, match: nextMatch }
}

/** Resolves the winner + fresh score summary a `result_published` transition should carry. When
 * the officer did not pick a winner (the normal case now), it is derived from the sets + ruleset. */
const resolvePublishResult = async (
  payload: Payload,
  match: MinimalMatch,
  manualWinnerSide: 'a' | 'b' | null,
): Promise<{ winnerEntryId: string | number | null; scoreSummary: string | null; outcome: MatchOutcome }> => {
  const ruleset = await loadRulesetForMatch(payload, {
    categoryId: match.category_id,
    stageId: match.stage_id,
  })
  const sets = await loadMatchSets(payload, match.id)
  const outcomeSets = outcomeSetsFrom(match, sets)
  const outcome = deriveMatchOutcome(ruleset, outcomeSets)

  let winnerSide: 'a' | 'b' | null = manualWinnerSide
  if (!winnerSide && outcome.decided && outcome.winnerSide) {
    winnerSide = outcome.winnerSide
  }
  const winnerEntryId = winnerSide ? sideEntryId(match, winnerSide) ?? null : null

  const labels = await loadParticipantLabels(payload, match)
  const scoreSummary = formatScoreSummary(labels.a, labels.b, outcomeSets, outcome) || null

  return { winnerEntryId, scoreSummary, outcome }
}

export async function transitionMatchStatusAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const targetStatus = toStringField(formData.get('targetStatus'))
  const winnerSideRaw = toStringField(formData.get('winnerSide'))
  const winnerSide = winnerSideRaw === 'a' || winnerSideRaw === 'b' ? winnerSideRaw : null
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

  let opts: { winnerEntryId?: string | number | null; scoreSummary?: string | null } = {}
  if (targetStatus === 'result_published') {
    const resolved = await resolvePublishResult(payload, match, winnerSide)
    opts = { winnerEntryId: resolved.winnerEntryId, scoreSummary: resolved.scoreSummary }
  } else if (targetStatus === 'walkover' && winnerSide) {
    opts = { winnerEntryId: sideEntryId(match, winnerSide) ?? null }
  }

  const result = await performMatchTransition(payload, user, match, matchNumber, targetStatus, opts)
  if (!result.ok) {
    const error =
      result.error === 'winner_required' && targetStatus === 'result_published'
        ? 'match_not_decided'
        : result.error
    redirect(`${returnTo}?matchError=${error}`)
  }
  redirect(`${returnTo}?matchUpdated=1`)
}

/** One-tap "Finish & publish result" for the Live Score screen: only offered once the sets + the
 * ruleset show a decided match. Chains ongoing/paused -> finished -> result_published with the
 * derived winner, so the officer never picks it by hand. */
export async function finishAndPublishMatchAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const returnTo = getSafeReturnTo(
    formData,
    matchNumber ? `/workspaces/matches/${matchNumber}` : '/workspaces/match-officer',
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

  const resolved = await resolvePublishResult(payload, match, null)
  if (!resolved.outcome.decided || !resolved.winnerEntryId) {
    redirect(`${returnTo}?matchError=match_not_decided`)
  }

  const opts = { winnerEntryId: resolved.winnerEntryId, scoreSummary: resolved.scoreSummary }

  let current = match
  if (current.status === 'ongoing' || current.status === 'paused') {
    const step = await performMatchTransition(payload, user, current, matchNumber, 'finished', opts)
    if (!step.ok) {
      redirect(`${returnTo}?matchError=${step.error}`)
    }
    current = step.match
  }

  // Publishing off a `finished` match is a locked-result mutation - only event_admin/super_admin
  // may do it (src/access/roles.ts). A match officer's tap finishes the match with the winner
  // already recorded; the Finish result panel then offers one-click publish to an admin.
  const canPublish = (user.roles ?? []).some((role) => role === 'super_admin' || role === 'event_admin')
  if (canPublish && (current.status === 'finished' || current.status === 'under_review')) {
    const publish = await performMatchTransition(payload, user, current, matchNumber, 'result_published', opts)
    if (!publish.ok) {
      redirect(`${returnTo}?matchError=${publish.error === 'winner_required' ? 'match_not_decided' : publish.error}`)
    }
  }
  redirect(`${returnTo}?matchUpdated=1`)
}

export async function updateMatchSetScoreAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const matchSetId = toStringField(formData.get('matchSetId'))
  const winnerSide = toStringField(formData.get('winnerSide'))
  // The set winner is normally derived from the score + ruleset. `manualWinnerOverride=1` is the
  // hidden "Correct manually" path for retirement / DQ / a score the rules can't resolve.
  const manualWinnerOverride = toStringField(formData.get('manualWinnerOverride')) === '1'
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
  const ruleset = await loadRulesetForMatch(payload, { categoryId: match.category_id, stageId: match.stage_id })

  // Derive the set winner from the score + ruleset. On manual override, take the posted side as-is
  // (a/b, or blank = no winner) and skip validateSetScore's "winner must match the higher score"
  // rule so a genuine override (retirement, DQ) can be recorded.
  const manualSide = winnerSide === 'a' || winnerSide === 'b' ? winnerSide : null
  const winnerSideValue = manualWinnerOverride
    ? manualSide
    : deriveSetWinnerSide(ruleset, participantAScore, participantBScore)
  const winnerEntryId =
    winnerSideValue === 'a'
      ? match.participant_a_entry_id
      : winnerSideValue === 'b'
        ? match.participant_b_entry_id
        : null

  const scoreValidation = validateSetScore({
    ruleset,
    participantAScore,
    participantBScore,
    winnerSide: manualWinnerOverride ? null : winnerSideValue,
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

  await refreshScoreSummary(payload, match, ruleset, await loadMatchSets(payload, match.id), user)

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
  const ruleset = await loadRulesetForMatch(payload, { categoryId: match.category_id, stageId: match.stage_id })
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

/** Counterpart to addMatchSetAction - removes a set added by mistake. Only the highest-numbered
 * set can go (keeps set_number gap-free), and only while the match isn't locked. */
export async function deleteMatchSetAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const matchSetId = toStringField(formData.get('matchSetId'))
  const returnTo = getSafeReturnTo(
    formData,
    matchNumber ? `/workspaces/matches/${matchNumber}` : '/workspaces/match-officer',
  )

  if (!matchNumber || !matchSetId) {
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

  if (['finished', 'result_published', 'walkover', 'disputed'].includes(match.status)) {
    redirect(`${returnTo}?matchError=set_delete_locked`)
  }

  const sets = await loadMatchSets(payload, match.id)
  const target = sets.find((set) => String(set.id) === String(matchSetId))
  if (!target) {
    redirect(`${returnTo}?matchError=invalid_request`)
  }
  const highestSetNumber = sets.reduce((max, set) => Math.max(max, set.set_number), 0)
  if (target.set_number !== highestSetNumber) {
    redirect(`${returnTo}?matchError=set_delete_not_last`)
  }

  await payload.delete({ collection: 'match-sets', id: matchSetId, user })

  const actorUserId = user.id
  await recordAuditLog({
    payload,
    action: 'match_set.delete',
    entityType: 'match-sets',
    entityId: matchSetId,
    before: {
      set_number: target.set_number,
      participant_a_score: target.participant_a_score ?? null,
      participant_b_score: target.participant_b_score ?? null,
    },
    after: null,
    actorUserId,
  })

  const ruleset = await loadRulesetForMatch(payload, { categoryId: match.category_id, stageId: match.stage_id })
  await refreshScoreSummary(
    payload,
    match,
    ruleset,
    sets.filter((set) => String(set.id) !== String(matchSetId)),
    user,
  )

  await recalculateResultCachesBestEffort({
    payload,
    match,
    matchNumber,
    action: 'match_set.delete',
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
export type ApplyLiveScorePointResult =
  | {
      ok: true
      participant_a_score: number
      participant_b_score: number
      // Derived from the new score + ruleset so the client can show "set complete" / "match
      // complete" the instant the deciding point syncs, without waiting for a refresh.
      set_winner_side: 'a' | 'b' | null
      match_outcome: { decided: boolean; winner_side: 'a' | 'b' | null; sets_won_a: number; sets_won_b: number }
    }
  | { ok: false; error: 'invalid_request' | 'not_found' | 'invalid_match_state' }

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md 15.2 "offline scoring": extracted from the old
// addLiveScorePointAction so the same validated, audited, atomic delta-update logic can be called
// both from a normal form submission AND from the JSON API route the offline queue in
// live-score/useOfflineScoreSync.ts replays queued taps against once connectivity returns -
// returning a typed result instead of always redirecting, since a fetch()-based caller needs a
// real response body, not a Next.js navigation.
export async function applyLiveScorePoint({
  payload,
  matchNumber,
  matchSetId,
  side,
  delta,
  user,
}: {
  payload: Payload
  matchNumber: string
  matchSetId: string
  side: 'a' | 'b'
  delta: 1 | -1
  user: { id: string | number; roles?: string[] | null }
}): Promise<ApplyLiveScorePointResult> {
  const actorUserId = user.id
  const { match } = await findMatchByNumber(payload, matchNumber)

  if (!match) {
    return { ok: false, error: 'not_found' }
  }

  // AUDIT_E2E MAT-05: same lifecycle guard as updateMatchSetScoreAction - point taps only make
  // sense while a match is actually being played.
  if (!ACTIVE_SCORE_ENTRY_STATUSES.has(match.status)) {
    return { ok: false, error: 'invalid_match_state' }
  }

  const existingSet = await payload
    .findByID({ collection: 'match-sets', id: matchSetId, depth: 0 })
    .catch(() => null)
  if (!existingSet || String(existingSet.match_id || '') !== String(match.id)) {
    return { ok: false, error: 'invalid_request' }
  }

  const ruleset = await loadRulesetForMatch(payload, { categoryId: match.category_id, stageId: match.stage_id })
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
  const newA = Number(updatedRow?.participant_a_score ?? existingSet.participant_a_score ?? 0)
  const newB = Number(updatedRow?.participant_b_score ?? existingSet.participant_b_score ?? 0)

  // The set winner follows the score under the ruleset - the officer never picks it. When this set
  // just crossed (or fell back over) the decided line, persist that and refresh the match summary.
  const derivedSetSide = deriveSetWinnerSide(ruleset, newA, newB)
  const priorSetSide = setWinnerSideFromDoc(match, existingSet as MinimalMatchSet)
  const setStateChanged = derivedSetSide !== priorSetSide

  if (setStateChanged) {
    const derivedWinnerId = derivedSetSide ? sideEntryId(match, derivedSetSide) ?? null : null
    await payload.db.drizzle.execute(sql`
      UPDATE match_sets
      SET winner_entry_id = ${derivedWinnerId == null ? null : Number(derivedWinnerId)}
      WHERE id = ${Number(matchSetId)}
    `)
  }

  // Recompute the match outcome from every set every tap (one small indexed query) so the client's
  // "match complete" prompt stays correct even as the score keeps moving past the deciding point.
  const allSets = await loadMatchSets(payload, match.id)
  const matchOutcome = deriveMatchOutcome(ruleset, outcomeSetsFrom(match, allSets))
  if (setStateChanged) {
    await refreshScoreSummary(payload, match, ruleset, allSets, user)
  }

  await recordAuditLog({
    payload,
    action: 'match_set.point_increment',
    entityType: 'match-sets',
    entityId: matchSetId,
    before: {
      participant_a_score: existingSet.participant_a_score ?? null,
      participant_b_score: existingSet.participant_b_score ?? null,
      winner_side: priorSetSide,
    },
    after: { participant_a_score: newA, participant_b_score: newB, winner_side: derivedSetSide },
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

  return {
    ok: true,
    participant_a_score: newA,
    participant_b_score: newB,
    set_winner_side: derivedSetSide,
    match_outcome: {
      decided: matchOutcome.decided,
      winner_side: matchOutcome.winnerSide,
      sets_won_a: matchOutcome.setsWonA,
      sets_won_b: matchOutcome.setsWonB,
    },
  }
}
