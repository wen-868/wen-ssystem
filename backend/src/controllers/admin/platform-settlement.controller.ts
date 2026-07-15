import { z } from "zod";
import { ok } from "../../shared/response";
import * as settlementService from "../../services/admin/platform-settlement.service";

export async function listSettlements(req: any, res: any) {
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    status: z.string().optional(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
    tenantName: z.string().optional(),
  }).parse(req.query);
  const result = await settlementService.listSettlements(params);
  res.json(ok(result));
}

export async function getSettlementById(req: any, res: any) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await settlementService.getSettlementById(id);
  res.json(ok(result));
}

export async function createSettlement(req: any, res: any) {
  const data = z.object({
    tenantId: z.string().min(1),
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
    totalAmount: z.coerce.number().min(0),
    remark: z.string().optional(),
  }).parse(req.body);
  const result = await settlementService.createSettlement(data);
  res.json(ok(result));
}

export async function updateSettlementStatus(req: any, res: any) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { status } = z.object({
    status: z.string().min(1),
  }).parse(req.body);
  const result = await settlementService.updateSettlementStatus(id, status);
  res.json(ok(result));
}

export async function getSettlementStats(req: any, res: any) {
  const result = await settlementService.getSettlementStats();
  res.json(ok(result));
}
