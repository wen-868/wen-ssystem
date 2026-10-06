/**
 * 批A（Issue #261）路由级运行期证据：真实 HTTP 请求 → 原始响应
 *
 * 覆盖：
 *   S3-29④：POST 创建订阅带 amount/endDate ⇒ 生效；非法值 ⇒ 400（消息可读）
 *   S3-34 ：module_access 中文文案 ⇒ module_code 落英文码；非码表值 ⇒ 400
 *   S3-22 ：GET/PUT /api/platform/config/sys-config 三键写入 → 读回一致
 *   S3-26 ：GET 订阅详情返回 originalAmount 与 logs[].detail
 *
 * 范式：`src/__tests__/fixtures/create-test-app` + `vi.mock("../../shared/db")`。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

const hoisted = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  statements: [] as Array<{ sql: string; params: unknown[] }>,
  sysRow: null as { config_value: string } | null,
}));

vi.mock("../../shared/db", () => ({
  query: hoisted.query,
  queryOne: hoisted.queryOne,
  queryWithTenant: hoisted.queryWithTenant,
  queryOneWithTenant: hoisted.queryOneWithTenant,
  transaction: hoisted.transaction,
}));

vi.mock("../../shared/id", () => ({ makeBizNo: vi.fn(() => "SUB20261006001") }));

// 路由级测试仅验证业务契约，鉴权中间件放行（真实鉴权有独立测试覆盖）
vi.mock("../../middleware/auth", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    requirePlatformAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireAuthWithTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

import { subscriptionRouter } from "../../routes/subscription.routes";
import { platformConfigRouter } from "../../routes/platform-config.routes";

const SUB_PREFIX = "/api/platform/subscriptions-management";
const CFG_PREFIX = "/api/platform/config";

const subApp = createTestApp({ prefix: SUB_PREFIX, router: subscriptionRouter, mockTenantId: "t1" });
const cfgApp = createTestApp({ prefix: CFG_PREFIX, router: platformConfigRouter, mockTenantId: "platform" });

const PLAN_ROW = {
  id: 1, plan_name: "基础版", plan_type: "MONTHLY", price: 299, duration_days: 30, module_access: null as string | null,
};
const TENANT_ROW = { id: 2, company_name: "测试公司", expire_at: "2026-01-01" };

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.statements = [];
  hoisted.sysRow = null;
  hoisted.transaction.mockImplementation(
    async (runner: (conn: unknown) => Promise<unknown>) =>
      runner({
        execute: async (sql: string, params: unknown[] = []) => {
          hoisted.statements.push({ sql, params });
          return [{}, {}];
        },
      })
  );
  // 默认实现：sys-config 读写用（按 SQL 分支），个别用例用 mockResolvedValueOnce 覆盖
  hoisted.queryOne.mockImplementation(async (sql: string) => {
    if (sql.includes("t_platform_config")) return hoisted.sysRow;
    return null;
  });
  hoisted.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("UPDATE t_platform_config")) {
      hoisted.sysRow = { config_value: String(params[0]) };
      return { affectedRows: 1 };
    }
    if (sql.includes("INSERT INTO t_platform_config")) {
      hoisted.sysRow = { config_value: String(params[3]) };
      return { affectedRows: 1, insertId: 1 };
    }
    return {};
  });
});

describe("S3-29④ 创建订阅：amount / endDate 生效与非法拒绝", () => {
  it("传 amount=1500 + endDate=2027-03-01 ⇒ 200，落库值即为所传（原始响应见 assertions）", async () => {
    hoisted.queryOne
      .mockResolvedValueOnce(TENANT_ROW)
      .mockResolvedValueOnce(PLAN_ROW);

    const res = await request(subApp).post(`${SUB_PREFIX}/`).send({
      tenantId: 2, planId: 1, startDate: "2026-10-06", amount: 1500, endDate: "2027-03-01", autoRenew: 0,
    });

    expect(res.status).toBe(200);
    console.log("[RAW][S3-29④ create] ->", JSON.stringify(res.body));
    expect(res.body).toMatchObject({ code: "0", msg: "成功" });
    expect(res.body.data.subscription_no).toBe("SUB20261006001");

    const insert = hoisted.statements.find((s) => s.sql.includes("INSERT INTO t_subscription ("));
    expect(insert!.params[6]).toBe("2027-03-01");
    expect(insert!.params[8]).toBe(1500);
  });

  it("amount=-5 ⇒ 400 + 中文文案（改前：静默丢弃并 200）", async () => {
    const res = await request(subApp).post(`${SUB_PREFIX}/`).send({
      tenantId: 2, planId: 1, startDate: "2026-10-06", amount: -5, autoRenew: 0,
    });
    expect(res.status).toBe(400);
    console.log("[RAW][S3-29④ amount=-5] ->", res.status, JSON.stringify(res.body));
    expect(String(res.body.msg)).toContain("金额");
    expect(hoisted.statements).toHaveLength(0);
  });

  it("endDate 早于 startDate ⇒ 400 + 中文文案", async () => {
    hoisted.queryOne.mockResolvedValueOnce(TENANT_ROW).mockResolvedValueOnce(PLAN_ROW);
    const res = await request(subApp).post(`${SUB_PREFIX}/`).send({
      tenantId: 2, planId: 1, startDate: "2026-10-06", endDate: "2026-10-01", autoRenew: 0,
    });
    expect(res.status).toBe(400);
    console.log("[RAW][S3-29④ endDate<=start] ->", res.status, JSON.stringify(res.body));
    expect(String(res.body.message ?? res.body.msg)).toContain("结束日期");
  });

  it("续费：POST /:id/renew 带 amount/endDate ⇒ 200 且落库生效", async () => {
    hoisted.queryOneWithTenant.mockResolvedValueOnce({
      id: 1, subscription_no: "SUB001", tenant_id: "2", plan_id: 1, plan_name: "基础版",
      end_date: "2026-10-31", price: 299, duration_days: 30, plan_price: 299,
    });
    hoisted.queryOne.mockResolvedValueOnce(PLAN_ROW);

    const res = await request(subApp).post(`${SUB_PREFIX}/1/renew`).send({ amount: 888, endDate: "2027-06-30" });
    expect(res.status).toBe(200);
    const insert = hoisted.statements.find((s) => s.sql.includes("INSERT INTO t_subscription ("));
    expect(insert!.params[6]).toBe("2027-06-30");
    expect(insert!.params[8]).toBe(888);
  });
});

describe("S3-34 module_access 写入收口（运行期）", () => {
  it("中文条目文案 ⇒ t_tenant_module_access.module_code 落英文码（ASCII 硬断言）", async () => {
    hoisted.queryOne
      .mockResolvedValueOnce(TENANT_ROW)
      .mockResolvedValueOnce({ ...PLAN_ROW, module_access: JSON.stringify(["采购管理", "sales"]) });

    const res = await request(subApp).post(`${SUB_PREFIX}/`).send({
      tenantId: 2, planId: 1, startDate: "2026-10-06", autoRenew: 0,
    });
    expect(res.status).toBe(200);

    const moduleInserts = hoisted.statements.filter((s) => s.sql.includes("INSERT INTO t_tenant_module_access"));
    console.log("[RAW][S3-34 module rows] ->", JSON.stringify(moduleInserts.map((s) => s.params)));
    expect(moduleInserts.map((s) => [s.params[1], s.params[2]])).toEqual([
      ["purchase", "采购管理"],
      ["sales", "销售管理"],
    ]);
    for (const s of moduleInserts) {
      expect(/^[\x20-\x7E]+$/.test(String(s.params[1]))).toBe(true);
    }
  });

  it("非码表中文值 ⇒ 400 并列出非法值（禁止污染 module_code）", async () => {
    hoisted.queryOne
      .mockResolvedValueOnce(TENANT_ROW)
      .mockResolvedValueOnce({ ...PLAN_ROW, module_access: JSON.stringify(["成本核算"]) });

    const res = await request(subApp).post(`${SUB_PREFIX}/`).send({
      tenantId: 2, planId: 1, startDate: "2026-10-06", autoRenew: 0,
    });
    expect(res.status).toBe(400);
    expect(String(res.body.message ?? res.body.msg)).toContain("成本核算");
    expect(hoisted.statements).toHaveLength(0);
  });
});

describe("S3-26 订阅详情返回 originalAmount 与 logs[].detail", () => {
  it("GET /:id ⇒ data.originalAmount、data.logs[0].detail 均可见", async () => {
    hoisted.queryOneWithTenant.mockResolvedValueOnce({
      id: 1, subscriptionNo: "SUB001", price: 1500, originalAmount: 299, status: "ACTIVE",
    });
    hoisted.queryWithTenant.mockResolvedValueOnce([
      { id: 1, operationType: "CREATE", amount: 1500, operatorName: "admin", detail: "创建订阅: SUB001", remark: "创建订阅: SUB001", createdAt: "2026-10-06 10:00:00" },
    ]);

    const res = await request(subApp).get(`${SUB_PREFIX}/1`);
    console.log("[RAW][S3-26 detail] ->", JSON.stringify(res.body.data));
    expect(res.status).toBe(200);
    expect(res.body.data.originalAmount).toBe(299);
    expect(res.body.data.logs[0].detail).toBe("创建订阅: SUB001");
  });

  it("列表 SQL 走套餐价原价（防止只改详情漏列表）", async () => {
    hoisted.queryWithTenant.mockResolvedValueOnce([
      { id: 1, subscriptionNo: "SUB001", price: 1500, originalAmount: 299 },
    ]);
    hoisted.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });

    const res = await request(subApp).get(`${SUB_PREFIX}/`).query({ page: 1, pageSize: 10 });
    expect(res.status).toBe(200);
    expect(res.body.data.records[0].originalAmount).toBe(299);
  });
});

describe("S3-22 平台系统配置三键：loginBanner / copyrightInfo / icpNumber", () => {
  it("GET 未配置 ⇒ 三键以空串初值返回且列入 _unconfigured", async () => {
    const res = await request(cfgApp).get(`${CFG_PREFIX}/sys-config`);
    expect(res.status).toBe(200);
    expect(res.body.data.loginBanner).toBe("");
    expect(res.body.data.copyrightInfo).toBe("");
    expect(res.body.data.icpNumber).toBe("");
    expect(res.body.data._unconfigured).toEqual(
      expect.arrayContaining(["loginBanner", "copyrightInfo", "icpNumber"])
    );
  });

  it("PUT → GET 写入读回一致（ICP 备案号可用）", async () => {
    const put = await request(cfgApp).put(`${CFG_PREFIX}/sys-config`).send({
      loginBanner: "让批零生意，全链路智能运转",
      copyrightInfo: "© 2026 智享全链",
      icpNumber: "京ICP备12345678号",
    });
    expect(put.status).toBe(200);
    expect(put.body.code).toBe("0");
    console.log("[RAW][S3-22 PUT stored json] ->", hoisted.sysRow?.config_value);

    const get = await request(cfgApp).get(`${CFG_PREFIX}/sys-config`);
    console.log("[RAW][S3-22 GET body] ->", JSON.stringify(get.body.data));
    expect(get.status).toBe(200);
    expect(get.body.data.loginBanner).toBe("让批零生意，全链路智能运转");
    expect(get.body.data.copyrightInfo).toBe("© 2026 智享全链");
    expect(get.body.data.icpNumber).toBe("京ICP备12345678号");
    expect(get.body.data._unconfigured).not.toContain("icpNumber");
  });
});
