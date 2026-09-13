/**
 * 租户资源配额 service 单元测试（R101-S2-01 批 4）
 * 被测文件：src/services/platform/tenant-quota.service.ts
 *
 * 重点断言（契约 docs/API接口文档.md · GET /api/platform/tenants/:id/quota）：
 *  - 字节→GB 换算在后端完成、保留 2 位小数；
 *  - storage 限额：config MB→折 GB、GB→原值、两者都取不到时回退套餐 max_storage_mb（MB→GB）；
 *  - aiMonthly monthly_chat_limit = 0 → limit null + unlimited true；
 *  - apiDaily 恒 null，且 unavailable 含 { key: "apiDaily" }；
 *  - 无订阅 → planName "" 且各 limit null（used 仍返回真实计数）；
 *  - 查询返回 null/undefined 时计数回落 0（不出现 NaN）；
 *  - 六个键永远都在 quota 里（含 null 的 apiDaily）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

import { getTenantQuota } from "../../../services/platform/tenant-quota.service";

// 各测试可覆写的输入
let planRow: any = null;
let storageCfgRow: any = null;
let aiBillingRow: any = null;
let accountsTotal: any = 0;
let productsTotal: any = 0;
let storesTotal: any = 0;
let storageBytes: any = 0;
let aiUsed: any = 0;

beforeEach(() => {
  vi.clearAllMocks();
  planRow = null;
  storageCfgRow = null;
  aiBillingRow = null;
  accountsTotal = 0;
  productsTotal = 0;
  storesTotal = 0;
  storageBytes = 0;
  aiUsed = 0;

  // 按 SQL 关键字分发，顺序无关
  mocks.queryOne.mockImplementation(async (sql: string) => {
    if (sql.includes("JOIN t_subscription_plan")) return planRow;
    if (sql.includes("t_tenant_config")) return storageCfgRow;
    if (sql.includes("t_tenant_ai_billing")) return aiBillingRow;
    if (sql.includes("t_sys_user")) return { total: accountsTotal };
    if (sql.includes("t_product_spu")) return { total: productsTotal };
    if (sql.includes("t_store")) return { total: storesTotal };
    if (sql.includes("t_upload_file")) return { total: storageBytes };
    if (sql.includes("t_ai_usage_daily")) return { total: aiUsed };
    return null;
  });
});

describe("tenant-quota.service · getTenantQuota（批 4）", () => {
  it("字节→GB 换算：1073741824 字节 = 1 GB，且保留 2 位小数", async () => {
    planRow = { planName: "旗舰版", maxUsers: 30, maxStores: 20, maxProducts: 100000, maxStorageMb: 102400 };
    storageBytes = 1073741824; // 1 GB
    const r = await getTenantQuota("t-001");

    expect(r.quota.storage.used).toBe(1);
    expect(r.quota.storage.unit).toBe("GB");
  });

  it("字节→GB 换算保留两位小数（1.5 GB）", async () => {
    planRow = { planName: "旗舰版", maxUsers: 30, maxStores: 20, maxProducts: 100000, maxStorageMb: 102400 };
    storageBytes = 1610612736; // 1.5 GB
    const r = await getTenantQuota("t-001");

    expect(r.quota.storage.used).toBe(1.5);
  });

  it("storage 限额：storage_limit_unit='MB' → 折 GB", async () => {
    planRow = { planName: "旗舰版", maxUsers: 30, maxStores: 20, maxProducts: 100000, maxStorageMb: 102400 };
    storageCfgRow = { storage_limit: 1024, storage_limit_unit: "MB" }; // 1024 MB = 1 GB
    const r = await getTenantQuota("t-001");

    expect(r.quota.storage.limit).toBe(1);
  });

  it("storage 限额：storage_limit_unit='GB' → 原值", async () => {
    planRow = { planName: "旗舰版", maxUsers: 30, maxStores: 20, maxProducts: 100000, maxStorageMb: 102400 };
    storageCfgRow = { storage_limit: 100, storage_limit_unit: "GB" };
    const r = await getTenantQuota("t-001");

    expect(r.quota.storage.limit).toBe(100);
  });

  it("storage 限额：config 与 unit 都取不到 → 回退套餐 max_storage_mb（MB→GB）", async () => {
    planRow = { planName: "旗舰版", maxUsers: 30, maxStores: 20, maxProducts: 100000, maxStorageMb: 102400 }; // 100 GB
    storageCfgRow = null;
    const r = await getTenantQuota("t-001");

    expect(r.quota.storage.limit).toBe(100);
  });

  it("aiMonthly：monthly_chat_limit = 0 → limit null 且 unlimited true", async () => {
    planRow = { planName: "旗舰版", maxUsers: 30, maxStores: 20, maxProducts: 100000, maxStorageMb: 102400 };
    aiBillingRow = { monthly_chat_limit: 0 };
    aiUsed = 7420;
    const r = await getTenantQuota("t-001");

    expect(r.quota.aiMonthly.limit).toBeNull();
    expect(r.quota.aiMonthly.unlimited).toBe(true);
    expect(r.quota.aiMonthly.used).toBe(7420);
    expect(r.quota.aiMonthly.unit).toBe("次·月");
  });

  it("aiMonthly：monthly_chat_limit 为正数 → limit 为该值、无 unlimited", async () => {
    planRow = { planName: "旗舰版", maxUsers: 30, maxStores: 20, maxProducts: 100000, maxStorageMb: 102400 };
    aiBillingRow = { monthly_chat_limit: 10000 };
    aiUsed = 7420;
    const r = await getTenantQuota("t-001");

    expect(r.quota.aiMonthly.limit).toBe(10000);
    expect(r.quota.aiMonthly.unlimited).toBeUndefined();
  });

  it("apiDaily 恒为 null，且 unavailable 含 { key: 'apiDaily' }", async () => {
    planRow = { planName: "旗舰版", maxUsers: 30, maxStores: 20, maxProducts: 100000, maxStorageMb: 102400 };
    const r = await getTenantQuota("t-001");

    expect(r.quota.apiDaily).toBeNull();
    expect(r.unavailable).toContainEqual({
      key: "apiDaily",
      reason: "后端无 API 调用计数数据源（无调用计数表）",
    });
  });

  it("无订阅 → planName 为 '' 且各 limit 为 null（used 仍返回真实计数）", async () => {
    planRow = null;
    accountsTotal = 13;
    productsTotal = 26540;
    storesTotal = 8;
    storageBytes = 32212254720; // 30 GB
    aiBillingRow = null;
    aiUsed = 0;
    const r = await getTenantQuota("t-002");

    expect(r.planName).toBe("");
    expect(r.quota.accounts.limit).toBeNull();
    expect(r.quota.products.limit).toBeNull();
    expect(r.quota.stores.limit).toBeNull();
    expect(r.quota.storage.limit).toBeNull();
    expect(r.quota.aiMonthly.limit).toBeNull();
    // used 仍为真实计数（非 0 回落）
    expect(r.quota.accounts.used).toBe(13);
    expect(r.quota.products.used).toBe(26540);
    expect(r.quota.stores.used).toBe(8);
    expect(r.quota.storage.used).toBe(30);
    expect(r.quota.aiMonthly.unlimited).toBeUndefined();
  });

  it("查询返回 null/undefined 时计数回落 0，不出现 NaN", async () => {
    // 所有计数为 null（DB 未返回行）
    planRow = { planName: "标准版", maxUsers: 10, maxStores: 5, maxProducts: 1000, maxStorageMb: 1024 };
    accountsTotal = null;
    productsTotal = undefined;
    storesTotal = null;
    storageBytes = null;
    aiUsed = null;
    const r = await getTenantQuota("t-003");

    expect(r.quota.accounts.used).toBe(0);
    expect(r.quota.products.used).toBe(0);
    expect(r.quota.stores.used).toBe(0);
    expect(r.quota.storage.used).toBe(0);
    expect(r.quota.aiMonthly.used).toBe(0);
    // 有订阅则 limit 取套餐值（数字、非 null）
    expect(r.quota.accounts.limit).toBe(10);
  });

  it("quota 六个键永远都在（含 null 的 apiDaily 与 aiMonthly 非 null 时）", async () => {
    planRow = { planName: "旗舰版", maxUsers: 30, maxStores: 20, maxProducts: 100000, maxStorageMb: 102400 };
    aiBillingRow = { monthly_chat_limit: 10000 };
    const r = await getTenantQuota("t-001");

    expect(Object.keys(r.quota).sort()).toEqual(
      ["accounts", "aiMonthly", "apiDaily", "products", "stores", "storage"].sort()
    );
    expect(r.quota.apiDaily).toBeNull();
  });

  it("storage 限额：storage_limit_unit='TB' → 折 GB（lim×1024）", async () => {
    planRow = { planName: "旗舰版", maxUsers: 30, maxStores: 20, maxProducts: 100000, maxStorageMb: 102400 };
    storageCfgRow = { storage_limit: 2, storage_limit_unit: "TB" };
    const r = await getTenantQuota("t-001");

    expect(r.quota.storage.limit).toBe(2048);
  });

  it("SQL 口径钉死：stores 仅计 store_type='WAREHOUSE'；storage 配置按 config_key='storage_limit' 定位", async () => {
    planRow = { planName: "旗舰版", maxUsers: 30, maxStores: 20, maxProducts: 100000, maxStorageMb: 102400 };
    storageCfgRow = { storage_limit: 512, storage_limit_unit: "GB" };
    await getTenantQuota("t-001");

    const sqls = mocks.queryOne.mock.calls.map((c) => String(c[0]));
    const storeSql = sqls.find((s) => s.includes("t_store"));
    expect(storeSql).toBeTruthy();
    expect(storeSql).toContain("store_type = 'WAREHOUSE'");

    const cfgSql = sqls.find((s) => s.includes("t_tenant_config"));
    expect(cfgSql).toBeTruthy();
    expect(cfgSql).toContain("config_key = 'storage_limit'");
  });
});
