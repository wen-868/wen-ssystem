import { writeAuditLog } from "../services/admin/audit.service";
import type { Request } from "express";

export interface LogAuditParams {
  userId: number;
  userName: string;
  role: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  detail?: string;
  tenantId: number;
  req: Request;
}

export function logAudit(p: LogAuditParams): void {
  writeAuditLog(p);
}
