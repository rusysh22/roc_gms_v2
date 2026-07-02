import type { Payload } from 'payload'

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
        actor_user_id: actorUserId || undefined,
        action,
        entity_type: entityType,
        entity_id: String(entityId),
        before_snapshot: before ?? null,
        after_snapshot: after ?? null,
      },
    })
  } catch (error) {
    payload.logger.error(
      `Failed to record audit log for ${action} on ${entityType}:${entityId}: ${error}`,
    )
  }
}
