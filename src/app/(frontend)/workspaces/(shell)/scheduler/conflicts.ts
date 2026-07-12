import {
  EntryDoc,
  RelationshipDoc,
  WorkspaceMatch,
  formatStatus,
  getRelationshipId,
  getRelationshipLabel,
} from '../../workspaceComponents'

export type ConflictType =
  | 'venue_overlap'
  | 'participant_overlap'
  | 'missing_schedule_fields'
  | 'invalid_time_range'

export type ConflictWarning = {
  id: string
  type: ConflictType
  severity: 'warn' | 'alert'
  message: string
  matchIds: (string | number)[]
}

const SCHEDULED_LIKE_STATUSES = new Set([
  'scheduled',
  'published',
  'check_in_open',
  'ready_to_start',
  'ongoing',
  'paused',
  'under_review',
  'finished',
  'result_published',
  'disputed',
])

const getTimeRange = (match: WorkspaceMatch) => {
  if (!match.scheduled_start_at) {
    return null
  }

  const start = new Date(match.scheduled_start_at).getTime()
  const end = match.scheduled_end_at ? new Date(match.scheduled_end_at).getTime() : start

  return { start, end: end > start ? end : start }
}

const timeRangesOverlap = (a: WorkspaceMatch, b: WorkspaceMatch) => {
  const rangeA = getTimeRange(a)
  const rangeB = getTimeRange(b)

  if (!rangeA || !rangeB) {
    return false
  }

  return rangeA.start <= rangeB.end && rangeB.start <= rangeA.end
}

const getLocationKey = (match: WorkspaceMatch) => {
  const courtId = getRelationshipId(match.court_id)
  if (courtId) {
    return `court:${courtId}`
  }

  const venueId = getRelationshipId(match.venue_id)
  if (venueId) {
    return `venue:${venueId}`
  }

  return null
}

const getEntryIdentities = (entry: EntryDoc | RelationshipDoc | string | number | null | undefined) => {
  const identities = new Map<string, string>()
  const entryId = getRelationshipId(entry)

  if (!entryId) {
    return identities
  }

  const entryLabel = getRelationshipLabel(entry, 'Participant')
  identities.set(`entry:${entryId}`, entryLabel)

  if (entry && typeof entry === 'object') {
    const club = (entry as EntryDoc).club_id
    const team = (entry as EntryDoc).team_id
    const player = (entry as EntryDoc).player_id

    const clubId = getRelationshipId(club)
    if (clubId) {
      identities.set(`club:${clubId}`, getRelationshipLabel(club, entryLabel))
    }

    const teamId = getRelationshipId(team)
    if (teamId) {
      identities.set(`team:${teamId}`, getRelationshipLabel(team, entryLabel))
    }

    const playerId = getRelationshipId(player)
    if (playerId) {
      identities.set(`player:${playerId}`, getRelationshipLabel(player, entryLabel))
    }
  }

  return identities
}

const findSharedParticipant = (a: WorkspaceMatch, b: WorkspaceMatch) => {
  const participantsA = [a.participant_a_entry_id, a.participant_b_entry_id]
  const participantsB = [b.participant_a_entry_id, b.participant_b_entry_id]

  for (const participantA of participantsA) {
    const identitiesA = getEntryIdentities(participantA)
    if (identitiesA.size === 0) continue

    for (const participantB of participantsB) {
      const identitiesB = getEntryIdentities(participantB)

      for (const [key, label] of identitiesA) {
        if (identitiesB.has(key)) {
          return label
        }
      }
    }
  }

  return null
}

export const detectScheduleConflicts = (matches: WorkspaceMatch[]): ConflictWarning[] => {
  const warnings: ConflictWarning[] = []

  for (const match of matches) {
    if (SCHEDULED_LIKE_STATUSES.has(match.status)) {
      const missing: string[] = []
      if (!getRelationshipId(match.venue_id)) missing.push('venue')
      if (!getRelationshipId(match.court_id)) missing.push('court')
      if (!match.scheduled_start_at) missing.push('start time')

      if (missing.length > 0) {
        warnings.push({
          id: `missing-${match.id}`,
          type: 'missing_schedule_fields',
          severity: 'warn',
          message: `${match.match_number} is ${formatStatus(match.status)} but missing ${missing.join(', ')}.`,
          matchIds: [match.id],
        })
      }
    }

    if (match.scheduled_start_at && match.scheduled_end_at) {
      const start = new Date(match.scheduled_start_at).getTime()
      const end = new Date(match.scheduled_end_at).getTime()

      if (end < start) {
        warnings.push({
          id: `time-range-${match.id}`,
          type: 'invalid_time_range',
          severity: 'alert',
          message: `${match.match_number} has an end time before its start time.`,
          matchIds: [match.id],
        })
      }
    }
  }

  for (let i = 0; i < matches.length; i += 1) {
    for (let j = i + 1; j < matches.length; j += 1) {
      const a = matches[i]
      const b = matches[j]

      if (!timeRangesOverlap(a, b)) continue

      const locationKeyA = getLocationKey(a)
      const locationKeyB = getLocationKey(b)

      if (locationKeyA && locationKeyA === locationKeyB) {
        warnings.push({
          id: `venue-${a.id}-${b.id}`,
          type: 'venue_overlap',
          severity: 'alert',
          message: `${a.match_number} and ${b.match_number} overlap at the same venue/court.`,
          matchIds: [a.id, b.id],
        })
      }

      const sharedParticipant = findSharedParticipant(a, b)
      if (sharedParticipant) {
        warnings.push({
          id: `participant-${a.id}-${b.id}`,
          type: 'participant_overlap',
          severity: 'alert',
          message: `${a.match_number} and ${b.match_number} overlap for ${sharedParticipant}.`,
          matchIds: [a.id, b.id],
        })
      }
    }
  }

  return warnings
}
