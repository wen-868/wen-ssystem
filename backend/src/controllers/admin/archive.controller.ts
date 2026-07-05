/**
 * 单据归档控制器（R9-5）
 */
import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok, fail } from "../../shared/response.js";
import * as archiveService from "../../services/admin/archive.service.js";

const archiveSchema = z.object({
  archiveDays: z.coerce.number().int().min(1).max(3650).default(365),
  archiveType: z.enum(["SALE_BILL", "PURCHASE_ORDER", "INVENTORY_LEDGER", "ALL"]).default("ALL"),
  dryRun: z.coerce.boolean().default(true)
});

/** 执行单据归档 */
export const executeArchive = asyncHandler(async (req, res) => {
  const tenantId = (req as any).tenantId;
  const parsed = archiveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(fail("参数校验失败", "400"));
    return;
  }

  const results = await archiveService.archiveBillings({
    tenantId,
    archiveDays: parsed.data.archiveDays,
    archiveType: parsed.data.archiveType,
    dryRun: parsed.data.dryRun
  });

  res.json(ok(results));
});