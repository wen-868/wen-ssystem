import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as supplierStatementService from "../../services/admin/supplier-statement.service.js";

export const generateSupplierStatement = asyncHandler(async (req, res) => {
  const { supplierId, startDate, endDate } = req.body;
  const result = await supplierStatementService.generateSupplierStatement({
    supplierId, startDate, endDate, tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const listSupplierStatements = asyncHandler(async (req, res) => {
  const result = await supplierStatementService.listSupplierStatements({
    supplierId: req.query.supplierId ? Number(req.query.supplierId) : undefined,
    status: req.query.status as string | undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const getSupplierStatementDetail = asyncHandler(async (req, res) => {
  const result = await supplierStatementService.getSupplierStatementDetail(req.params.statementNo, req.tenantId!);
  res.json(ok(result));
});

export const confirmSupplierStatement = asyncHandler(async (req, res) => {
  const result = await supplierStatementService.confirmSupplierStatement(req.params.statementNo, req.tenantId!);
  res.json(ok(result));
});

export const disputeSupplierStatement = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const result = await supplierStatementService.disputeSupplierStatement(req.params.statementNo, reason, req.tenantId!);
  res.json(ok(result));
});