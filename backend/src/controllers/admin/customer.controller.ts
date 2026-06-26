import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as customerService from "../../services/admin/customer.service.js";

export const listMembers = asyncHandler(async (req, res) => {
  const result = await customerService.listMembers(
    req.tenantId!,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20),
    String(req.query.keyword || "")
  );
  res.json(ok(result));
});

export const createCustomer = asyncHandler(async (req, res) => {
  const result = await customerService.createCustomer(req.tenantId!, req.body);
  res.json(ok(result));
});

export const getCustomerDetail = asyncHandler(async (req, res) => {
  try {
    const result = await customerService.getCustomerDetail(req.tenantId!, Number(req.params.memberId));
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 404).json({ code: String(e.statusCode || 404), message: e.message });
  }
});

export const updateCustomer = asyncHandler(async (req, res) => {
  try {
    const result = await customerService.updateCustomer(req.tenantId!, Number(req.params.memberId), req.body);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 404).json({ code: String(e.statusCode || 404), message: e.message });
  }
});

export const disableCustomer = asyncHandler(async (req, res) => {
  try {
    const result = await customerService.disableCustomer(req.tenantId!, Number(req.params.memberId));
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const assignStaffToCustomer = asyncHandler(async (req, res) => {
  try {
    const result = await customerService.assignStaffToCustomer(
      req.tenantId!,
      Number(req.params.memberId),
      Number(req.body.staffId)
    );
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 404).json({ code: String(e.statusCode || 404), message: e.message });
  }
});

export const getCustomerPriceHistory = asyncHandler(async (req, res) => {
  const result = await customerService.getCustomerPriceHistory(
    req.tenantId!,
    Number(req.params.memberId),
    Number(req.query.skuId)
  );
  res.json(ok(result));
});

export const listCustomerSaleBills = asyncHandler(async (req, res) => {
  const result = await customerService.listCustomerSaleBills(
    req.tenantId!,
    Number(req.params.memberId),
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const listCustomerPayments = asyncHandler(async (req, res) => {
  const result = await customerService.listCustomerPayments(
    req.tenantId!,
    Number(req.params.memberId),
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const listCustomerStatements = asyncHandler(async (req, res) => {
  const result = await customerService.listCustomerStatements(
    req.tenantId!,
    Number(req.params.memberId),
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const getCustomerPurchaseStats = asyncHandler(async (req, res) => {
  const result = await customerService.getCustomerPurchaseStats(req.tenantId!, Number(req.params.memberId));
  res.json(ok(result));
});

export const getCustomerStats = asyncHandler(async (req, res) => {
  const result = await customerService.getCustomerStats(req.tenantId!);
  res.json(ok(result));
});