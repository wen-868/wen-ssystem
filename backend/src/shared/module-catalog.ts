/**
 * S3-34：租户模块访问码表
 *
 * 事实依据（唯一真相源，不得自拟）：
 *   `docs/migrations/016_phase9_tenant_subscription.sql`
 *     - 表 `t_tenant_module_access.module_code` 注释：'模块编码（如：sales/purchase/inventory/marketing）'
 *     - 同文件「为默认租户授权所有模块」的种子 INSERT：11 组 (module_code, module_name) 逐字转写如下
 *
 * 用途：写入 `t_tenant_module_access` 时，
 *   - `module_code` 只能取本码表的英文码；
 *   - `module_name` 取对应中文文案。
 * 杜绝把中文条目文案（如「采购管理」）同时写进 `module_code` 造成授权链路失配（S3-34）。
 */

export interface TenantModuleEntry {
  /** 英文模块编码（t_tenant_module_access.module_code 唯一合法取值） */
  code: string;
  /** 中文模块文案（module_name） */
  name: string;
}

/** 模块码表（11 项，来源：docs/migrations/016_phase9_tenant_subscription.sql 种子 INSERT） */
export const TENANT_MODULE_CATALOG: readonly TenantModuleEntry[] = [
  { code: "dashboard", name: "工作台" },
  { code: "sales", name: "销售管理" },
  { code: "purchase", name: "采购管理" },
  { code: "inventory", name: "库存管理" },
  { code: "customer", name: "客户管理" },
  { code: "product", name: "商品中心" },
  { code: "credit", name: "财务管理" },
  { code: "report", name: "数据报表" },
  { code: "marketing", name: "营销推广" },
  { code: "instant_retail", name: "即时零售" },
  { code: "approval", name: "审批流程" },
];

/** module_code 合法集合（白名单判据） */
export const TENANT_MODULE_CODES: ReadonlySet<string> = new Set(
  TENANT_MODULE_CATALOG.map((entry) => entry.code)
);

const NAME_BY_CODE = new Map(TENANT_MODULE_CATALOG.map((entry) => [entry.code, entry.name]));
const CODE_BY_NAME = new Map(TENANT_MODULE_CATALOG.map((entry) => [entry.name, entry.code]));

export interface ResolvedTenantModule {
  code: string;
  name: string;
}

/**
 * 把 `module_access` 里的单个值解析为 (code, name)。
 * 合法输入：码表英文码（如 `sales`）或码表中文文案（如「销售管理」）。
 * 非码表值一律返回 null —— 调用方必须显式拒绝，禁止把该值写进 module_code。
 */
export function resolveTenantModuleEntry(raw: unknown): ResolvedTenantModule | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  const nameByCode = NAME_BY_CODE.get(value);
  if (nameByCode) return { code: value, name: nameByCode };
  const codeByName = CODE_BY_NAME.get(value);
  if (codeByName) return { code: codeByName, name: value };
  return null;
}

export type ModuleAccessResolution =
  | { ok: true; modules: ResolvedTenantModule[] }
  | { ok: false; invalid: string[] };

/**
 * 解析套餐 `module_access` JSON 数组（全量），任一值不在码表内即整体拒绝（白名单防御）。
 * - 非法 JSON / 非数组 ⇒ 视为无效值「<非法 JSON>」「<非数组>」；
 * - 同一 code 去重（否则会撞唯一键 uk_tenant_module 变 500）。
 */
export function resolveTenantModuleAccess(rawJson: string | null | undefined): ModuleAccessResolution {
  if (!rawJson) return { ok: true, modules: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, invalid: ["<非法 JSON>"] };
  }
  if (!Array.isArray(parsed)) return { ok: false, invalid: ["<非数组>"] };

  const modules: ResolvedTenantModule[] = [];
  const invalid: string[] = [];
  for (const item of parsed) {
    const resolved = resolveTenantModuleEntry(item);
    if (!resolved) {
      invalid.push(typeof item === "string" ? item : JSON.stringify(item));
      continue;
    }
    if (!modules.some((m) => m.code === resolved.code)) modules.push(resolved);
  }
  if (invalid.length > 0) return { ok: false, invalid };
  return { ok: true, modules };
}
