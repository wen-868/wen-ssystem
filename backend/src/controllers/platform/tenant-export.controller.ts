import { asyncHandler } from "../../middleware/async-handler";
import {
  TENANT_EXPORT_COLUMNS,
  listTenantsForExport,
  toCsvRows,
} from "../../services/platform/tenant-export.service";

/**
 * C1-2 A2：GET /api/platform/tenants/export
 * 租户列表导出（只读）
 *
 * 形态选择依据：沿用仓库既有导出实现（`backend/src/controllers/admin/export.controller.ts`
 * 的 `sendCsv`）—— BOM + `text/csv` + `Content-Disposition: attachment`，不新造导出风格。
 * 行数上限由 service 复用 `constants.MAX_EXPORT_LIMIT` 控制；实际导出行数在响应头回传。
 */

function escapeCsv(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

const today = () => new Date().toISOString().slice(0, 10);

export const exportTenantsCtrl = asyncHandler(async (req, res) => {
  const keyword = req.query.keyword ? String(req.query.keyword) : undefined;
  const result = await listTenantsForExport(keyword);

  const csv = `\uFEFF${[[...TENANT_EXPORT_COLUMNS], ...toCsvRows(result.records)]
    .map((line) => line.map(escapeCsv).join(","))
    .join("\n")}`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="tenants-${today()}.csv"`);
  // 导出上限命中时 total > exported，前端可据此提示「已截断」
  res.setHeader("X-Export-Total", String(result.total));
  res.setHeader("X-Export-Rows", String(result.exported));
  res.send(csv);
});
