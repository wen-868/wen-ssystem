import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import {
  exportProductsData,
  exportCustomersData,
  importCustomersCsv,
} from "../../services/admin/data-transfer.service";

export const exportProductsHandler = asyncHandler(async (req, res) => {
  const keyword = String(req.query.keyword || "");
  const rows = await exportProductsData(req.tenantId!, keyword || undefined);
  res.json(ok(rows));
});

export const exportCustomersHandler = asyncHandler(async (req, res) => {
  const keyword = String(req.query.keyword || "");
  const rows = await exportCustomersData(req.tenantId!, keyword || undefined);
  res.json(ok(rows));
});

export const importCustomersHandler = asyncHandler(async (req, res) => {
  const { csv } = req.body || {};
  if (!csv || typeof csv !== "string") {
    res.status(400).json({ success: false, code: "400", message: "请上传 CSV 内容" });
    return;
  }
  const result = await importCustomersCsv(csv, req.tenantId!);
  res.json(ok(result));
});
