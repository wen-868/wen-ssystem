/**
 * R101-C3-1 开放平台 · 密钥 8 端点路由级测试（/api/platform/open/api-keys）
 *
 * 范式：`src/__tests__/routes/platform-templates.test.ts`（create-test-app 夹具）+ C2-0 的
 *       「guardedApp 挂真实 requirePlatformAuth ⇒ 无令牌 401」反向用例写法。
 *
 * 与 C2-0 的差异（本单要求）：本文件**不 mock service**，而是 mock `shared/db` —— 让用例真正穿过
 * controller + service（因此「明文只回显一次」「日志/审计不含明文」「列表打码」是**实现级断言**，
 * 不是"转发断言"）。明文探针见文件末尾 `密钥明文泄露探针` 一节，含探针自身的反测。
 *
 * 注意：本沙箱 vitest 无法启动（`spawn EPERM`，C2-0/C3-0 已确认，不反复重试）；
 *       用例只写好，首次真跑由凌舟在本机执行（派单卡红线 5）。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { createTestApp } from "../fixtures/create-test-app";

/**
 * mock 状态必须用 `vi.hoisted` 创建：`vi.mock` 的工厂在**本文件模块体执行之前**就会运行，
 * 直接引用普通顶层 `const`（如 `const captured = []`）会落到 TDZ 抛 ReferenceError。
 * `captured` = 捕获型 logger 的全部调用，供「明文不落日志」探针检查。
 */
const hoisted = vi.hoisted(() => ({
  captured: [] as unknown[][],
  query: vi.fn(),
  queryOne: vi.fn(),
  insertPlatformAuditLog: vi.fn(),
}));
const dbMocks = { query: hoisted.query, queryOne: hoisted.queryOne };
const auditMocks = { insertPlatformAuditLog: hoisted.insertPlatformAuditLog };
const captured = hoisted.captured;

vi.mock("../../shared/db", () => ({
  query: hoisted.query,
  queryOne: hoisted.queryOne,
}));

vi.mock("../../shared/logger", () => {
  const record =
    (level: string) =>
    (msg: unknown, ...args: unknown[]) => {
      hoisted.captured.push([level, msg, ...args]);
    };
  return {
    default: { info: record("info"), warn: record("warn"), error: record("error"), debug: record("debug") },
  };
});

vi.mock("../../services/admin/platform-audit-log.service", () => ({
  insertPlatformAuditLog: hoisted.insertPlatformAuditLog,
}));

import { platformOpenRouter, routeConfig } from "../../routes/platform-open.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const PREFIX = "/api/platform/open";
const app = createTestApp({ prefix: PREFIX, router: platformOpenRouter });

/** 真实鉴权守卫（无 Authorization ⇒ 401），用于 8 条端点的「无令牌」反测 */
const guardedApp = express();
guardedApp.use(express.json());
guardedApp.use(PREFIX, requirePlatformAuth, platformOpenRouter);
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

/** 库中的一行（含 api_secret 哈希，模拟真实 SELECT 结果） */
function keyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    tenantId: "t1",
    appName: "某某ERP对接",
    apiKey: "zk_live_aaaabbbbccccdddd",
    apiSecret: "$2b$10$storedhashstoredhashstoredha",
    allowedIps: JSON.stringify(["1.2.3.4"]),
    dailyLimit: 10000,
    qps: 10,
    scopes: JSON.stringify(["library:r"]),
    todayCount: 12,
    lastCalledAt: "2026-09-23 09:00:00",
    status: 1,
    remark: "对接备注",
    rotateExpireAt: null,
    createdAt: "2026-09-01 10:00:00",
    updatedAt: "2026-09-01 10:00:00",
    ...overrides,
  };
}

/** 明文探针：返回命中的调用（空数组 = 没有任何日志/审计写入带明文） */
function leaksOf(secret: string, calls: unknown[][]): unknown[][] {
  return calls.filter((call) => call.some((arg) => JSON.stringify(arg ?? null)?.includes(secret)));
}

function allAuditCalls(): unknown[][] {
  return auditMocks.insertPlatformAuditLog.mock.calls as unknown[][];
}

/**
 * 每个用例开始前把两个 DB mock 清成「空实现 + 空 `mockResolvedValueOnce` 队列」。
 *
 * 依据（C3-1d 实测根因）：`vi.clearAllMocks()` 只清调用记录，**不清 `mockResolvedValueOnce`
 * 的待消费队列**（vitest spy 语义），只要有一个用例排了值却没用掉，后续用例的返回值就整体
 * 后移一位。C3-1d 前的实测表现：`#6/#7 并发兜底` 的 UPDATE 拿到旧值 `{ affectedRows: 1 }`
 * ⇒ 没触发 409 而返回 200；`#8 stats` 两条的日聚合 SELECT 拿到旧值 `{ affectedRows: 0 }`
 * ⇒ `seriesRows.map is not a function` ⇒ 500。故这里显式 `mockReset()`，让每个用例的
 * 「排队 ↔ 实际调用」都从空队列开始，不再依赖上一个用例的调用顺序。
 */
function resetDbMocks() {
  dbMocks.query.mockReset();
  dbMocks.queryOne.mockReset();
}

describe("C3-1 密钥 #1 GET /api/platform/open/api-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    captured.length = 0;
    auditMocks.insertPlatformAuditLog.mockResolvedValue(1);
  });

  it("200 + 空态 records: []（不造数据）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ total: 0 });
    dbMocks.query.mockResolvedValueOnce([]);

    const res = await request(app).get(`${PREFIX}/api-keys`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.records).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.page).toBe(1);
  });

  it("200 + 打码与派生：apiKey 带 ****、无 apiSecret 键、scopes 为数组、rotateStatus=ACTIVE", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ total: 1 });
    dbMocks.query.mockResolvedValueOnce([keyRow()]);

    const res = await request(app).get(`${PREFIX}/api-keys`);
    const record = res.body.data.records[0];

    expect(res.status).toBe(200);
    expect(record.apiKey).toContain("****");
    expect(record.apiKey).toBe("zk_l****dddd");
    // 打码硬要求：完整 AppKey / AppSecret 都不在响应里
    expect(JSON.stringify(res.body)).not.toContain("zk_live_aaaabbbbccccdddd");
    expect(JSON.stringify(res.body)).not.toContain("$2b$10$storedhash");
    expect(record.apiSecret).toBeUndefined();
    expect(record.prevApiSecret).toBeUndefined();
    expect(record.scopes).toEqual(["library:r"]);
    expect(record.allowedIps).toEqual(["1.2.3.4"]);
    expect(record.rotateStatus).toBe("ACTIVE");
    expect(record.qps).toBe(10);
    // SELECT 列清单不含 api_secret（连哈希都不出库）
    expect(String(dbMocks.query.mock.calls[0][0])).not.toContain("api_secret");
  });

  it("200 + rotateStatus=ROTATING（rotate_expire_at 未过期）", async () => {
    const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    dbMocks.queryOne.mockResolvedValueOnce({ total: 1 });
    dbMocks.query.mockResolvedValueOnce([keyRow({ rotateExpireAt: future })]);

    const res = await request(app).get(`${PREFIX}/api-keys`);
    expect(res.status).toBe(200);
    expect(res.body.data.records[0].rotateStatus).toBe("ROTATING");
  });

  it("tenantId/status/keyword 透传为 SQL 条件", async () => {
    dbMocks.queryOne.mockResolvedValueOnce({ total: 0 });
    dbMocks.query.mockResolvedValueOnce([]);

    const res = await request(app).get(`${PREFIX}/api-keys?tenantId=t1&status=1&keyword=erp&page=2&pageSize=5`);

    expect(res.status).toBe(200);
    const [countSql, countParams] = dbMocks.queryOne.mock.calls[0];
    expect(String(countSql)).toContain("tenant_id = ?");
    expect(String(countSql)).toContain("status = ?");
    expect(String(countSql)).toContain("app_name LIKE ?");
    expect(countParams).toEqual(["t1", 1, "%erp%", "%erp%"]);
    expect(res.body.data.page).toBe(2);
    expect(res.body.data.pageSize).toBe(5);
  });

  it("参数非法（?status=7）⇒ 400（ZodError 链路）且不查库", async () => {
    const res = await request(app).get(`${PREFIX}/api-keys?status=7`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("400");
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });
});

describe("C3-1 密钥 #2 POST /api/platform/open/api-keys（明文一次性）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    captured.length = 0;
    auditMocks.insertPlatformAuditLog.mockResolvedValue(1);
  });

  it("201 + 返回明文 AppSecret；库里存的是 bcrypt 哈希（不是明文）", async () => {
    // 调用契约：createApiKey 只写一次库（INSERT）⇒ 配对 1 个返回值
    dbMocks.query.mockResolvedValueOnce({ insertId: 9, affectedRows: 1 });
    const res = await request(app)
      .post(`${PREFIX}/api-keys`)
      .send({ appName: "某某ERP对接", tenantId: "t1", qps: 30, scopes: ["order:rw"], allowedIps: ["1.2.3.4"] });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe("0");
    const data = res.body.data;
    expect(data.id).toBe(9);
    expect(data.apiKey).toMatch(/^zk_live_[0-9a-f]{32}$/);
    expect(data.apiSecret).toMatch(/^[0-9a-f]{48}$/);
    expect(data.qps).toBe(30);
    expect(data.scopes).toEqual(["order:rw"]);

    const [insertSql, insertParams] = dbMocks.query.mock.calls[0];
    expect(String(insertSql)).toContain("INSERT INTO t_library_api_key");
    expect(insertParams[0]).toBe("某某ERP对接");
    expect(insertParams[1]).toBe("t1");
    expect(insertParams[2]).toBe(data.apiKey);
    expect(String(insertParams[3])).toMatch(/^\$2[aby]\$/); // bcrypt 哈希
    expect(insertParams[3]).not.toBe(data.apiSecret); // 绝不存明文
    expect(insertParams[5]).toBe(10000); // dailyLimit 默认
    expect(insertParams[6]).toBe(30); // qps
    expect(insertParams[7]).toBe(JSON.stringify(["order:rw"]));
  });

  it("201 + 默认值：tenantId=default、qps=10、scopes 空数组；明文在响应体只出现 1 次", async () => {
    // 同上：INSERT 一次（本用例断言默认值与明文只出现 1 次，不重复断言 id）
    dbMocks.query.mockResolvedValueOnce({ insertId: 9, affectedRows: 1 });
    const res = await request(app).post(`${PREFIX}/api-keys`).send({ appName: "无租户参数" });

    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).toBe("default");
    expect(res.body.data.qps).toBe(10);
    expect(res.body.data.scopes).toEqual([]);
    expect(res.body.data.apiSecret).toMatch(/^[0-9a-f]{48}$/);

    const secret = res.body.data.apiSecret as string;
    const occurrences = JSON.stringify(res.body).split(secret).length - 1;
    expect(occurrences).toBe(1); // 「明文只回显一次」
  });

  it("缺 appName ⇒ 400 且不写库（service 未被调用）", async () => {
    const res = await request(app).post(`${PREFIX}/api-keys`).send({ tenantId: "t1" });
    expect(res.status).toBe(400);
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it("qps 非数字 ⇒ 400 且不写库", async () => {
    const res = await request(app).post(`${PREFIX}/api-keys`).send({ appName: "x", qps: "abc" });
    expect(res.status).toBe(400);
    expect(dbMocks.query).not.toHaveBeenCalled();
  });
});

describe("C3-1 密钥 #3 PUT /api/platform/open/api-keys/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    captured.length = 0;
    auditMocks.insertPlatformAuditLog.mockResolvedValue(1);
  });

  it("200 + 返回 changedFields（限额/QPS/状态）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(keyRow());
    dbMocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app)
      .put(`${PREFIX}/api-keys/5`)
      .send({ dailyLimit: 500, qps: 50, status: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data.changedFields).toEqual(["dailyLimit", "qps", "status"]);
    const [updateSql, updateParams] = dbMocks.query.mock.calls[0];
    expect(String(updateSql)).toContain("daily_limit = ?");
    expect(String(updateSql)).toContain("qps = ?");
    expect(updateParams).toEqual([500, 50, 0, 5]);
  });

  it("密钥不存在 ⇒ 404", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(null);
    const res = await request(app).put(`${PREFIX}/api-keys/999`).send({ qps: 30 });
    expect(res.status).toBe(404);
    expect(res.body.msg).toContain("API 密钥不存在");
  });

  it("空 body ⇒ 400（不生成空 UPDATE）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(keyRow());
    const res = await request(app).put(`${PREFIX}/api-keys/5`).send({});
    expect(res.status).toBe(400);
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it(":id 非正整数 ⇒ 400 且不查库", async () => {
    const res = await request(app).put(`${PREFIX}/api-keys/abc`).send({ qps: 30 });
    expect(res.status).toBe(400);
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });
});

describe("C3-1 密钥 #4 DELETE /  #5 POST :id/enable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    captured.length = 0;
    auditMocks.insertPlatformAuditLog.mockResolvedValue(1);
  });

  it("DELETE 200 + deleted: true", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(keyRow());
    dbMocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app).delete(`${PREFIX}/api-keys/5`);

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
    expect(String(dbMocks.query.mock.calls[0][0])).toContain("DELETE FROM t_library_api_key");
  });

  it("DELETE 不存在 ⇒ 404", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(null);
    const res = await request(app).delete(`${PREFIX}/api-keys/8`);
    expect(res.status).toBe(404);
  });

  it("POST :id/enable 200 + status=1", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(keyRow({ status: 0 }));
    dbMocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app).post(`${PREFIX}/api-keys/5/enable`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 5, status: 1, enabled: true });
    expect(String(dbMocks.query.mock.calls[0][0])).toContain("SET status = 1");
  });
});

describe("C3-1 密钥 #6/#7 轮换与完成轮换", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    captured.length = 0;
    auditMocks.insertPlatformAuditLog.mockResolvedValue(1);
  });

  it("POST :id/rotate 200：返回新 AppKey/AppSecret，旧密钥转入 prev_* 且 rotate_expire_at 置位", async () => {
    const rotated = keyRow({ rotateExpireAt: "2026-09-30 10:00:00" });
    dbMocks.queryOne.mockResolvedValueOnce(keyRow()).mockResolvedValueOnce(rotated);
    dbMocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app).post(`${PREFIX}/api-keys/5/rotate`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.apiKey).toMatch(/^zk_live_[0-9a-f]{32}$/);
    expect(data.apiKey).not.toBe("zk_live_aaaabbbbccccdddd");
    expect(data.apiSecret).toMatch(/^[0-9a-f]{48}$/);
    expect(data.rotateStatus).toBe("ROTATING");
    expect(data.previousAppKeyMasked).toBe("zk_l****dddd");
    expect(data.rotateExpireAt).toBe("2026-09-30 10:00:00");

    const [updateSql, updateParams] = dbMocks.query.mock.calls[0];
    expect(String(updateSql)).toContain("prev_api_key = api_key");
    expect(String(updateSql)).toContain("prev_api_secret = api_secret");
    expect(String(updateSql)).toContain("rotate_expire_at = DATE_ADD(NOW(), INTERVAL 7 DAY)");
    expect(updateParams[0]).toBe(data.apiKey);
    expect(String(updateParams[1])).toMatch(/^\$2[aby]\$/);
    expect(updateParams[2]).toBe(5);
  });

  it("轮换中再次 rotate ⇒ 409 且不写库", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(
      keyRow({ rotateExpireAt: new Date(Date.now() + 3600 * 1000).toISOString() })
    );

    const res = await request(app).post(`${PREFIX}/api-keys/5/rotate`);

    expect(res.status).toBe(409);
    expect(res.body.msg).toContain("正在轮换中");
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it("并发兜底：UPDATE affectedRows=0 ⇒ 409", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(keyRow());
    dbMocks.query.mockResolvedValueOnce({ affectedRows: 0 });

    const res = await request(app).post(`${PREFIX}/api-keys/5/rotate`);
    expect(res.status).toBe(409);
    // 调用契约：409 由 UPDATE 的 affectedRows=0 触发，此后不再回读该行（只应各 1 次）
    expect(dbMocks.query).toHaveBeenCalledTimes(1);
    expect(dbMocks.queryOne).toHaveBeenCalledTimes(1);
  });

  it("POST :id/rotate-complete 200：清空 prev_* 且旧密钥立即失效", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(keyRow({ rotateExpireAt: "2026-09-30 10:00:00" }));
    dbMocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app).post(`${PREFIX}/api-keys/5/rotate-complete`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 5, rotateStatus: "ACTIVE", previousKeyInvalidated: true });
    const updateSql = String(dbMocks.query.mock.calls[0][0]);
    expect(updateSql).toContain("prev_api_key = NULL");
    expect(updateSql).toContain("rotate_expire_at = NULL");
  });

  it("不在轮换中却 complete ⇒ 400 且不写库", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(keyRow({ rotateExpireAt: null }));
    const res = await request(app).post(`${PREFIX}/api-keys/5/rotate-complete`);
    expect(res.status).toBe(400);
    expect(dbMocks.query).not.toHaveBeenCalled();
  });
});

describe("C3-1 密钥 #8 GET /api/platform/open/api-keys/:id/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    captured.length = 0;
    auditMocks.insertPlatformAuditLog.mockResolvedValue(1);
  });

  it("200 + 近 7 日序列与合计（错误率按合计口径）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(keyRow());
    dbMocks.query.mockResolvedValueOnce([
      { statDate: "2026-09-21", callCount: 10, errorCount: 1 },
      { statDate: "2026-09-22", callCount: 30, errorCount: 2 },
    ]);

    const res = await request(app).get(`${PREFIX}/api-keys/5/stats`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.apiKey).toBe("zk_l****dddd"); // 统计里同样只回打码值
    expect(data.series).toEqual([
      { date: "2026-09-21", callCount: 10, errorCount: 1, errorRate: 0.1 },
      { date: "2026-09-22", callCount: 30, errorCount: 2, errorRate: 0.0667 },
    ]);
    expect(data.total).toEqual({ callCount: 40, errorCount: 3, errorRate: 0.075 });
    expect(data.hasData).toBe(true);
    expect(data.range.days).toBe(7);
    // 统计查询按密钥过滤、按天升序（窗口 = days-1 天前至今）
    const [seriesSql, seriesParams] = dbMocks.query.mock.calls[0];
    expect(String(seriesSql)).toContain("FROM t_open_api_call_daily");
    expect(String(seriesSql)).toContain("ORDER BY stat_date ASC");
    expect(seriesParams).toEqual([5, 6]);
  });

  it("200 + 空态：series [] 且 errorRate 为 null（不造 0 值、不造日期）", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(keyRow());
    dbMocks.query.mockResolvedValueOnce([]);

    const res = await request(app).get(`${PREFIX}/api-keys/5/stats?days=30`);

    expect(res.status).toBe(200);
    expect(res.body.data.series).toEqual([]);
    expect(res.body.data.hasData).toBe(false);
    expect(res.body.data.total).toEqual({ callCount: 0, errorCount: 0, errorRate: null });
    expect(res.body.data.range.days).toBe(30);
  });

  it("密钥不存在 ⇒ 404", async () => {
    dbMocks.queryOne.mockResolvedValueOnce(null);
    const res = await request(app).get(`${PREFIX}/api-keys/404/stats`);
    expect(res.status).toBe(404);
  });

  it("?days=999 ⇒ 400（上限 90）", async () => {
    const res = await request(app).get(`${PREFIX}/api-keys/5/stats?days=999`);
    expect(res.status).toBe(400);
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });
});

describe("C3-1 反测：密钥 8 端点无令牌 ⇒ 401 且不触达数据库", () => {
  const cases: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [
    { method: "get", path: `${PREFIX}/api-keys` },
    { method: "post", path: `${PREFIX}/api-keys`, body: { appName: "x" } },
    { method: "put", path: `${PREFIX}/api-keys/1`, body: { qps: 30 } },
    { method: "delete", path: `${PREFIX}/api-keys/1` },
    { method: "post", path: `${PREFIX}/api-keys/1/enable` },
    { method: "post", path: `${PREFIX}/api-keys/1/rotate` },
    { method: "post", path: `${PREFIX}/api-keys/1/rotate-complete` },
    { method: "get", path: `${PREFIX}/api-keys/1/stats` },
  ];

  it("覆盖全部 8 个密钥端点", () => {
    expect(cases).toHaveLength(8);
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

describe("C3-1 密钥明文泄露探针（日志 + 审计）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    captured.length = 0;
    auditMocks.insertPlatformAuditLog.mockResolvedValue(1);
  });

  it("探针反测：探针本身能识别「明文被写进日志」——否则这条门禁是假门禁", () => {
    const fakeSecret = "deadbeef".repeat(6);
    expect(leaksOf(fakeSecret, [["info", "appSecret=" + fakeSecret]])).toHaveLength(1);
    expect(leaksOf(fakeSecret, [["info", "appSecret=****"]])).toHaveLength(0);
  });

  it("创建密钥：明文 AppSecret 不出现在任何日志调用中", async () => {
    dbMocks.query.mockResolvedValueOnce({ insertId: 11, affectedRows: 1 });
    const res = await request(app).post(`${PREFIX}/api-keys`).send({ appName: "探针应用" });
    const secret = res.body.data.apiSecret as string;

    expect(res.status).toBe(201);
    expect(leaksOf(secret, captured)).toEqual([]);
    // 成功路径不应有任何日志写入（写入方不存在 ⇒ 不可能泄露）
    expect(captured).toEqual([]);
  });

  it("创建密钥：明文不出现在任何审计写入中，且审计只记打码值", async () => {
    dbMocks.query.mockResolvedValueOnce({ insertId: 12, affectedRows: 1 });
    const res = await request(app).post(`${PREFIX}/api-keys`).send({ appName: "探针应用" });
    const secret = res.body.data.apiSecret as string;
    const appKey = res.body.data.apiKey as string;

    const auditCalls = allAuditCalls();
    expect(auditCalls.length).toBe(1);
    expect(leaksOf(secret, auditCalls)).toEqual([]); // 明文 secret 不入审计
    expect(leaksOf(appKey, auditCalls)).toEqual([]); // 完整 AppKey 也不入审计
    expect(auditCalls[0][0]).toMatchObject({
      module: "open_platform",
      action: "API_KEY_CREATE",
      detail: { appName: "探针应用", appKeyMasked: "zk_l****" + appKey.slice(-4) },
    });
  });

  it("轮换密钥：明文不出现在日志/审计中，审计只记前后打码值", async () => {
    const rotated = keyRow({ rotateExpireAt: "2026-09-30 10:00:00" });
    dbMocks.queryOne.mockResolvedValueOnce(keyRow()).mockResolvedValueOnce(rotated);
    dbMocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app).post(`${PREFIX}/api-keys/5/rotate`);
    const secret = res.body.data.apiSecret as string;
    const appKey = res.body.data.apiKey as string;

    expect(res.status).toBe(200);
    expect(leaksOf(secret, captured)).toEqual([]);
    expect(leaksOf(secret, allAuditCalls())).toEqual([]);
    expect(leaksOf(appKey, allAuditCalls())).toEqual([]);
    expect(allAuditCalls()[0][0]).toMatchObject({
      action: "API_KEY_ROTATE",
      detail: {
        previousAppKeyMasked: "zk_l****dddd",
        newAppKeyMasked: "zk_l****" + appKey.slice(-4),
      },
    });
  });
});

describe("C3-1 路由注册（routeConfig + 端点完整性/顺序）", () => {
  const paths = (platformOpenRouter as any).stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => `${Object.keys(layer.route.methods)[0].toLowerCase()} ${layer.route.path}`);

  it("routeConfig：prefix=/api/platform/open、auth=requirePlatformAuth、router 指向同一实例", () => {
    expect(routeConfig.prefix).toBe(PREFIX);
    expect(routeConfig.auth).toBe("requirePlatformAuth");
    expect(routeConfig.router).toBe(platformOpenRouter);
  });

  it("密钥 8 条端点全部在 router 上注册（无手写 app.use）", () => {
    expect(paths).toEqual(
      expect.arrayContaining([
        "get /api-keys",
        "post /api-keys",
        "put /api-keys/:id",
        "delete /api-keys/:id",
        "post /api-keys/:id/enable",
        "post /api-keys/:id/rotate",
        "post /api-keys/:id/rotate-complete",
        "get /api-keys/:id/stats",
      ])
    );
  });

  it("Webhook 7 条 + events 1 条同样注册在本 router（同一 open 域）", () => {
    expect(paths).toEqual(
      expect.arrayContaining([
        "get /events",
        "get /webhooks",
        "post /webhooks",
        "post /webhooks/:id/test",
        "get /webhooks/:id/logs",
        "post /webhooks/:id/redeliver",
        "post /webhooks/:id/resume",
        "get /webhooks/:id/failures",
      ])
    );
  });

  it("端点总数 = 16（密钥 8 + Webhook 7 + events 1）", () => {
    expect(paths).toHaveLength(16);
  });
});
