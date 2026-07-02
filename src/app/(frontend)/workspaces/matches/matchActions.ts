'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { isValidTransition } from './matchLifecycle'

type MinimalMatch = {
  id: string | number
  event_id?: string | number | null
  status: string
  actual_start_at?: string | null
  actual_end_at?: string | null
  participant_a_entry_id?: string | number | null
  participant_b_entry_id?: string | number | null
}

type MinimalMatchSet = {
  id: string | number
  set_number: number
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

const findMatchByNumber = async (matchNumber: string) => {
  const payload = await getPayload({ config })
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
}

export async function transitionMatchStatusAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const targetStatus = toStringField(formData.get('targetStatus'))
  const winnerSide = toStringField(formData.get('winnerSide'))

  if (!matchNumber || !targetStatus) {
    redirect(`/workspaces/matches/${matchNumber || ''}?matchError=invalid_request`)
  }

  const { payload, match } = await findMatchByNumber(matchNumber)

  if (!match) {
    redirect(`/workspaces/matches/${matchNumber}?matchError=not_found`)
  }

  if (!isValidTransition(match.status, targetStatus)) {
    redirect(`/workspaces/matches/${matchNumber}?matchError=invalid_transition`)
  }

  const updateData: Record<string, unknown> = { status: targetStatus }

  if (targetStatus === 'ongoing' && !match.actual_start_at) {
    updateData.actual_start_at = new Date().toISOString()
  }

  if (targetStatus === 'finished' && !match.actual_end_at) {
    updateData.actual_end_at = new Date().toISOString()
  }

  if ((targetStatus === 'result_published' || targetStatus === 'walkover') && winnerSide) {
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

  await payload.update({
    collection: 'matches',
    id: match.id,
    data: updateData,
  })

  revalidateMatch(matchNumber)
  redirect(`/workspaces/matches/${matchNumber}?matchUpdated=1`)
}

export async function updateMatchSetScoreAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const matchSetId = toStringField(formData.get('matchSetId'))
  const winnerSide = toStringField(formData.get('winnerSide'))
  const notes = toStringField(formData.get('notes'))
  const participantAScore = parseScore(formData.get('participantAScore'))
  const participantBScore = parseScore(formData.get('participantBScore'))

  if (!matchNumber || !matchSetId) {
    redirect(`/workspaces/matches/${matchNumber || ''}?matchError=invalid_request`)
  }

  if (participantAScore === null || participantBScore === null) {
    redirect(`/workspaces/matches/${matchNumber}?matchError=invalid_score`)
  }

  const { payload, match } = await findMatchByNumber(matchNumber)

  if (!match) {
    redirect(`/workspaces/matches/${matchNumber}?matchError=not_found`)
  }

  const winnerEntryId =
    winnerSide === 'a'
      ? match.participant_a_entry_id
      : winnerSide === 'b'
        ? match.participant_b_entry_id
        : null

  await payload.update({
    collection: 'match-sets',
    id: matchSetId,
    data: {
      participant_a_score: participantAScore,
      participant_b_score: participantBScore,
      winner_entry_id: winnerEntryId,
      notes: notes || null,
    },
  })

  revalidateMatch(matchNumber)
  redirect(`/workspaces/matches/${matchNumber}?matchUpdated=1`)
}

export async function addMatchSetAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))

  if (!matchNumber) {
    redirect('/workspaces/scheduler?matchError=invalid_request')
  }

  const { payload, match } = await findMatchByNumber(matchNumber)

  if (!match) {
    redirect(`/workspaces/matches/${matchNumber}?matchError=not_found`)
  }

  const existingSets = await payload.find({
    collection: 'match-sets',
    depth: 0,
    limit: 1,
    sort: '-set_number',
    where: { match_id: { equals: match.id } },
  })
  const lastSet = existingSets.docs[0] as MinimalMatchSet | undefined
  const nextSetNumber = (lastSet?.set_number || 0) + 1

  await payload.create({
    collection: 'match-sets',
    data: {
      event_id: match.event_id,
      match_id: match.id,
      set_number: nextSetNumber,
      participant_a_score: 0,
      participant_b_score: 0,
    },
  })

  revalidateMatch(matchNumber)
  redirect(`/workspaces/matches/${matchNumber}?matchUpdated=1`)
}
