import { prisma } from "../db";

interface AuditParams {
  airlineId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  detail?: string;
}

/** Fire-and-forget audit trail write - never blocks or fails the actual request
 * over a logging hiccup, just logs to console if the write itself fails. */
export function recordAudit(params: AuditParams): void {
  prisma.auditLog
    .create({
      data: {
        airlineId: params.airlineId,
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        detail: params.detail,
      },
    })
    .catch((err) => console.error("Failed to write audit log entry:", err));
}
