import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as purchaseContractService from "../../services/admin/purchase-contract.service.js";

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
  const { supplierId, contractName, contractType, totalAmount, signDate, startDate, endDate, remark } = req.body;
  const result = await purchaseContractService.createPurchaseContract({
    supplierId, contractName, contractType, totalAmount, signDate, startDate, endDate, remark,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const updatePurchaseContract = asyncHandler(async (req, res) => {
  const { contractName, contractType, totalAmount, signDate, startDate, endDate, status, remark } = req.body;
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
  const { fileUrl } = req.body;
  const result = await purchaseContractService.uploadContractFile(req.params.contractNo, fileUrl, req.tenantId!);
  res.json(ok(result));
});