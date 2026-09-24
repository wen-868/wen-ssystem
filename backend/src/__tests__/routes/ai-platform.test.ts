/**
 * R101-C5-1（阶段一 C5）· 平台 AI 配置与用量 4 个只读端点 路由级测试
 * （GET /api/platform/ai/{public-models, metering-log, abnormal-tenants, model-share}）
 *
 * 范式：`src/__tests__/routes/platform-billing-arrears.test.ts`
 *   （`vi.mock("../../shared/db")` 桩住数据层，用例真正穿过 controller + service）。
 * 差异：本路由 router 级即挂了 `requirePlatformAuth`（与同域 `ai-billing.routes.ts` 同口径），
 *   故**不**使用 `create-test-app` 夹具（它不注入令牌，本前缀下所有请求都会先被 401 拦掉）——
 *   改用「真实鉴权闸门 + 有效平台令牌」的应用，见下方 `app` / `get()` 的说明。
 *
 * 反测口径（派单卡 §四「反测口径纠正」，凌舟踩过的坑）：
 *   `/api/platform/*` 上有**前缀级鉴权闸门**，不存在的路径也返回 401 ⇒ 「无令牌 401」**不是**挂载指纹。
 *   本文件的挂载正判据 = **持有效平台令牌 ⇒ 200**（`signPlatformToken` + 真实 `requirePlatformAuth`），
 *   以及**持有效令牌 + 参数非法 ⇒ 400**（而不是 401/404）。
 *
 * 覆盖（派单卡 §四/§六）：
 *   - 每条端点 ≥1 正向 + 空态断言（`records: []` / 明确 null，不造 0、不造日期）；
 *   - 参数非法 ⇒ 400 且**不触达数据库**；
 *   - `model-share` 的 SQL **出现** `t_ai_audit_log`、**不出现** `t_ai_usage_daily`（裁定 §三.3）；
 *   - 迁移 177 两列未就绪（列缺失）与历史行 NULL 两种情形 ⇒ **不报 500**、返回明确空态。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { ZodError } from "zod";

const hoisted = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  poolQuery: vi.fn(),
}));
const dbMocks = { query: hoisted.query, queryOne: hoisted.queryOne };

vi.mock("../../shared/db", () => ({
  query: hoisted.query,
  queryOne: hoisted.queryOne,
  queryWithTenant: hoisted.queryWithTenant,
  pool: { query: hoisted.poolQuery },
}));

import { aiPlatformRouter, routeConfig } from "../../routes/ai-platform.routes";
import { requirePlatformAuth, signPlatformToken } from "../../middleware/auth";

const PREFIX = "/api/platform/ai";

/**
 * 真实鉴权闸门下的应用（按生产 auto-routes 的挂载形状：prefix + 鉴权中间件 + router，
 * 见 `shared/auto-routes.ts:171-172`）。
 *
 * ⚠️ 反测口径（派单卡 §四「反测口径纠正」）：
 * `/api/platform/*` 上有**前缀级鉴权闸门**，且本路由 router 级也挂了 `requirePlatformAuth`
 * （照抄同域 `ai-billing.routes.ts`）⇒ **本文件所有请求都必须携带有效平台令牌**：
 *   ① 缺令牌 ⇒ 401（**不存在的路径同样 401** ⇒「无令牌 401」不是挂载指纹，仅作补充断言）；
 *   ② 持令牌 ⇒ 200；③ 持令牌 + 参数非法 ⇒ 400 ← 这才是本文件使用的挂牌正判据。
 */
const app = express();
app.use(express.json());
app.use(PREFIX, requirePlatformAuth, aiPlatformRouter);
app.use((err: any, _req: any, res: any, _next: any) => {
  // 与生产 error-handler 口径一致：zod 校验失败 ⇒ 400，其余按 statusCode
  if (err instanceof ZodError) {
    res.status(400).json({ success: false, msg: "参数校验失败", code: "400" });
    return;
  }
  const status = err?.statusCode || 500;
  res.status(status).json({ success: false, msg: err?.message || "服务器内部错误", code: String(status) });
});

/** 平台管理员 JWT（真实签发，issuer/audience 与生产一致） */
const PLATFORM_TOKEN = signPlatformToken({
  type: "platform_admin",
  id: 1,
  username: "platform_admin_test",
});

/**
 * 带有效平台令牌的 GET：本单 4 条接口全为**平台级**只读接口，鉴权口径一致，
 * 因此正向 / 空态 / 参数非法 / 空态反测**一律**走 `get()`（只有「无令牌 ⇒ 401」用例例外）。
 */
const get = (pathname: string) =>
  request(app).get(pathname).set("Authorization", `Bearer ${PLATFORM_TOKEN}`);

interface MockOptions {
  /** t_ai_audit_log 迁移 177 新增列命中（缺省 = 两列已就绪） */
  newColumns?: string[];
  /** t_platform_ai_config 阈值候选列命中（缺省 = 无） */
  thresholdColumns?: string[];
  models?: unknown[];
  todayUsage?: unknown[];
  meteringTotal?: number;
  meteringRows?: unknown[];
  shareRows?: unknown[];
}

/** 按 SQL 内容分派 mock（比按调用顺序更稳，避免实现细节变动把用例带偏） */
function setupDb(options: MockOptions = {}): void {
  vi.clearAllMocks();
  dbMocks.query.mockReset();
  dbMocks.queryOne.mockReset();

  const newColumns = options.newColumns ?? ["cost", "deduct_source"];
  dbMocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes("information_schema.COLUMNS") && sql.includes("t_ai_audit_log")) {
      return newColumns.map((columnName) => ({ columnName }));
    }
    if (sql.includes("information_schema.COLUMNS") && sql.includes("t_platform_ai_config")) {
      return (options.thresholdColumns ?? []).map((columnName) => ({ columnName }));
    }
    if (sql.includes("FROM t_ai_external_model")) return options.models ?? [];
    if (sql.includes("GROUP BY a.model")) return options.shareRows ?? [];
    if (sql.includes("FROM t_ai_audit_log") && sql.includes("GROUP BY model")) {
      return options.todayUsage ?? [];
    }
    if (sql.includes("FROM t_ai_audit_log a")) return options.meteringRows ?? [];
    throw new Error(`未预期的 SQL：${sql}`);
  });
  dbMocks.queryOne.mockImplementation(async (sql: string) => {
    if (sql.includes("COUNT(*) AS total FROM t_ai_audit_log a")) {
      return { total: options.meteringTotal ?? 0 };
    }
    throw new Error(`未预期的 SQL：${sql}`);
  });
}

const sqlOf = (call: unknown[]): string => String(call[0]);
const paramsOf = (call: unknown[]): unknown[] => (call[1] as unknown[]) ?? [];
const allSql = (): string => dbMocks.query.mock.calls.map((call) => String(call[0])).join("\n");

beforeEach(() => setupDb());

// =====================================================================
// 一、挂载证明（真实鉴权守卫）
// =====================================================================
describe("C5-1 挂载证明：真实 requirePlatformAuth", () => {
  it("routeConfig：prefix=/api/platform/ai（逐字钉死）、auth=requirePlatformAuth、router 同一实例", () => {
    expect(routeConfig.prefix).toBe("/api/platform/ai");
    expect(routeConfig.auth).toBe("requirePlatformAuth");
    expect(routeConfig.router).toBe(aiPlatformRouter);
  });

  it("router 级挂载了 requirePlatformAuth 守卫", () => {
    const guardLayer = (aiPlatformRouter as any).stack.find(
      (layer: any) => layer.handle === (requirePlatformAuth as any)
    );
    expect(guardLayer).toBeTruthy();
  });

  it("① 持有效平台令牌 ⇒ 200（挂载正判据，非 404）", async () => {
    const res = await get(`${PREFIX}/public-models`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.records).toEqual([]);
  });

  it("② 持有效令牌 + 参数非法 ⇒ 400（而不是 401/404）", async () => {
    const badPage = await get(`${PREFIX}/metering-log`).query({ pageSize: 0 });
    expect(badPage.status).toBe(400);

    const badDate = await get(`${PREFIX}/model-share`).query({ startDate: "2026-9-1" });
    expect(badDate.status).toBe(400);
  });

  it("无从令牌 ⇒ 401（仅补充断言：前缀级鉴权闸门对不存在路径同样 401，故不作挂载指纹）", async () => {
    const mounted = await request(app).get(`${PREFIX}/public-models`);
    const notExist = await request(app).get(`${PREFIX}/not-exist-endpoint`);

    expect(mounted.status).toBe(401);
    expect(notExist.status).toBe(401);
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it("鉴权反测：4 条端点缺令牌一律 401，且都不触达数据库（派单卡 §四「每条端点 1 反向（鉴权）」）", async () => {
    for (const endpoint of ["public-models", "metering-log", "abnormal-tenants", "model-share"]) {
      const res = await request(app).get(`${PREFIX}/${endpoint}`);
      expect(res.status, endpoint).toBe(401);
    }
    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });
});

// =====================================================================
// 二、GET /api/platform/ai/public-models
// =====================================================================
describe("C5-1 GET /public-models（平台公共模型）", () => {
  it("正向：既有列透出 + 无载体字段 null + 今日调用现算（不造 0、不造字典）", async () => {
    setupDb({
      models: [
        {
          id: 3,
          name: "custom_kimi",
          displayName: "Kimi",
          modelName: "moonshot-v1-8k",
          enabled: 1,
          sortOrder: 10,
          // 密钥列故意带值：用于证明响应体里绝不透出（服务层只 select 白名单列）
          api_key: "sk-c5-1-secret",
        },
        {
          id: 4,
          name: "custom_glm",
          displayName: "GLM",
          modelName: "glm-4-plus",
          enabled: 0,
          sortOrder: 20,
        },
      ],
      todayUsage: [{ model: "moonshot-v1-8k", calls: 7, cost: null }],
    });

    const res = await get(`${PREFIX}/public-models`);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.total).toBe(2);
    expect(data.priceUnit).toBeNull();
    expect(data.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const kimi = data.records[0];
    expect(kimi.name).toBe("custom_kimi");
    expect(kimi.modelName).toBe("moonshot-v1-8k");
    expect(kimi.enabled).toBe(true);
    expect(kimi.todayCalls).toBe(7);
    // 无单价列 ⇒ 今日费用无记录，返回 null（不填 0）
    expect(kimi.todayCost).toBeNull();
    // 无载体字段一律 null（不造值、不写死字典）
    expect(kimi.vendor).toBeNull();
    expect(kimi.scene).toBeNull();
    expect(kimi.inputPrice).toBeNull();
    expect(kimi.outputPrice).toBeNull();

    const glm = data.records[1];
    expect(glm.enabled).toBe(false);
    expect(glm.todayCalls).toBe(0);

    expect(data.unavailable.map((item: any) => item.key).sort()).toEqual(
      ["inputPrice", "outputPrice", "scene", "vendor"].sort()
    );
    // 密钥字段绝不透出：mock 行里带真实密钥值，响应体（records）任何位置都不得出现，
    // 且行对象里不得出现 api_key / apiKey 键（contractNotes 里的“api_key”为提示文案，不算透出）
    expect(JSON.stringify(data.records)).not.toContain("sk-c5-1-secret");
    expect(JSON.stringify(data.records)).not.toContain("api_key");
    expect(JSON.stringify(data.records)).not.toContain("apiKey");
    expect("api_key" in kimi).toBe(false);
    expect("apiKey" in kimi).toBe(false);
  });

  it("空态：模型表无数据 ⇒ records: []、total 0，且不报 500", async () => {
    setupDb({ models: [], todayUsage: [] });

    const res = await get(`${PREFIX}/public-models`);

    expect(res.status).toBe(200);
    expect(res.body.data.records).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it("今日调用来自 t_ai_audit_log 明细（不得用 t_ai_usage_daily 近似）", async () => {
    setupDb({ models: [], todayUsage: [] });

    await get(`${PREFIX}/public-models`);

    expect(allSql()).toContain("FROM t_ai_audit_log");
    expect(allSql()).not.toContain("t_ai_usage_daily");
  });
});

// =====================================================================
// 三、GET /api/platform/ai/metering-log
// =====================================================================
describe("C5-1 GET /metering-log（逐次计量流水）", () => {
  const ROW = {
    id: 101,
    createdAt: "2026-09-24 03:05:06",
    tenantId: "t-1",
    tenantName: "测试酒水商行",
    intent: "chat",
    model: "deepseek-chat",
    provider: "deepseek",
    deductSource: "points",
    promptTokens: 1200,
    completionTokens: 340,
    cost: "1.2345",
    success: 1,
    errorMessage: null,
  };

  it("正向：字段逐项映射（场景取 intent / 扣减来源 / Token / 费用 / 状态）+ 分页回显", async () => {
    setupDb({ meteringTotal: 1, meteringRows: [ROW] });

    const res = await get(`${PREFIX}/metering-log`).query({ page: 1, pageSize: 20 });
    const data = res.body.data;
    const row = data.records[0];

    expect(res.status).toBe(200);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
    expect(data.costUnit).toBe("CNY");
    expect(data.costScale).toBe(4);

    expect(row.time).toBe("2026-09-24 03:05:06");
    expect(row.tenantId).toBe("t-1");
    expect(row.tenantName).toBe("测试酒水商行");
    expect(row.scene).toBe("chat");
    expect(row.model).toBe("deepseek-chat");
    expect(row.deductSource).toBe("points");
    expect(row.promptTokens).toBe(1200);
    expect(row.completionTokens).toBe(340);
    expect(row.totalTokens).toBe(1540);
    expect(row.cost).toBe(1.2345);
    expect(row.success).toBe(true);
    expect(row.status).toBe("SUCCESS");
    expect(row.errorMessage).toBeNull();
    // 场景列必须是既有列 intent 的透出，不做服务层映射
    expect(data.contractNotes.join(" ")).toContain("intent");
  });

  it("历史行 cost / deduct_source 为 NULL ⇒ 返回 null（不报 500、不填 0）", async () => {
    setupDb({
      meteringTotal: 1,
      meteringRows: [{ ...ROW, cost: null, deductSource: null, success: 0, errorMessage: "上游超时" }],
    });

    const res = await get(`${PREFIX}/metering-log`);
    const row = res.body.data.records[0];

    expect(res.status).toBe(200);
    expect(row.cost).toBeNull();
    expect(row.deductSource).toBeNull();
    expect(row.status).toBe("FAILED");
    expect(row.errorMessage).toBe("上游超时");
  });

  it("迁移 177 未执行（列缺失）⇒ 不报 500：SQL 退化读 NULL + unavailable 登记", async () => {
    setupDb({ newColumns: [], meteringTotal: 0, meteringRows: [] });

    const res = await get(`${PREFIX}/metering-log`);

    expect(res.status).toBe(200);
    expect(res.body.data.records).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.unavailable.map((item: any) => item.key).sort()).toEqual([
      "cost",
      "deductSource",
    ]);
    expect(allSql()).toContain("NULL AS cost");
    expect(allSql()).toContain("NULL AS deductSource");
  });

  it("空态：无明细 ⇒ records: []、total 0", async () => {
    setupDb({ meteringTotal: 0, meteringRows: [] });

    const res = await get(`${PREFIX}/metering-log`);

    expect(res.status).toBe(200);
    expect(res.body.data.records).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it("筛选与分页进入 SQL：tenantId/model/provider/日期区间 + LIMIT/OFFSET", async () => {
    setupDb({ meteringTotal: 0, meteringRows: [] });

    const res = await get(`${PREFIX}/metering-log`).query({
      tenantId: "t-1",
      model: "deepseek-chat",
      provider: "deepseek",
      startDate: "2026-09-01",
      endDate: "2026-09-24",
      page: 2,
      pageSize: 10,
    });

    expect(res.status).toBe(200);
    const countSql = sqlOf(dbMocks.queryOne.mock.calls[0]);
    expect(countSql).toContain("a.tenant_id = ?");
    expect(countSql).toContain("a.model = ?");
    expect(countSql).toContain("a.provider = ?");
    expect(countSql).toContain("a.created_at >= ?");
    expect(countSql).toContain("a.created_at < ?");
    expect(paramsOf(dbMocks.queryOne.mock.calls[0])).toEqual([
      "t-1",
      "deepseek-chat",
      "deepseek",
      "2026-09-01 00:00:00",
      "2026-09-25 00:00:00",
    ]);
    // 列表查询：同筛选参数 + pageSize/offset（第 2 页 每页 10 ⇒ offset 10）
    const listCall = dbMocks.query.mock.calls[dbMocks.query.mock.calls.length - 1];
    expect(paramsOf(listCall as unknown[])).toEqual([
      "t-1",
      "deepseek-chat",
      "deepseek",
      "2026-09-01 00:00:00",
      "2026-09-25 00:00:00",
      10,
      10,
    ]);
  });

  it("反向：参数非法 ⇒ 400 且不触达数据库（page / pageSize / 日期格式 / 起止倒置）", async () => {
    const cases = [
      { page: 0 },
      { pageSize: 0 },
      { pageSize: 101 },
      { startDate: "2026/09/01" },
      { startDate: "2026-09-24", endDate: "2026-09-01" },
      { tenantId: "" },
    ];

    for (const query of cases) {
      const res = await get(`${PREFIX}/metering-log`).query(query);
      expect(res.status, JSON.stringify(query)).toBe(400);
    }

    expect(dbMocks.query).not.toHaveBeenCalled();
    expect(dbMocks.queryOne).not.toHaveBeenCalled();
  });

  /**
   * 真库回归锁（2026-09-25 C5-1b，P0）：跨表 JOIN 的 collation 混用。
   *
   * 生产实测（2026-09-25 01:26 pm2 `zhixiang-api-out.log`）：
   *   `[ERROR] [GET] /api/platform/ai/metering-log — Illegal mix of collations
   *    (utf8mb4_0900_ai_ci,IMPLICIT) and (utf8mb4_unicode_ci,IMPLICIT) for operation '='`
   * 依据 DDL：`t_ai_audit_log.tenant_id` = utf8mb4_unicode_ci（121:80 显式），
   *   `t_tenant.id` = utf8mb4_0900_ai_ci（029:31 未写 COLLATE ⇒ 跟库默认，001:9）⇒ 两侧同为
   *   IMPLICIT，真库 `=` 报 1267。
   *
   * ⚠️ 本断言在 mock / SQLite 下**盖不住**真库 1267：本文件 `shared/db` 全被 vi.mock 桩掉，
   *   不会有任何真实比较发生（SQLite 也没有 MySQL 的 collation coercion 规则，"乱给 collation"
   *   在 SQLite 里既不报错也不影响结果）。因此这里锁的是**生成的 SQL 文本**——把"必须显式
   *   COLLATE"这条修复固化成回归门禁，防止后续重写 SQL 时静默退回。
   */
  it("跨表 JOIN 谓词带显式 COLLATE（utf8mb4_0900_ai_ci，加在非索引侧）", async () => {
    setupDb({ meteringTotal: 0, meteringRows: [] });

    const res = await get(`${PREFIX}/metering-log`).query({ tenantId: "t-1" });
    expect(res.status).toBe(200);

    const listSql = dbMocks.query.mock.calls
      .map((call) => String(call[0]))
      .find((sql) => sql.includes("LEFT JOIN t_tenant"));
    expect(listSql).toBeTruthy();
    // 正判据：JOIN 谓词上的比较 collation 被钉死（= t_tenant.id 自身 collation，保住 PRIMARY 探测）
    expect(listSql).toContain("t.id = a.tenant_id COLLATE utf8mb4_0900_ai_ci");
    // 且只此一处 COLLATE（筛选侧不得跟着加）
    expect((listSql as string).match(/COLLATE/g)?.length).toBe(1);

    // 反判据：筛选条件保持"裸列 = 参数"（参数 coercible，本来就无 1267；加 COLLATE 反使
    // idx_tenant_id / idx_tenant_created（unicode_ci）collation 不匹配丢索引）。
    expect(listSql).toContain("a.tenant_id = ?");
    const countSql = sqlOf(dbMocks.queryOne.mock.calls[0]);
    expect(countSql).not.toContain("COLLATE");
  });
});

// =====================================================================
// 四、GET /api/platform/ai/abnormal-tenants
// =====================================================================
describe("C5-1 GET /abnormal-tenants（异常用量租户）", () => {
  it("阈值无载体 ⇒ thresholdSource=UNAVAILABLE + 不计算异常数（records []、count null）", async () => {
    setupDb({ thresholdColumns: [] });

    const res = await get(`${PREFIX}/abnormal-tenants`);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.thresholdSource).toBe("UNAVAILABLE");
    expect(data.thresholds).toBeNull();
    expect(data.thresholdColumns).toEqual([]);
    expect(data.abnormalTenantCount).toBeNull();
    expect(data.records).toEqual([]);
    expect(data.total).toBe(0);
    expect(String(data.criteria)).toContain("t_ai_usage_daily");
    expect(data.unavailable[0].key).toBe("thresholdSource");
    // 「未计算」不得用 0 冒充
    expect(JSON.stringify(data)).not.toContain('"abnormalTenantCount":0');
  });

  it("不计算 = 不查用量表：全程未出现 t_ai_usage_daily", async () => {
    setupDb({ thresholdColumns: [] });

    await get(`${PREFIX}/abnormal-tenants`);

    expect(allSql()).toContain("t_platform_ai_config");
    expect(allSql()).not.toContain("t_ai_usage_daily");
  });

  it("即使表内存在同名候选列，口径未裁定 ⇒ 仍不计算，只如实回显探测结果", async () => {
    setupDb({ thresholdColumns: ["daily_cost_threshold"] });

    const res = await get(`${PREFIX}/abnormal-tenants`);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.thresholdColumns).toEqual(["daily_cost_threshold"]);
    expect(data.thresholdSource).toBe("UNAVAILABLE");
    expect(data.abnormalTenantCount).toBeNull();
    expect(data.records).toEqual([]);
    expect(allSql()).not.toContain("t_ai_usage_daily");
  });
});

// =====================================================================
// 五、GET /api/platform/ai/model-share
// =====================================================================
describe("C5-1 GET /model-share（模型占比）", () => {
  it("正向：按逐次明细分组 + 占比后端算好（%）+ 费用部分覆盖可见", async () => {
    setupDb({
      shareRows: [
        {
          model: "deepseek-chat",
          calls: 3,
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
          cost: "0.3000",
          costRecordedRows: 1,
        },
        {
          model: "glm-4-plus",
          calls: 1,
          promptTokens: 100,
          completionTokens: 0,
          totalTokens: 100,
          cost: null,
          costRecordedRows: 0,
        },
      ],
    });

    const res = await get(`${PREFIX}/model-share`);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.total).toBe(2);
    expect(data.shareUnit).toBe("PERCENT");
    expect(data.shareScale).toBe(2);
    expect(data.totals.callCount).toBe(4);
    expect(data.totals.totalTokens).toBe(1600);
    expect(data.totals.cost).toBe(0.3);
    expect(data.totals.costRecordedRows).toBe(1);

    expect(data.records[0].model).toBe("deepseek-chat");
    expect(data.records[0].callShare).toBe(75);
    expect(data.records[0].tokenShare).toBe(93.75);
    expect(data.records[0].cost).toBe(0.3);
    expect(data.records[0].costRecordedRows).toBe(1);
    // 无 cost 记录的行 ⇒ null（不填 0）
    expect(data.records[1].cost).toBeNull();
    expect(data.records[1].costRecordedRows).toBe(0);
    expect(data.records[1].callShare).toBe(25);
  });

  it("口径断言：SQL 来自 t_ai_audit_log 且**不出现** t_ai_usage_daily（裁定 §三.3）", async () => {
    setupDb({ shareRows: [] });

    await get(`${PREFIX}/model-share`);

    // 聚合 SQL 本身（information_schema 探测语句也含 t_ai_audit_log 字样，故按 GROUP BY 定位）
    const shareSql = dbMocks.query.mock.calls
      .map((call) => String(call[0]))
      .find((sql) => sql.includes("GROUP BY a.model"));
    expect(shareSql).toBeTruthy();
    expect(shareSql).toContain("FROM t_ai_audit_log a");
    expect(shareSql).not.toContain("t_ai_usage_daily");
    expect(shareSql).toContain("COUNT(*) AS calls");
    // 更强断言：整轮请求的所有 SQL 里都不许出现日聚合表（禁止近似冒充）
    expect(allSql()).not.toContain("t_ai_usage_daily");
  });

  it("空态：无明细 ⇒ records: []、total 0、totals 全 0（不产生 NaN、不造日期）", async () => {
    setupDb({ shareRows: [] });

    const res = await get(`${PREFIX}/model-share`);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.records).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.totals).toEqual({
      callCount: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: null,
      costRecordedRows: 0,
    });
    expect(data.scope).toEqual({ startDate: null, endDate: null });
  });

  it("迁移 177 未执行 ⇒ 不报 500：cost 走 NULL 且 unavailable 登记", async () => {
    setupDb({ newColumns: [], shareRows: [] });

    const res = await get(`${PREFIX}/model-share`);

    expect(res.status).toBe(200);
    expect(res.body.data.unavailable.map((item: any) => item.key)).toEqual(["cost"]);
    expect(sqlOf(dbMocks.query.mock.calls[1])).toContain("SUM(NULL)");
  });

  it("反向：参数非法 ⇒ 400 且不触达数据库（日期格式 / 起止倒置）", async () => {
    const badFormat = await get(`${PREFIX}/model-share`).query({ endDate: "20260924" });
    expect(badFormat.status).toBe(400);

    const reversed = await get(`${PREFIX}/model-share`).query({
      startDate: "2026-09-24",
      endDate: "2026-09-01",
    });
    expect(reversed.status).toBe(400);

    expect(dbMocks.query).not.toHaveBeenCalled();
  });
});
