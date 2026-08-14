import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/customer-merge.service";

export const detectDuplicates = asyncHandler(async (req, res) => {
  const type = String(req.query.type || "mobile");
  const result = await service.detectDuplicates(req.tenantId!, type);
  res.json(ok(result));
});

export const getCustomerRelations = asyncHandler(async (req, res) => {
  const result = await service.getCustomerRelations(req.tenantId!, Number(req.params.customerId));
  res.json(ok(result));
});

export const mergeCustomers = asyncHandler(async (req, res) => {
  const body = z.object({
    primaryCustomerId: z.number().int().positive(),
    duplicateCustomerIds: z.array(z.number().int().positive()).min(1),
    mergeName: z.boolean().default(true),
    mergeMobile: z.boolean().default(true),
    mergeAddress: z.boolean().default(true),
    mergeRemark: z.boolean().default(false),
  }).parse(req.body);

  const result = await service.mergeCustomers(req.tenantId!, body, req.user!.id, req.user!.username);
  res.json(ok(result));
});

export const getDuplicateGroups = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const result = await service.getDuplicateGroups(req.tenantId!, page, pageSize);
  res.json(ok(result));
});