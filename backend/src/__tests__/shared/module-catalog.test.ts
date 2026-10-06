/**
 * S3-34：租户模块访问码表 单测
 *
 * 断言目标：写入 t_tenant_module_access 前，module_code 只能取码表英文码；
 * 中文文案（如「采购管理」）必须解析为对应 code，绝不作为 module_code 落库。
 */
import { describe, it, expect } from "vitest";
import {
  TENANT_MODULE_CATALOG,
  TENANT_MODULE_CODES,
  resolveTenantModuleEntry,
  resolveTenantModuleAccess,
} from "../../shared/module-catalog";

describe("shared/module-catalog（S3-34）", () => {
  it("码表为 11 项，来源 = 迁移 016 种子（code/name 一一对应）", () => {
    expect(TENANT_MODULE_CATALOG).toHaveLength(11);
    expect(TENANT_MODULE_CODES.has("purchase")).toBe(true);
    expect(TENANT_MODULE_CODES.has("sales")).toBe(true);
    // 码表内所有 code 必须是纯 ASCII 英文码（不允许中文混入）
    for (const entry of TENANT_MODULE_CATALOG) {
      expect(/^[a-z_]+$/.test(entry.code)).toBe(true);
    }
  });

  it("中文文案解析为英文 code + 原文案 name（写中文不得进 code）", () => {
    expect(resolveTenantModuleEntry("采购管理")).toEqual({ code: "purchase", name: "采购管理" });
    expect(resolveTenantModuleEntry("销售管理")).toEqual({ code: "sales", name: "销售管理" });
  });

  it("英文码解析为 code + 码表中文名", () => {
    expect(resolveTenantModuleEntry("inventory")).toEqual({ code: "inventory", name: "库存管理" });
  });

  it("非码表值（如「成本核算」/空串/非字符串）解析为 null", () => {
    expect(resolveTenantModuleEntry("成本核算")).toBeNull();
    expect(resolveTenantModuleEntry("")).toBeNull();
    expect(resolveTenantModuleEntry(123 as unknown)).toBeNull();
  });

  it("resolveTenantModuleAccess：全部合法时 ok，且按 code 去重", () => {
    const res = resolveTenantModuleAccess(JSON.stringify(["采购管理", "purchase"]));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.modules).toEqual([{ code: "purchase", name: "采购管理" }]);
    }
  });

  it("resolveTenantModuleAccess：任一项非码表值 ⇒ ok=false 并回传非法值（调用方须显式拒绝）", () => {
    const res = resolveTenantModuleAccess(JSON.stringify(["采购管理", "成本核算"]));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.invalid).toEqual(["成本核算"]);
    }
  });

  it("resolveTenantModuleAccess：非法 JSON / 非数组 / 空值 的边界", () => {
    expect(resolveTenantModuleAccess(null)).toEqual({ ok: true, modules: [] });
    expect(resolveTenantModuleAccess("")).toEqual({ ok: true, modules: [] });
    const badJson = resolveTenantModuleAccess("{not json");
    expect(badJson.ok).toBe(false);
    const notArray = resolveTenantModuleAccess(JSON.stringify({ a: 1 }));
    expect(notArray.ok).toBe(false);
  });
});
