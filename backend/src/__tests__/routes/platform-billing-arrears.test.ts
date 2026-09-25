/**
 * R101-C4-1b 段一（包B）平台级欠费与增值扣费流水 路由级测试
 * （GET /api/platform/billing/arrears、POST /api/platform/billing/arrears/urge、
 *   GET /api/platform/billing/addon-charges，以及 /generate 的 tenantIds 契约收紧）
 *
 * 范式：`src/__tests__/routes/platform-billing.test.ts`（create-test-app 夹具 + vi.mock("../../shared/db")）。
 * 差异：本文件**不 mock business service**，用例真正穿过 controller + service（因此「stage 派生」
 * 「只在站内写通知」「金额缺载体返回 null 而非 0」都是实现级断言，而不是转发断言）。
 *
 * 反测覆盖（派单卡 §三.3）：
 *   ① 无令牌 ⇒ 401（guardedApp 走真实 requirePlatformAuth）；
 *   ② 参数非法 ⇒ 400（page/pageSize/stage/keyword）；
 *   ③ tenantIds 缺失 / 空数组 / 201 条 ⇒ 400（错误信息可区分）；
 *   ④ 催缴不得触发任何短信/外部通道：探针断言 `sendSms` 调用次数 = 0，且全部写库语句仅为
 *      `INSERT INTO t_notification`（站内通知）。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import { createTestApp } from "../fixtures/create-test-app";

const hoisted = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  poolQuery: vi.fn(),
}));
const dbMocks = {
  query: hoisted.query,
  queryOne: hoisted.queryOne,
};

vi.mock("../../shared/db", () => ({
  query: hoisted.query,
  queryOne: hoisted.queryOne,
  queryWithTenant: hoisted.queryWithTenant,
  pool: { query: hoisted.poolQuery },
}));

/**
 * 短信探针：把短信服务整体替换为桩，用于断言「催缴不接短信通道」。
 * 本用例组结束后 `sendSms` 调用次数必须为 0。
 */
vi.mock("../../services/sms.service", () => ({
  sendSms: vi.fn(),
  sendSmsCode: vi.fn(),
  verifySmsCode: vi.fn(),
  isSmsVerifyEnabled: vi.fn(),
  getSmsConfig: vi.fn(),
  assertSmsConfig: vi.fn(),
  getSmsTemplateCode: vi.fn(),
}));

import { platformBillingArrearsRouter, routeConfig } from "../../routes/platform-billing-arrears.routes";
import { platformBillingRouter } from "../../routes/platform-billing.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const PREFIX = "/api/platform/billing";
const app = createTestApp({ prefix: PREFIX, router: platformBillingArrearsRouter });
const billingApp = createTestApp({ prefix: PREFIX, router: platformBillingRouter });

/** 真实鉴权守卫（无 Authorization ⇒ 401），用于本段 3 条端点的「无令牌」反测 */
const guardedApp = express();
guardedApp.use(express.json());
// S3-119：测试内自建 app 也必须显式挂限流——CodeQL `js/missing-rate-limiting` 只认注册点上内联出现的 `rateLimit(...)`
guardedApp.use(rateLimit({ windowMs: 60_000, max: 10_000 })); // 测试用高上限 10000：避免用例之间互相触发 429
guardedApp.use(PREFIX, requirePlatformAuth, platformBillingArrearsRouter);
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

function resetDbMocks() {
  dbMocks.query.mockReset();
  dbMocks.queryOne.mockReset();
  hoisted.poolQuery.mockReset();
  hoisted.poolQuery.mockResolvedValue([{ insertId: 1 }, null]);
}

function sqlOf(call: unknown[]): string {
  return String(call?.[0] ?? "");
}

function paramsOf(call: unknown[]): unknown[] {
  return (call?.[1] as unknown[]) ?? [];
}

/** 配置文件行（t_platform_config 的 arrears_policy 包） */
function policyRow(payload: Record<string, unknown>) {
  return { id: 1, config_value: JSON.stringify({ version: 1, ...payload }) };
}

/** 今日 - n 天（YYYY-MM-DD，按 UTC 回推，避免时区跨天） */
function dateMinusDays(n: number): string {
  const now = new Date();
  const base = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - n * 86400000;
  return new Date(base).toISOString().slice(0, 10);
}

/** 库中一行平台结算单（DECIMAL 按真实 mysql2 行为返回字符串） */
function settlementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    tenantId: "t1",
    tenantName: "测试酒水商行",
    tenantSub: "T20260924001",
    billNo: "SET2026092410001",
    amount: "1280.50",
    periodStart: "2026-08-01",
    periodEnd: dateMinusDays(10),
    status: "PENDING",
    ...overrides,
  };
}

const FULL_POLICY = {
  graceEndDays: 15,
  degradeEndDays: 30,
  freezeEndDays: 60,
  retainEndDays: 90,
};

describe("C4-1b 段一 路由注册（routeConfig + 端点完整性/顺序）", () => {
  const paths: string[] = (platformBillingArrearsRouter as any).stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => `${Object.keys(layer.route.methods)[0].toLowerCase()} ${layer.route.path}`);

  it("routeConfig：prefix=/api/platform/billing、auth=requirePlatformAuth、router 指向同一实例", () => {
    expect(routeConfig.prefix).toBe(PREFIX);
    expect(routeConfig.auth).toBe("requirePlatformAuth");
    expect(routeConfig.router).toBe(platformBillingArrearsRouter);
  });

  it("3 条端点全部注册在本 router，且静态路径先于任何 :param 通配", () => {
    expect(paths).toEqual(["get /arrears", "post /arrears/urge", "get /addon-charges"]);
    expect(paths.some((path) => path.includes("/:"))).toBe(false);
  });

  it("与包A 同前缀不同文件挂载：包A 6 端点仍在本段文件之外（不互相覆盖）", () => {
    const billingPaths: string[] = (platformBillingRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => `${Object.keys(layer.route.methods)[0].toLowerCase()} ${layer.route.path}`);
    expect(billingPaths).toHaveLength(6);
    expect(paths.some((path) => billingPaths.includes(path))).toBe(false);
  });
});

describe("C4-1b 段一 B-1 GET /arrears（平台级欠费清单）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("200 + 空态 records: []（不造数）+ 策略未配置 ⇒ stage/stageNote/nextAction 如实声明", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(null); // t_platform_config 无 billing:arrears_policy
    dbMocks.query.mockResolvedValueOnce([]);

    const res = await request(app).get(`${PREFIX}/arrears`);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.records).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.amountUnit).toBe("CNY");
    expect(data.amountScale).toBe(2);
    expect(data.stagePolicy.configured).toBe(false);
    expect(data.stagePolicy.note).toContain("不内置任何默认天数");

    // 平台级：SQL 不得带 tenant_id 过滤（严禁读 req.tenantId 的等价断言）
    const sql = sqlOf(dbMocks.query.mock.calls[0]);
    expect(sql).not.toContain("s.tenant_id = ?");
    expect(sql).toContain("FROM t_platform_settlement s");
    expect(sql).toContain("LEFT JOIN t_tenant t ON t.id = s.tenant_id");
    expect(sql).toContain("s.status <> 'CANCELLED'");
    expect(sql).toContain("s.pending_amount > 0");
    expect(paramsOf(dbMocks.query.mock.calls[0])).toEqual([2001]);
  });

  it("策略未配置时即便有欠费行 ⇒ stage/stageNote/nextAction = null（不回落默认天数）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(null);
    dbMocks.query.mockResolvedValueOnce([settlementRow()]);

    const res = await request(app).get(`${PREFIX}/arrears`);
    const row = res.body.data.records[0];

    expect(res.status).toBe(200);
    expect(row.stage).toBeNull();
    expect(row.nextAction).toBeNull();
    expect(row.stageNote).toContain("未完整配置");
    expect(row.amount).toBe(1280.5);
    expect(row.days).toBe(10);
    expect(row.tenantId).toBe("t1");
    expect(row.tenantName).toBe("测试酒水商行");
  });

  it("策略已配置 ⇒ stage/nextAction 由 4 段边界派生（宽限/冻结/待注销三态）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(policyRow(FULL_POLICY));
    dbMocks.query.mockResolvedValueOnce([
      settlementRow({ id: 1, periodEnd: dateMinusDays(10) }),
      settlementRow({ id: 2, periodEnd: dateMinusDays(40) }),
      settlementRow({ id: 3, periodEnd: dateMinusDays(100) }),
    ]);

    const res = await request(app).get(`${PREFIX}/arrears`);
    const rows = res.body.data.records;

    expect(res.status).toBe(200);
    expect(res.body.data.stagePolicy.configured).toBe(true);
    expect(rows.map((row: any) => row.stage)).toEqual(["宽限期", "已冻结", "待注销"]);
    expect(rows.map((row: any) => row.days)).toEqual([10, 40, 100]);
    expect(rows[0].nextAction).toBe("D+15 后功能降级（剩余 5 天）");
    expect(rows[1].nextAction).toBe("D+60 后进入保留期（剩余 20 天）");
    expect(rows[2].nextAction).toBe("已超保留截止 D+90，等待人工确认注销");
    expect(rows[0].stageNote).toBeNull();
  });

  it("stage 过滤（策略已配置）⇒ 只返回该阶段行，total 为过滤后总数", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(policyRow(FULL_POLICY));
    dbMocks.query.mockResolvedValueOnce([
      settlementRow({ id: 1, periodEnd: dateMinusDays(10) }),
      settlementRow({ id: 2, periodEnd: dateMinusDays(40) }),
    ]);

    const res = await request(app).get(`${PREFIX}/arrears`).query({ stage: "已冻结" });

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.records.map((row: any) => row.id)).toEqual([2]);
  });

  it("反测②：stage 过滤但策略未配置 ⇒ 400（不得静默返回空）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(null);

    const res = await request(app).get(`${PREFIX}/arrears`).query({ stage: "功能降级" });

    expect(res.status).toBe(400);
    expect(String(res.body.msg)).toContain("依赖欠费处理策略");
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it("反测②：stage 取值非法 ⇒ 400（不查库）", async () => {
    const res = await request(app).get(`${PREFIX}/arrears`).query({ stage: "不存在的阶段" });

    expect(res.status).toBe(400);
    expect(String(res.body.msg)).toContain("stage 取值非法");
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });

  it("反测②：page=0 / pageSize=101 ⇒ 400（不查库）", async () => {
    const pageZero = await request(app).get(`${PREFIX}/arrears`).query({ page: 0 });
    expect(pageZero.status).toBe(400);

    resetDbMocks();
    const pageSizeOver = await request(app).get(`${PREFIX}/arrears`).query({ pageSize: 101 });
    expect(pageSizeOver.status).toBe(400);

    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });

  it("keyword 过滤参数进入 SQL（租户名/单号模糊匹配），不含 tenant_id 限定", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(null);
    dbMocks.query.mockResolvedValueOnce([]);

    const res = await request(app).get(`${PREFIX}/arrears`).query({ keyword: "酒水" });

    expect(res.status).toBe(200);
    const sql = sqlOf(dbMocks.query.mock.calls[0]);
    expect(sql).toContain("LIKE ?");
    expect(paramsOf(dbMocks.query.mock.calls[0])).toEqual([
      "%酒水%",
      "%酒水%",
      "%酒水%",
      "%酒水%",
      2001,
    ]);
  });

  it("反测①：无令牌 ⇒ 401 且不触达数据库", async () => {
    vi.clearAllMocks();
    resetDbMocks();

    const res = await request(guardedApp).get(`${PREFIX}/arrears`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });
});

describe("C4-1b 段一 B-2 POST /arrears/urge（批量催缴，仅站内）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  function mockUrgeTenant(options: {
    tenant?: Record<string, unknown> | null;
    summary?: Record<string, unknown> | null;
    users?: Array<{ id: number }>;
  }) {
    dbMocks.queryOne.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes("FROM t_tenant")) return options.tenant ?? null;
      if (text.includes("FROM t_platform_settlement")) return options.summary ?? null;
      return null;
    });
    dbMocks.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes("FROM t_sys_user")) return options.users ?? [];
      return [];
    });
  }

  it("200 正向：按租户写站内通知（每个启用管理员 1 条），金额元/2 位小数", async () => {
    mockUrgeTenant({
      tenant: { id: "t1", tenantName: "测试酒水商行" },
      summary: { billCount: 2, amount: "1280.50", dueDate: "2026-08-31", firstBillId: 101 },
      users: [{ id: 7 }, { id: 9 }],
    });

    const res = await request(app).post(`${PREFIX}/arrears/urge`).send({ tenantIds: ["t1"] });
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.channel).toBe("IN_APP");
    expect(data.notifiedTenants).toBe(1);
    expect(data.totalNotifications).toBe(2);
    expect(data.amountUnit).toBe("CNY");
    expect(data.amountScale).toBe(2);
    expect(data.records[0]).toMatchObject({
      tenantId: "t1",
      tenantName: "测试酒水商行",
      status: "NOTIFIED",
      billCount: 2,
      amount: 1280.5,
      dueDate: "2026-08-31",
      notifiedUsers: 2,
    });

    // 站内通知：写 t_notification，recipient_type=ADMIN、type=ALERT、金额 2 位小数
    expect(hoisted.poolQuery).toHaveBeenCalledTimes(2);
    const insertSql = sqlOf(hoisted.poolQuery.mock.calls[0]);
    expect(insertSql).toContain("INSERT INTO t_notification");
    const insertParams = paramsOf(hoisted.poolQuery.mock.calls[0]);
    expect(insertParams[1]).toBe("ADMIN");
    expect(insertParams[2]).toBe("欠费催缴");
    expect(String(insertParams[3])).toContain("1280.50 元");
    expect(insertParams[4]).toBe("ALERT");
    expect(insertParams[7]).toBe("t1");
  });

  it("反测④：催缴不触发短信/任何外部通道（探针：sendSms 调用次数 = 0；写库仅 t_notification）", async () => {
    mockUrgeTenant({
      tenant: { id: "t1", tenantName: "测试酒水商行" },
      summary: { billCount: 1, amount: "10.00", dueDate: "2026-08-31", firstBillId: 101 },
      users: [{ id: 7 }],
    });

    const res = await request(app).post(`${PREFIX}/arrears/urge`).send({ tenantIds: ["t1"] });
    const sms = await import("../../services/sms.service");

    expect(res.status).toBe(200);
    expect(vi.isMockFunction(sms.sendSms)).toBe(true);
    expect((sms.sendSms as any).mock.calls.length).toBe(0);
    expect(res.body.data.channelNote).toContain("不调用短信");

    // 除 t_notification 外没有任何写语句（不存在"绕过探针"的第二个通道）
    for (const call of hoisted.poolQuery.mock.calls) {
      expect(sqlOf(call)).toContain("INSERT INTO t_notification");
    }
    for (const call of dbMocks.query.mock.calls) {
      expect(sqlOf(call).toUpperCase()).not.toContain("INSERT ");
    }
  });

  it("租户不存在 ⇒ TENANT_NOT_FOUND（不写通知、不整批失败）", async () => {
    mockUrgeTenant({ tenant: null });

    const res = await request(app).post(`${PREFIX}/arrears/urge`).send({ tenantIds: ["t404"] });

    expect(res.status).toBe(200);
    expect(res.body.data.records[0]).toMatchObject({ status: "TENANT_NOT_FOUND", notifiedUsers: 0 });
    expect(hoisted.poolQuery).not.toHaveBeenCalled();
  });

  it("无待结算欠费 ⇒ NO_ARREARS（不写通知，不无依据催缴）", async () => {
    mockUrgeTenant({
      tenant: { id: "t1", tenantName: "测试酒水商行" },
      summary: { billCount: 0, amount: "0.00", dueDate: null, firstBillId: null },
      users: [{ id: 7 }],
    });

    const res = await request(app).post(`${PREFIX}/arrears/urge`).send({ tenantIds: ["t1"] });

    expect(res.status).toBe(200);
    expect(res.body.data.records[0]).toMatchObject({ status: "NO_ARREARS", amount: null });
    expect(hoisted.poolQuery).not.toHaveBeenCalled();
  });

  it("租户无启用管理员 ⇒ NO_ACTIVE_ADMIN_USER（不造假收件人）", async () => {
    mockUrgeTenant({
      tenant: { id: "t1", tenantName: "测试酒水商行" },
      summary: { billCount: 1, amount: "10.00", dueDate: "2026-08-31", firstBillId: 101 },
      users: [],
    });

    const res = await request(app).post(`${PREFIX}/arrears/urge`).send({ tenantIds: ["t1"] });

    expect(res.status).toBe(200);
    expect(res.body.data.records[0]).toMatchObject({
      status: "NO_ACTIVE_ADMIN_USER",
      notifiedUsers: 0,
    });
    expect(hoisted.poolQuery).not.toHaveBeenCalled();
  });

  it("重复 tenantIds 去重（requested 记原始条数，uniqueTenants 记去重后条数）", async () => {
    mockUrgeTenant({
      tenant: { id: "t1", tenantName: "测试酒水商行" },
      summary: { billCount: 1, amount: "10.00", dueDate: "2026-08-31", firstBillId: 101 },
      users: [{ id: 7 }],
    });

    const res = await request(app)
      .post(`${PREFIX}/arrears/urge`)
      .send({ tenantIds: ["t1", "t1"] });

    expect(res.status).toBe(200);
    expect(res.body.data.requested).toBe(2);
    expect(res.body.data.uniqueTenants).toBe(1);
    expect(hoisted.poolQuery).toHaveBeenCalledTimes(1);
  });

  it("反测①：无令牌 ⇒ 401 且不触达数据库", async () => {
    vi.clearAllMocks();
    resetDbMocks();

    const res = await request(guardedApp)
      .post(`${PREFIX}/arrears/urge`)
      .send({ tenantIds: ["t1"] });

    expect(res.status).toBe(401);
    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
    expect(hoisted.poolQuery).not.toHaveBeenCalled();
  });

  it("反测③：tenantIds 缺失 / 非数组 / 空数组 ⇒ 400（信息可区分，且不查库）", async () => {
    const missing = await request(app).post(`${PREFIX}/arrears/urge`).send({});
    expect(missing.status).toBe(400);
    expect(String(missing.body.msg)).toContain("tenantIds 必填");
    expect(String(missing.body.msg)).not.toContain("超过上限");

    resetDbMocks();
    const notArray = await request(app).post(`${PREFIX}/arrears/urge`).send({ tenantIds: "t1" });
    expect(notArray.status).toBe(400);
    expect(String(notArray.body.msg)).toContain("收到非数组");

    resetDbMocks();
    const empty = await request(app).post(`${PREFIX}/arrears/urge`).send({ tenantIds: [] });
    expect(empty.status).toBe(400);
    expect(String(empty.body.msg)).toContain("收到空数组");

    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });

  it("反测③：tenantIds 超上限（201 条）⇒ 400，且错误信息与「缺失」不同", async () => {
    const tooMany = Array.from({ length: 201 }, (_v, index) => `t${index + 1}`);

    const res = await request(app).post(`${PREFIX}/arrears/urge`).send({ tenantIds: tooMany });

    expect(res.status).toBe(400);
    expect(String(res.body.msg)).toContain("超过上限");
    expect(String(res.body.msg)).toContain("200");
    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });
});

describe("C4-1b 段一 B-3 GET /addon-charges（增值扣费流水）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("200 + 空态 records: []（表当前无写入方）+ 单位/精度与无载体字段声明", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ total: 0 });
    dbMocks.query.mockResolvedValueOnce([]);

    const res = await request(app).get(`${PREFIX}/addon-charges`);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.records).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.amountUnit).toBe("CNY");
    expect(data.amountScale).toBe(2);
    expect(data.unitPriceScale).toBe(4);
    expect(data.contractNotes.join(" ")).toContain("元/2 位小数");
    expect(data.contractNotes.join(" ")).toContain("无列载体");

    const sql = sqlOf(dbMocks.query.mock.calls[0]);
    expect(sql).toContain("FROM t_platform_addon_charge c");
    expect(sql).toContain("LEFT JOIN t_tenant t ON t.id = c.tenant_id");
    expect(sql).toContain("ORDER BY c.created_at DESC");
  });

  it("NULL 金额/单价 ⇒ 返回 null（不填 0 冒充）；用量 0 是真实语义", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ total: 1 });
    dbMocks.query.mockResolvedValueOnce([
      {
        id: 5,
        serialNo: "ADC202609240001",
        tenantId: "t1",
        tenantName: "测试酒水商行",
        item: "STORAGE",
        unitPrice: null,
        quantity: "0.00",
        amount: null,
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
        status: "PENDING",
        createdAt: "2026-09-24 03:00:00",
      },
    ]);

    const res = await request(app).get(`${PREFIX}/addon-charges`);
    const row = res.body.data.records[0];

    expect(res.status).toBe(200);
    expect(row.unitPrice).toBeNull();
    expect(row.amount).toBeNull();
    expect(row.usage).toBe(0);
    expect(row.method).toBeNull();
    expect(row.relBill).toBeNull();
    expect(row.time).toBe("2026-09-24 03:00:00");
    expect(row.item).toBe("STORAGE");
  });

  it("tenantId / item 筛选进入 SQL 与参数（顺序稳定）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ total: 0 });
    dbMocks.query.mockResolvedValueOnce([]);

    const res = await request(app)
      .get(`${PREFIX}/addon-charges`)
      .query({ tenantId: "t1", item: "API", page: 2, pageSize: 10 });

    expect(res.status).toBe(200);
    const countSql = sqlOf(dbMocks.queryOne.mock.calls[0]);
    expect(countSql).toContain("c.tenant_id = ?");
    expect(countSql).toContain("c.item = ?");
    expect(paramsOf(dbMocks.queryOne.mock.calls[0])).toEqual(["t1", "API"]);
    expect(paramsOf(dbMocks.query.mock.calls[0])).toEqual(["t1", "API", 10, 10]);
  });

  it("反测②：pageSize=0 ⇒ 400（不查库）", async () => {
    const res = await request(app).get(`${PREFIX}/addon-charges`).query({ pageSize: 0 });

    expect(res.status).toBe(400);
    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });

  it("反测①：无令牌 ⇒ 401 且不触达数据库", async () => {
    vi.clearAllMocks();
    resetDbMocks();

    const res = await request(guardedApp).get(`${PREFIX}/addon-charges`);

    expect(res.status).toBe(401);
    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });
});

describe("C4-1b 段一 契约收紧：POST /generate 的 tenantIds（必填 / 上限 200）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("缺失 / 空数组 ⇒ 400（与「超过上限」信息不同）", async () => {
    const missing = await request(billingApp)
      .post(`${PREFIX}/generate`)
      .send({ periodStart: "2026-09-01", periodEnd: "2026-09-30" });
    expect(missing.status).toBe(400);
    expect(String(missing.body.msg)).toContain("tenantIds 必填");

    resetDbMocks();
    const empty = await request(billingApp)
      .post(`${PREFIX}/generate`)
      .send({ periodStart: "2026-09-01", periodEnd: "2026-09-30", tenantIds: [] });
    expect(empty.status).toBe(400);
    expect(String(empty.body.msg)).toContain("收到空数组");

    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });

  it("201 条 ⇒ 400（超过上限）", async () => {
    const tooMany = Array.from({ length: 201 }, (_v, index) => `t${index + 1}`);

    const res = await request(billingApp)
      .post(`${PREFIX}/generate`)
      .send({ periodStart: "2026-09-01", periodEnd: "2026-09-30", tenantIds: tooMany });

    expect(res.status).toBe(400);
    expect(String(res.body.msg)).toContain("超过上限");
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it("200 条（上限内）⇒ 放行并逐租户生成（不再退化为全租户）", async () => {
    const ids = Array.from({ length: 200 }, (_v, index) => `t${index + 1}`);
    dbMocks.queryOne.mockResolvedValue(null);
    dbMocks.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes("INSERT INTO t_platform_settlement")) {
        return { insertId: 1, affectedRows: 1 };
      }
      return [];
    });

    const res = await request(billingApp)
      .post(`${PREFIX}/generate`)
      .send({ periodStart: "2026-09-01", periodEnd: "2026-09-30", tenantIds: ids });

    expect(res.status).toBe(200);
    expect(res.body.data.records).toHaveLength(200);
    expect(dbMocks.query.mock.calls.some((call) => sqlOf(call).includes("FROM t_tenant"))).toBe(false);
  });
});
