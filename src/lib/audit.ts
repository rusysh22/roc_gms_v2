import type { Payload } from 'payload'

// Matches the audit-logs collection's json field type exactly - `unknown` (what callers pass as
// before/after snapshots) is intentionally broader than this, so it needs a boundary cast rather
// than a structural match.
type JsonValue = string | number | boolean | unknown[] | Record<string, unknown> | null

type RecordAuditLogParams = {
  payload: Payload
  action: string
  entityType: string
  entityId: string | number
  before?: unknown
  after?: unknown
  actorUserId?: string | number | null
}

export const recordAuditLog = async ({
  payload,
  action,
  entityType,
  entityId,
  before,
  after,
  actorUserId,
}: RecordAuditLogParams): Promise<void> => {
  try {
    await payload.create({
      collection: 'audit-logs',
      data: {
        actor_user_id: actorUserId ? Number(actorUserId) : undefined,
        action,
        entity_type: entityType,
        entity_id: String(entityId),
        before_snapshot: (before ?? null) as JsonValue,
        after_snapshot: (after ?? null) as JsonValue,
      },
    })
  } catch (error) {
    payload.logger.error(
      `Failed to record audit log for ${action} on ${entityType}:${entityId}: ${error}`,
    )
  }
}
