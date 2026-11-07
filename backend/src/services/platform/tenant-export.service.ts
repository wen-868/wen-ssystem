import { constants } from "../../config/constants";
import { listTenants, type TenantRecord } from "../platform-tenant.service";
// TOTAL-TENANT-NAME-SERVER-TRUTH-01：导出与列表/详情共用同一名称真源单点
// （enrichTenantRecords 补 name/companyName/tenantDisplayName；resolveTenantDisplayName 回退链）。
import {
  enrichTenantRecords,
  resolveTenantDisplayName,
  type TenantDisplayNameFields,
} from "./tenant-admin.service";

/** 导出行 = 列表行 + 名称真源三字段（enrichTenantRecords 补齐） */
export type TenantExportRecord = TenantRecord & Partial<TenantDisplayNameFields>;

/**
 * C1-2 A2：租户列表导出（只读）
 *
 * 口径：与列表接口**完全同源** —— 直接复用 `platform-tenant.service.listTenants()`，
 * 不另写一份 SQL，避免「导出与列表口径漂移」（项目标准第零章第 3 条：公共逻辑只写一次）。
 * 列表当前只支持 `keyword` 筛选（`backend/src/services/platform-tenant.service.ts:32-58`，
 * SQL 未出现 status/plan/expire 条件），故导出同样只透传 keyword；其余筛选参数
 * 在列表上本就不生效，导出保持一致（不虚构「已按状态导出」的能力）。
 *
 * 上限：`config/constants.ts` 的 `MAX_EXPORT_LIMIT`（5000 行），不做无界导出。
 */

export const TENANT_EXPORT_COLUMNS = [
  "ID",
  "租户编码",
  "租户名称",
  "联系人",
  "联系电话",
  "联系邮箱",
  "状态",
  "到期时间",
  "创建时间",
] as const;

export interface TenantExportResult {
  total: number;
  exported: number;
  columns: string[];
  records: TenantExportRecord[];
}

export async function listTenantsForExport(keyword?: string): Promise<TenantExportResult> {
  const result = await listTenants(1, constants.MAX_EXPORT_LIMIT, keyword);
  // 与列表接口同一单点补齐（导出同源）：空名回退链 + 「未命名租户」兜底在 enrichTenantRecords 内实现
  const records = await enrichTenantRecords(result.records);
  return {
    total: result.total,
    exported: records.length,
    columns: [...TENANT_EXPORT_COLUMNS],
    records,
  };
}

/** 单元格格式化：日期统一 `YYYY-MM-DD HH:mm:ss`，null/undefined → 空串 */
export function formatCell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  return String(value);
}

export function toCsvRows(records: TenantExportRecord[]): string[][] {
  return records.map((r) => [
    formatCell(r.id),
    formatCell(r.tenantCode),
    // 名称真源：与列表/详情同一回退链（tenantName→name→companyName→「未命名租户」），
    // 空名不落「—」占位；tenantName 有真值时结果与原口径一致（formatCell(tenantName)）
    formatCell(resolveTenantDisplayName(r.tenantName, r.name, r.companyName)),
    formatCell(r.contactName),
    // 标识/联系字段：空值透传为空串（formatCell null → ""），不产生「—」
    formatCell(r.contactMobile),
    formatCell(r.contactEmail),
    formatCell(r.status),
    formatCell(r.expireAt),
    formatCell(r.createdAt),
  ]);
}
