import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as purchaseContractService from "../../services/admin/purchase-contract.service.js";

const createPurchaseContractSchema = z.object({
  supplierId: z.number().int().positive(),
  contractName: z.string().min(1).max(200),
  contractType: z.string().min(1).max(50),
  totalAmount: z.number().min(0),
  signDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  remark: z.string().max(500).optional(),
});

const updatePurchaseContractSchema = z.object({
  contractName: z.string().min(1).max(200).optional(),
  contractType: z.string().min(1).max(50).optional(),
  totalAmount: z.number().min(0).optional(),
  signDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
  remark: z.string().max(500).optional(),
});

const uploadContractFileSchema = z.object({
  fileUrl: z.string().min(1),
});

export const listPurchaseContracts = asyncHandler(async (req, res) => {
  const result = await purchaseContractService.listPurchaseContracts({
    supplierId: req.query.supplierId ? Number(req.query.supplierId) : undefined,
    status: req.query.status as string | undefined,
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const createPurchaseContract = asyncHandler(async (req, res) => {
  const body = createPurchaseContractSchema.parse(req.body);
  const { supplierId, contractName, contractType, totalAmount, signDate, startDate, endDate, remark } = body;
  const result = await purchaseContractService.createPurchaseContract({
    supplierId, contractName, contractType, totalAmount, signDate, startDate, endDate, remark,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const updatePurchaseContract = asyncHandler(async (req, res) => {
  const body = updatePurchaseContractSchema.parse(req.body);
  const { contractName, contractType, totalAmount, signDate, startDate, endDate, status, remark } = body;
  const result = await purchaseContractService.updatePurchaseContract(req.params.contractNo, {
    contractName, contractType, totalAmount, signDate, startDate, endDate, status, remark,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const deletePurchaseContract = asyncHandler(async (req, res) => {
  const result = await purchaseContractService.deletePurchaseContract(req.params.contractNo, req.tenantId!);
  res.json(ok(result));
});

export const uploadContractFile = asyncHandler(async (req, res) => {
  const body = uploadContractFileSchema.parse(req.body);
  const { fileUrl } = body;
  const result = await purchaseContractService.uploadContractFile(req.params.contractNo, fileUrl, req.tenantId!);
  res.json(ok(result));
});