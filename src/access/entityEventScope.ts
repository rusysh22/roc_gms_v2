import type { Payload } from 'payload'

import { getRelationId } from './eventMembership'

// Comments and AuditLogs both point at an arbitrary target via (entity_type, entity_id) rather
// than a real relationship, so neither could be scoped per-event the way every other collection is
// (AUDIT_TOURNAMENT_STANDARDS SEC-04 / SEC-05). This denormalises the owning event id from the
// target at write time, so a stored `event_id` can then be filtered by scopedToUserEvents.
//
// Best-effort: an unknown entity type, a deleted target, or a target with no event of its own all
// resolve to null (the row is stored unscoped and stays visible only to super_admin via the
// scoped-read filter). Never throws.
export const resolveEventIdForEntity = async (
  payload: Payload,
  entityType: string,
  entityId: string | number,
): Promise<number | null> => {
  if (!entityType || entityId === '' || entityId == null) return null

  // The target IS an event.
  if (entityType === 'events') {
    const n = Number(entityId)
    return Number.isFinite(n) ? n : null
  }

  try {
    const doc = await payload.findByID({
      collection: entityType as never,
      id: entityId,
      depth: 0,
    })
    const eventId = getRelationId((doc as { event_id?: unknown }).event_id)
    const n = Number(eventId)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}
