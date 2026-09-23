/**
 * R101-C4-1 包A 平台级财务对账与账单 6 端点路由级测试
 * （/api/platform/billing/reconciliation-daily*、/generate、/statement/export、/invoice）
 *
 * 范式：`src/__tests__/routes/platform-open-api-keys.test.ts`（create-test-app 夹具 + vi.mock("../../shared/db")）。
 * 差异：本文件**不 mock service**，用例真正穿过 controller + service（因此「DECIMAL 出口归一」「幂等只出一单」
 * 「导出空态只回表头」「金额单位随响应带出」都是实现级断言，而不是转发断言）。
 *
 * 每个用例开始前 `mockReset()` 两个 DB mock —— 依据 C3-1d 实测根因：`clearAllMocks()` 不清
 * `mockResolvedValueOnce` 的待消费队列，残留值会让后续用例的返回值整体错位。
 *
 * 注意：本沙箱 vitest 无法启动（`spawn EPERM`，C2-0/C3-0/凌舟已重复实测，勿重试）；用例写好，
 *       首次真跑由凌舟在本机执行（派单卡「三、验收标准」第 2 条）。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { createTestApp } from "../fixtures/create-test-app";

const hoisted = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));
const dbMocks = { query: hoisted.query, queryOne: hoisted.queryOne };

vi.mock("../../shared/db", () => ({
  query: hoisted.query,
  queryOne: hoisted.queryOne,
}));

import { platformBillingRouter, routeConfig } from "../../routes/platform-billing.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const PREFIX = "/api/platform/billing";
const app = createTestApp({ prefix: PREFIX, router: platformBillingRouter });

/** 真实鉴权守卫（无 Authorization ⇒ 401），用于 6 条端点的「无令牌」反测 */
const guardedApp = express();
guardedApp.use(express.json());
guardedApp.use(PREFIX, requirePlatformAuth, platformBillingRouter);
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

function resetDbMocks() {
  dbMocks.query.mockReset();
  dbMocks.queryOne.mockReset();
}

function sqlOf(call: unknown[]): string {
  return String(call?.[0] ?? "");
}

function paramsOf(call: unknown[]): unknown[] {
  return (call?.[1] as unknown[]) ?? [];
}

/** 库中的一行日对账（DECIMAL 按真实 mysql2 行为返回**字符串**，DATE/DATETIME 返回字符串或 Date） */
function dailyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    platform: "MEITUAN",
    reconciliationDate: "2026-09-20",
    platformOrderCount: 120,
    platformAmount: "1234.50",
    systemOrderCount: 118,
    systemAmount: "1200.00",
    diffCount: 2,
    diffAmount: "34.50",
    commissionAmount: null,
    status: "DIFF",
    updatedAt: "2026-09-21 03:00:00",
    ...overrides,
  };
}

describe("C4-1 包A 路由注册（routeConfig + 端点完整性/顺序）", () => {
  const paths = (platformBillingRouter as any).stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => `${Object.keys(layer.route.methods)[0].toLowerCase()} ${layer.route.path}`);

  it("routeConfig：prefix=/api/platform/billing、auth=requirePlatformAuth、router 指向同一实例", () => {
    expect(routeConfig.prefix).toBe(PREFIX);
    expect(routeConfig.auth).toBe("requirePlatformAuth");
    expect(routeConfig.router).toBe(platformBillingRouter);
  });

  it("6 条端点全部注册在本 router，且静态路径排在 :date 通配之前", () => {
    expect(paths).toEqual([
      "get /reconciliation-daily",
      "get /reconciliation-daily/:date/statement",
      "get /reconciliation-daily/:date/diff",
      "post /generate",
      "post /statement/export",
      "post /invoice",
    ]);
  });
});

describe("C4-1 包A #A-1 GET /reconciliation-daily（平台级日对账列表）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("200 + 空态 records: []（不造数）+ 显式金额单位与精度", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ total: 0 });
    dbMocks.query.mockResolvedValueOnce([]);

    const res = await request(app).get(`${PREFIX}/reconciliation-daily`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.records).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(20);
    expect(res.body.data.amountUnit).toBe("CNY");
    expect(res.body.data.amountScale).toBe(2);
  });

  it("200 + 平台级口径：SQL 不含 tenant_id 过滤，DECIMAL 字符串归一为 number", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ total: 2 });
    dbMocks.query.mockResolvedValueOnce([dailyRow(), dailyRow({ id: 8, platform: "DOUYIN" })]);

    const res = await request(app).get(`${PREFIX}/reconciliation-daily`);
    const record = res.body.data.records[0];

    expect(res.status).toBe(200);
    expect(record).toEqual({
      id: 7,
      platform: "MEITUAN",
      date: "2026-09-20",
      platformOrderCount: 120,
      platformAmount: 1234.5,
      systemOrderCount: 118,
      systemAmount: 1200,
      diffCount: 2,
      diffAmount: 34.5,
      commissionAmount: null,
      status: "DIFF",
      updatedAt: "2026-09-21 03:00:00",
    });
    expect(typeof record.platformAmount).toBe("number");
    // 平台级口径：不得按租户过滤（t_platform_reconciliation.tenant_id 语义待 S3-91 收口）
    expect(sqlOf(dbMocks.queryOne.mock.calls[0])).not.toContain("tenant_id");
    expect(sqlOf(dbMocks.query.mock.calls[0])).not.toContain("tenant_id");
    expect(sqlOf(dbMocks.query.mock.calls[0])).toContain("ORDER BY reconciliation_date DESC");
  });

  it("筛选与分页透传为 SQL 条件（dateStart/dateEnd/status/platform/page/pageSize）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ total: 0 });
    dbMocks.query.mockResolvedValueOnce([]);

    const res = await request(app).get(
      `${PREFIX}/reconciliation-daily?dateStart=2026-09-01&dateEnd=2026-09-30&status=DIFF&platform=MEITUAN&page=2&pageSize=10`
    );

    expect(res.status).toBe(200);
    const countSql = sqlOf(dbMocks.queryOne.mock.calls[0]);
    expect(countSql).toContain("reconciliation_date >= ?");
    expect(countSql).toContain("reconciliation_date <= ?");
    expect(countSql).toContain("status = ?");
    expect(countSql).toContain("platform = ?");
    expect(paramsOf(dbMocks.queryOne.mock.calls[0])).toEqual([
      "2026-09-01",
      "2026-09-30",
      "DIFF",
      "MEITUAN",
    ]);
    expect(paramsOf(dbMocks.query.mock.calls[0])).toEqual([
      "2026-09-01",
      "2026-09-30",
      "DIFF",
      "MEITUAN",
      10,
      10,
    ]);
    expect(res.body.data.page).toBe(2);
    expect(res.body.data.pageSize).toBe(10);
  });

  it("dateStart > dateEnd ⇒ 400（不查库）", async () => {
    const res = await request(app).get(
      `${PREFIX}/reconciliation-daily?dateStart=2026-09-30&dateEnd=2026-09-01`
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("400");
    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });

  it("非法日期（2026-02-30）⇒ 400（不查库）", async () => {
    const res = await request(app).get(`${PREFIX}/reconciliation-daily?dateStart=2026-02-30`);

    expect(res.status).toBe(400);
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it("pageSize 越界（101）⇒ 400（不查库）", async () => {
    const res = await request(app).get(`${PREFIX}/reconciliation-daily?pageSize=101`);

    expect(res.status).toBe(400);
    expect(dbMocks.query).not.toHaveBeenCalled();
  });
});

describe("C4-1 包A #A-2 GET /reconciliation-daily/:date/statement（当日对账单 CSV）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("200 + text/csv + attachment 文件名 + BOM + 数据行 + X-Export-Rows", async () => {
    dbMocks.query.mockResolvedValueOnce([dailyRow()]);

    const res = await request(app).get(`${PREFIX}/reconciliation-daily/2026-09-20/statement`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-type"]).toContain("charset=utf-8");
    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="reconciliation-statement-2026-09-20.csv"'
    );
    expect(res.headers["x-export-rows"]).toBe("1");
    expect(res.text.startsWith("\uFEFF")).toBe(true);
    const lines = res.text.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("对账日期");
    expect(lines[0]).toContain("平台金额(元/2位小数)");
    expect(lines[1]).toContain("2026-09-20");
    expect(lines[1]).toContain("1234.5");
    // 当日单日口径：区间起止同为该日
    expect(paramsOf(dbMocks.query.mock.calls[0])).toEqual(["2026-09-20", "2026-09-20", 5000]);
  });

  it("当日无数据 ⇒ 200 + 仅表头（不 500、不造行）", async () => {
    dbMocks.query.mockResolvedValueOnce([]);

    const res = await request(app).get(`${PREFIX}/reconciliation-daily/2026-09-21/statement`);

    expect(res.status).toBe(200);
    expect(res.headers["x-export-rows"]).toBe("0");
    const lines = res.text.split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("对账日期");
  });

  it(":date 非法（2026-02-30）⇒ 400（不查库、不返回 CSV）", async () => {
    const res = await request(app).get(`${PREFIX}/reconciliation-daily/2026-02-30/statement`);

    expect(res.status).toBe(400);
    expect(res.headers["content-type"] ?? "").not.toContain("text/csv");
    expect(dbMocks.query).not.toHaveBeenCalled();
  });
});

describe("C4-1 包A #A-3 GET /reconciliation-daily/:date/diff（差异明细）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("200 + 聚合读数 + records 恒空 + 明示「无逐笔数据源」（不造数）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ rowCount: 3, diffCount: 2, diffAmount: "34.50" });

    const res = await request(app).get(`${PREFIX}/reconciliation-daily/2026-09-20/diff`);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.records).toEqual([]);
    expect(data.date).toBe("2026-09-20");
    expect(data.rowCount).toBe(3);
    expect(data.diffCount).toBe(2);
    expect(data.diffAmount).toBe(34.5);
    expect(data.note).toContain("无逐笔差异明细数据源");
    expect(data.amountUnit).toBe("CNY");
    expect(data.amountScale).toBe(2);
    expect(sqlOf(dbMocks.queryOne.mock.calls[0])).toContain("FROM t_platform_reconciliation");
    expect(paramsOf(dbMocks.queryOne.mock.calls[0])).toEqual(["2026-09-20"]);
  });

  it("当日无对账记录 ⇒ records: [] + 计数 0（不造 0 以外的任何行）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ rowCount: 0, diffCount: null, diffAmount: null });

    const res = await request(app).get(`${PREFIX}/reconciliation-daily/2026-09-22/diff`);

    expect(res.status).toBe(200);
    expect(res.body.data.records).toEqual([]);
    expect(res.body.data.rowCount).toBe(0);
    expect(res.body.data.diffCount).toBe(0);
    expect(res.body.data.diffAmount).toBe(0);
  });

  it(":date 非法（2026-9-20）⇒ 400（不查库）", async () => {
    const res = await request(app).get(`${PREFIX}/reconciliation-daily/2026-9-20/diff`);

    expect(res.status).toBe(400);
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });
});

describe("C4-1 包A #A-4 POST /generate（幂等生成结算单）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("首次生成：200 + created=1 + idempotent=false + 单号为 makeBizNo(SET) 范式 + 金额来源显式声明", async () => {
    // 调用契约：① 查既有单 → ② INSERT → ③ 回读兜底
    dbMocks.queryOne.mockResolvedValueOnce(null);
    dbMocks.query.mockResolvedValueOnce({ insertId: 21, affectedRows: 1 });
    dbMocks.queryOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post(`${PREFIX}/generate`)
      .send({ periodStart: "2026-09-01", periodEnd: "2026-09-30", tenantIds: ["t1"] });
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.created).toBe(1);
    expect(data.reused).toBe(0);
    expect(data.amountSource).toBe("UNAVAILABLE");
    expect(data.note).toContain("计费引擎");
    expect(data.records).toHaveLength(1);
    expect(data.records[0]).toMatchObject({ tenantId: "t1", settlementId: 21, idempotent: false });
    expect(data.records[0].settlementNo).toMatch(/^SET\d{13}$/);

    const insertSql = sqlOf(dbMocks.query.mock.calls[0]);
    expect(insertSql).toContain("INSERT INTO t_platform_settlement");
    // 金额不放行任何编造值：SQL 常量写死 0.00
    expect(insertSql).toContain("0.00, 0.00");
    expect(paramsOf(dbMocks.query.mock.calls[0])).toEqual([
      data.records[0].settlementNo,
      "t1",
      "2026-09-01",
      "2026-09-30",
      expect.stringContaining("C4-0"),
    ]);
    // 幂等查询只认同租户 + 同账期 + 非 CANCELLED
    const findSql = sqlOf(dbMocks.queryOne.mock.calls[0]);
    expect(findSql).toContain("tenant_id = ? AND period_start = ? AND period_end = ?");
    expect(findSql).toContain("status <> 'CANCELLED'");
  });

  it("幂等（同账期第二次调用）⇒ 只出一份 + idempotent=true 且不再 INSERT", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ id: 21, settlementNo: "SET2026092450011" });

    const res = await request(app)
      .post(`${PREFIX}/generate`)
      .send({ periodStart: "2026-09-01", periodEnd: "2026-09-30", tenantIds: ["t1"] });
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.created).toBe(0);
    expect(data.reused).toBe(1);
    expect(data.records).toEqual([
      { tenantId: "t1", settlementId: 21, settlementNo: "SET2026092450011", idempotent: true },
    ]);
    // 命中既有单即返回，绝不重复写库
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it("并发兜底：INSERT 后回读到更早的一单 ⇒ 返回先插的那份（idempotent=true）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(null);
    dbMocks.query.mockResolvedValueOnce({ insertId: 22, affectedRows: 1 });
    dbMocks.queryOne.mockResolvedValueOnce({ id: 21, settlementNo: "SET2026092450011" });

    const res = await request(app)
      .post(`${PREFIX}/generate`)
      .send({ periodStart: "2026-09-01", periodEnd: "2026-09-30", tenantIds: ["t1"] });
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.created).toBe(0);
    expect(data.reused).toBe(1);
    expect(data.records[0]).toEqual({
      tenantId: "t1",
      settlementId: 21,
      settlementNo: "SET2026092450011",
      idempotent: true,
    });
  });

  // ★ 本条随 C4-1b §一裁定 #2 的契约收紧而改写（红线1 允许的唯一例外用例）：
  //   旧口径「tenantIds 未传 ⇒ 按 t_tenant 全租户生成」已废；新口径为必填（≥1）。
  //   「缺失 / 空数组」与「超过上限」的专项断言见新文件 platform-billing-arrears.test.ts。
  it("tenantIds 未传 ⇒ 400（契约收紧：不再按全租户生成，且不查库）", async () => {
    const res = await request(app)
      .post(`${PREFIX}/generate`)
      .send({ periodStart: "2026-09-01", periodEnd: "2026-09-30" });

    expect(res.status).toBe(400);
    expect(String(res.body.msg)).toContain("tenantIds 必填");
    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });

  it("缺 periodStart ⇒ 400（不查库）", async () => {
    const res = await request(app).post(`${PREFIX}/generate`).send({ periodEnd: "2026-09-30" });

    expect(res.status).toBe(400);
    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });

  it("日期倒挂 ⇒ 400（不查库）", async () => {
    const res = await request(app)
      .post(`${PREFIX}/generate`)
      .send({ periodStart: "2026-09-30", periodEnd: "2026-09-01" });

    expect(res.status).toBe(400);
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it("tenantIds 非数组 ⇒ 400（不查库）", async () => {
    const res = await request(app)
      .post(`${PREFIX}/generate`)
      .send({ periodStart: "2026-09-01", periodEnd: "2026-09-30", tenantIds: "t1" });

    expect(res.status).toBe(400);
    expect(dbMocks.query).not.toHaveBeenCalled();
  });
});

describe("C4-1 包A #A-5 POST /statement/export（区间导出 CSV）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("200 + CSV（区间文件名 + BOM + 数据行）", async () => {
    dbMocks.query.mockResolvedValueOnce([dailyRow(), dailyRow({ id: 8, platform: "DOUYIN" })]);

    const res = await request(app)
      .post(`${PREFIX}/statement/export`)
      .send({ dateStart: "2026-09-01", dateEnd: "2026-09-30" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv; charset=utf-8");
    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="reconciliation-statement-2026-09-01_2026-09-30.csv"'
    );
    expect(res.headers["x-export-rows"]).toBe("2");
    expect(res.text.startsWith("\uFEFF")).toBe(true);
    expect(res.text.split("\n")).toHaveLength(3);
    expect(paramsOf(dbMocks.query.mock.calls[0])).toEqual(["2026-09-01", "2026-09-30", 5000]);
  });

  it("区间无数据 ⇒ 200 + 仅表头", async () => {
    dbMocks.query.mockResolvedValueOnce([]);

    const res = await request(app)
      .post(`${PREFIX}/statement/export`)
      .send({ dateStart: "2026-09-01", dateEnd: "2026-09-30", platform: "MEITUAN" });

    expect(res.status).toBe(200);
    expect(res.headers["x-export-rows"]).toBe("0");
    expect(res.text.split("\n")).toHaveLength(1);
    expect(paramsOf(dbMocks.query.mock.calls[0])).toEqual([
      "2026-09-01",
      "2026-09-30",
      "MEITUAN",
      5000,
    ]);
  });

  it("缺 dateStart ⇒ 400（不得「参数错还回 200 空文件」）", async () => {
    const res = await request(app)
      .post(`${PREFIX}/statement/export`)
      .send({ dateEnd: "2026-09-30" });

    expect(res.status).toBe(400);
    expect(res.headers["content-type"] ?? "").not.toContain("text/csv");
    expect(res.text).not.toContain("对账日期");
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it("日期倒挂 ⇒ 400（不查库、不导出）", async () => {
    const res = await request(app)
      .post(`${PREFIX}/statement/export`)
      .send({ dateStart: "2026-09-30", dateEnd: "2026-09-01" });

    expect(res.status).toBe(400);
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it("非法日期（2026-13-01）⇒ 400（不查库）", async () => {
    const res = await request(app)
      .post(`${PREFIX}/statement/export`)
      .send({ dateStart: "2026-13-01", dateEnd: "2026-09-30" });

    expect(res.status).toBe(400);
    expect(dbMocks.query).not.toHaveBeenCalled();
  });
});

describe("C4-1 包A #A-6 POST /invoice（开票申请，复用 t_invoice）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("201 + 金额缺省取该租户结算单 total_amount + 只写 t_invoice 且 status=PENDING", async () => {
    // 调用契约：① 校验租户 → ② 解析结算单 → ③ INSERT
    dbMocks.queryOne.mockResolvedValueOnce({ id: "t1" });
    dbMocks.queryOne.mockResolvedValueOnce({
      id: 9,
      settlementNo: "SET2026092450011",
      tenantId: "t1",
      totalAmount: "1000.00",
    });
    dbMocks.query.mockResolvedValueOnce({ insertId: 3, affectedRows: 1 });

    const res = await request(app)
      .post(`${PREFIX}/invoice`)
      .send({ tenantId: "t1", settlementNo: "SET2026092450011" });
    const data = res.body.data;

    expect(res.status).toBe(201);
    expect(data.invoiceNo).toMatch(/^INV\d{13}$/);
    expect(data.invoiceType).toBe("OUT");
    expect(data.relatedType).toBe("PLATFORM_BILLING");
    expect(data.relatedNo).toBe("SET2026092450011");
    expect(data.status).toBe("PENDING");
    expect(data.tenantId).toBe("t1");
    expect(data.amount).toBe(1000);
    expect(data.taxRate).toBe(0);
    expect(data.taxAmount).toBe(0);
    expect(data.settlementId).toBe(9);
    expect(data.amountUnit).toBe("CNY");
    expect(data.amountScale).toBe(2);

    const insertSql = sqlOf(dbMocks.query.mock.calls[0]);
    expect(insertSql).toContain("INSERT INTO t_invoice");
    // 不得伪造 ISSUED；一律 PENDING 申请态
    expect(insertSql).not.toContain("ISSUED");
    expect(paramsOf(dbMocks.query.mock.calls[0])).toEqual([
      data.invoiceNo,
      "OUT",
      "PLATFORM_BILLING",
      "SET2026092450011",
      1000,
      0,
      0,
      "PENDING",
      "t1",
    ]);
    // 结算单解析带租户限定，避免跨租户开票
    expect(sqlOf(dbMocks.queryOne.mock.calls[1])).toContain("settlement_no = ? AND tenant_id = ?");
  });

  it("201 + 显式 amount/taxRate：税额按 2 位小数计算（200 × 6% = 12.00）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ id: "t1" });
    dbMocks.queryOne.mockResolvedValueOnce({
      id: 9,
      settlementNo: "SET2026092450011",
      tenantId: "t1",
      totalAmount: "1000.00",
    });
    dbMocks.query.mockResolvedValueOnce({ insertId: 3, affectedRows: 1 });

    const res = await request(app)
      .post(`${PREFIX}/invoice`)
      .send({ tenantId: "t1", amount: 200, taxRate: 0.06 });

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(200);
    expect(res.body.data.taxRate).toBe(0.06);
    expect(res.body.data.taxAmount).toBe(12);
    expect(paramsOf(dbMocks.query.mock.calls[0])[5]).toBe(0.06);
  });

  it("未传结算单引用 ⇒ 取该租户最近一单（带 tenant_id 限定 + ORDER BY created_at DESC）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ id: "t1" });
    dbMocks.queryOne.mockResolvedValueOnce({
      id: 11,
      settlementNo: "SET2026092450099",
      tenantId: "t1",
      totalAmount: "88.80",
    });
    dbMocks.query.mockResolvedValueOnce({ insertId: 4, affectedRows: 1 });

    const res = await request(app).post(`${PREFIX}/invoice`).send({ tenantId: "t1" });

    expect(res.status).toBe(201);
    expect(res.body.data.settlementId).toBe(11);
    const settlementSql = sqlOf(dbMocks.queryOne.mock.calls[1]);
    expect(settlementSql).toContain("WHERE tenant_id = ?");
    expect(settlementSql).toContain("ORDER BY created_at DESC");
  });

  it("tenantId 缺失 ⇒ 400（不查库）", async () => {
    const res = await request(app).post(`${PREFIX}/invoice`).send({ amount: 100 });

    expect(res.status).toBe(400);
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it("租户不存在 ⇒ 404（不写库）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(null);

    const res = await request(app).post(`${PREFIX}/invoice`).send({ tenantId: "ghost" });

    expect(res.status).toBe(404);
    expect(res.body.msg).toContain("租户不存在");
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it("该租户无可用结算单 ⇒ 400 且不写库（不得凭空造金额）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ id: "t1" });
    dbMocks.queryOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post(`${PREFIX}/invoice`)
      .send({ tenantId: "t1", settlementNo: "SET-NOT-EXIST" });

    expect(res.status).toBe(400);
    expect(res.body.msg).toContain("结算单");
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it("taxRate 越界（1.5 / -0.1）⇒ 400（不查库）", async () => {
    const high = await request(app).post(`${PREFIX}/invoice`).send({ tenantId: "t1", taxRate: 1.5 });
    expect(high.status).toBe(400);

    resetDbMocks();
    const negative = await request(app)
      .post(`${PREFIX}/invoice`)
      .send({ tenantId: "t1", taxRate: -0.1 });
    expect(negative.status).toBe(400);

    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });

  it("amount 非法（0 / 非数字）⇒ 400（不查库）", async () => {
    const zero = await request(app).post(`${PREFIX}/invoice`).send({ tenantId: "t1", amount: 0 });
    expect(zero.status).toBe(400);

    resetDbMocks();
    const nan = await request(app).post(`${PREFIX}/invoice`).send({ tenantId: "t1", amount: "abc" });
    expect(nan.status).toBe(400);

    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });
});

describe("C4-1 包A 反测：6 端点无令牌 ⇒ 401 且不触达数据库", () => {
  const cases: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [
    { method: "get", path: `${PREFIX}/reconciliation-daily` },
    { method: "get", path: `${PREFIX}/reconciliation-daily/2026-09-20/statement` },
    { method: "get", path: `${PREFIX}/reconciliation-daily/2026-09-20/diff` },
    {
      method: "post",
      path: `${PREFIX}/generate`,
      body: { periodStart: "2026-09-01", periodEnd: "2026-09-30" },
    },
    {
      method: "post",
      path: `${PREFIX}/statement/export`,
      body: { dateStart: "2026-09-01", dateEnd: "2026-09-30" },
    },
    { method: "post", path: `${PREFIX}/invoice`, body: { tenantId: "t1" } },
  ];

  it("覆盖全部 6 个端点", () => {
    expect(cases).toHaveLength(6);
  });

  for (const c of cases) {
    it(`${c.method.toUpperCase()} ${c.path} 无令牌 ⇒ 401`, async () => {
      vi.clearAllMocks();
      resetDbMocks();
      let req = (request(guardedApp) as any)[c.method](c.path);
      if (c.body) req = req.send(c.body);
      const res = await req;

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("401");
      expect(dbMocks.query).not.toHaveBeenCalled();
      expect(dbMocks.queryOne).not.toHaveBeenCalled();
    });
  }
});
