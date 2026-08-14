import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as reconciliationService from "../../services/admin/reconciliation.service";

export const getCustomerReconciliation = asyncHandler(async (req, res) => {
  res.json(ok(await reconciliationService.getCustomerReconciliation(req.tenantId!, req.query.startDate as string | undefined, req.query.endDate as string | undefined)));
});
export const getCustomerReconciliationDetail = asyncHandler(async (req, res) => {
  res.json(ok(await reconciliationService.getCustomerReconciliationDetail(Number(req.params.customerId), req.tenantId!, req.query.startDate as string | undefined, req.query.endDate as string | undefined)));
});
export const confirmCustomerReconciliation = asyncHandler(async (req, res) => { res.json(ok(await reconciliationService.confirmCustomerReconciliation(Number(req.params.customerId), req.tenantId!))); });
export const getSupplierReconciliation = asyncHandler(async (req, res) => {
  res.json(ok(await reconciliationService.getSupplierReconciliation(req.tenantId!, req.query.startDate as string | undefined, req.query.endDate as string | undefined)));
});
export const getSupplierReconciliationDetail = asyncHandler(async (req, res) => {
  res.json(ok(await reconciliationService.getSupplierReconciliationDetail(Number(req.params.supplierId), req.tenantId!, req.query.startDate as string | undefined, req.query.endDate as string | undefined)));
});
export const confirmSupplierReconciliation = asyncHandler(async (req, res) => { res.json(ok(await reconciliationService.confirmSupplierReconciliation(Number(req.params.supplierId), req.tenantId!))); });