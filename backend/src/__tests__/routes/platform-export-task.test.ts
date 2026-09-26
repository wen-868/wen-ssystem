/**
 * C6-2-T2-F1：平台报表导出任务中心 6 条端点的路由级测试
 * （路径字面契约 / 方法 / 鉴权 / 参数校验 400 / 业务码 404·400 / 不吞错 / download 不假成功）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T2-F1.md 交付物①②、验收标准①②③④⑤⑥
 *      + 该卡「R7 派单前内部一致性澄清」第 1 条（6 条即全集，无第 7 条）、第 2 条（反向路径断言翻正）
 * 范式：src/__tests__/routes/platform-ticket.test.ts（create-test-app 夹具 + service mock）。
 * 鉴权反向：单独挂载**真实** requirePlatformAuth（不带 Authorization）⇒ 401。
 *
 * 路径口径（本单核心判据）：前缀 = 前端**既有字面契约** `/api/platform/reports/export`。
 * F1 更正（2026-09-27，C6-3-0 接线批把 4 条字面路径下沉到封装层）：字面路径现在位于
 * `saas-admin/src/api.ts`（axios baseURL=/api ⇒ 写作 `/platform/...`），`Dashboard.vue` 只调用封装函数。
 * ⇒ 提取器改为扫 **api.ts + Dashboard.vue 两个文件的并集**，并把 `/platform/…` 归一为 `/api/platform/…`；
 * 契约强度不变（仍是"恰好那 4 条"），只是不再把口径绑死在某个文件位置上。
 * 下面的契约用例从这两个文件原文提取这 4 处字面路径，逐条断言它们都落在后端注册路径上 ——
 * 路由前缀一旦漂移（例如改回 /api/platform/export-tasks），该断言必红（反测 ④a 的判红点）。
 * 另 2 条（list / retry）是后端新增，不与前端冲突，也不与前端既有 4 处重名。
 *
 * 反例清单（卡内点名，逐条落用例）：
 *   · format 非法 ⇒ 400；status 查询参数非法 ⇒ 400；pageSize > 100 ⇒ 400；id 非数字 ⇒ 400
 *   · 不存在的任务 ⇒ 404（status / download / logs / retry 四处）
 *   · SUCCESS 状态 retry ⇒ 400；重复 retry（状态已是 PENDING）⇒ 400
 *   · 创建返回必须是 PENDING（不是 GENERATING/SUCCESS）——"假成功"回归的第一道门
 *   · download 无 file_url ⇒ 404 + 明确 msg（**不是** 200 空响应）——"假下载"门（反测 ④b 的判红点）
 *
 * 注意（踩坑 [118]，2026-09-26 实测复核）：本次执行所在沙箱**无子进程能力**（esbuild `spawn EPERM`），
 * vitest 无法在沙箱内直接 `npx vitest run` ⇒ 本文件由既有临时夹具（tsc 编译成 JS + pool=threads）复跑，
 * 权威判绿由凌舟在本机执行。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTestApp } from "../fixtures/create-test-app";

const mocks = vi.hoisted(() => ({
  listExportTasks: vi.fn(),
  createExportTask: vi.fn(),
  getExportTaskDetail: vi.fn(),
  listExportTaskLogs: vi.fn(),
  retryExportTask: vi.fn(),
}));

vi.mock("../../services/platform/platform-export-task.service", () => ({
  EXPORT_TASK_PERMISSIONS: {
    list: "export:view",
    create: "export:create",
    detail: "export:view",
    download: "export:view",
    logs: "export:view",
    retry: "export:retry",
  },
  EXPORT_TASK_PERMISSION_CODES: ["export:view", "export:create", "export:retry"],
  EXPORT_TASK_STATUSES: ["PENDING", "GENERATING", "SUCCESS", "FAILED"],
  EXPORT_TASK_FORMATS: ["CSV", "XLSX"],
  EXPORT_TASK_LOG_LEVELS: ["INFO", "WARN", "ERROR"],
  CREATED_STATUS: "PENDING",
  CREATED_LOG_MESSAGE: "任务已创建，等待生成器接入",
  RETRY_FROM_STATUS: "FAILED",
  RETRY_TO_STATUS: "PENDING",
  RETRY_LOG_MESSAGE: "任务已重排为 PENDING，等待生成器接入",
  buildTaskNo: vi.fn(() => "EXP202609261030000001"),
  listExportTasks: mocks.listExportTasks,
  createExportTask: mocks.createExportTask,
  getExportTaskDetail: mocks.getExportTaskDetail,
  listExportTaskLogs: mocks.listExportTaskLogs,
  retryExportTask: mocks.retryExportTask,
}));

import { AppError } from "../../shared/app-error";
import { routeConfigs, platformExportTaskRouter } from "../../routes/platform-export-task.routes";
import { requirePlatformAuth } from "../../middleware/auth";

/** 前端既有字面契约前缀（C6-3-0 后其 4 条字面路径位于 saas-admin/src/api.ts）—— 独立常量，**不**从路由文件读取 */
const PREFIX = "/api/platform/reports/export";

/** 路由文件声明的前缀（是否等于前端字面契约，由下面的声明用例与契约用例单独把关） */
const declaredPrefixes = routeConfigs.map((config) => config.prefix);

/**
 * 测试应用一律挂在**前端字面契约前缀**上（PREFIX）：请求级用例验的是端点行为，
 * 前缀与契约是否一致由「路由声明」「前后端字面契约一致性」两组用例把关 ——
 * 这样反测 ④a（把前缀改回 /api/platform/export-tasks）时，判红的正是那两条契约用例，定位清晰。
 */
const app = createTestApp({ prefix: PREFIX, router: platformExportTaskRouter });

/** 真实鉴权守卫（无 Authorization ⇒ 401），用于本前缀的「无令牌」反测 */
const guardedApp = express();
guardedApp.use(express.json());
// S3-119：测试内自建 app 也必须显式挂限流——CodeQL `js/missing-rate-limiting` 只认注册点上内联出现的 `rateLimit(...)`
guardedApp.use(rateLimit({ windowMs: 60_000, max: 10_000 })); // 测试用高上限 10000：避免用例之间互相触发 429
guardedApp.use(PREFIX, requirePlatformAuth, platformExportTaskRouter);
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

/** 路由声明的「方法 + 相对路径」全集（用于"路径钉死、不得自拟/增减"的结构断言） */
function declaredRoutes(): string[] {
  const stack = ((platformExportTaskRouter as any).stack ?? []) as any[];
  return stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`)
    );
}

/** 后端注册的全量「前缀 + 路径」（去重、排序；用于与前端字面契约逐条比对） */
function declaredFullPaths(): string[] {
  const stack = ((platformExportTaskRouter as any).stack ?? []) as any[];
  const relativePaths = stack
    .filter((layer) => layer.route)
    .map((layer) => String(layer.route.path))
    .map((path) => (path === "/" ? "" : path));
  const full = new Set<string>();
  for (const prefix of declaredPrefixes) {
    for (const path of relativePaths) {
      full.add(`${prefix}${path}`);
    }
  }
  return [...full].sort();
}

/* ── 契约提取器（F1 更正：口径从「绑死文件位置」改为「扫字面路径的真实使用文件」）── */
/* >>>F1-CONTRACT-EXTRACTOR-START<<< */

/**
 * 前端承载导出端点字面路径的文件（**恰好这两个，不扫全仓**）：
 * · api.ts —— C6-3-0 接线批把 4 条字面路径下沉到此处（写 `/platform/...`，前缀由 axios baseURL=/api 补）；
 * · Dashboard.vue —— 页面层调用处/契约注释（写完整 `/api/platform/...`）。
 * 今后字面路径若再次搬家，**必须同步改这个清单**（漏一个 ⇒ 提取集会少条 ⇒ 契约用例必红）。
 */
const EXPORT_CONTRACT_RELATIVE_PATHS = [
  "saas-admin/src/api.ts",
  "saas-admin/src/views/Dashboard.vue",
];

/**
 * 定位前端契约文件（兼容 cwd=backend / cwd=仓库根 / cwd=夹具目录三种跑法）。
 * 清单内**每个文件都必须找到**；缺一个**直接抛错**，不静默跳过、不降级为"扫到几算几"
 * —— 契约用例静默跳过就等于假门禁。
 */
function locateExportContractSources(): string[] {
  const roots = ["..", ".", "../.."];
  const found: string[] = [];
  const missing: string[] = [];
  for (const rel of EXPORT_CONTRACT_RELATIVE_PATHS) {
    const hit = roots
      .map((root) => resolve(process.cwd(), root, rel))
      .find((candidate) => existsSync(candidate));
    if (hit) {
      found.push(hit);
    } else {
      missing.push(rel);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `未找到前端契约文件：${missing.join(" | ")}（cwd=${process.cwd()}）—— ` +
        `导出端点字面路径若再次搬家，必须同步更新 EXPORT_CONTRACT_RELATIVE_PATHS，不得静默放宽`
    );
  }
  return found;
}

/**
 * 从前端原文提取导出端点字面契约。
 * · 前缀归一：`/api/platform/…`（Dashboard.vue 完整写法）与 `/platform/…`（api.ts 靠 baseURL=/api 补前缀）
 *   两种写法统一归一为 `/api/platform/…`，再与后端注册路径逐字比较；
 * · 模板串里的 `${...}` 归一化为 `:id`。
 * 例：`/platform/reports/export/${id}/status` ⇒ `/api/platform/reports/export/:id/status`
 */
function frontendExportContract(): string[] {
  const found: string[] = [];
  for (const file of locateExportContractSources()) {
    const source = readFileSync(file, "utf8");
    const matches =
      source.match(/(?:\/api)?\/platform\/reports\/export(?:\/\$\{[^}]*\}|\/[A-Za-z0-9_.-]+)*/g) ?? [];
    found.push(...matches);
  }
  const normalized = found.map((path) =>
    path.replace(/\$\{[^}]*\}/g, ":id").replace(/^\/platform\//, "/api/platform/")
  );
  return [...new Set(normalized)].sort();
}

/* >>>F1-CONTRACT-EXTRACTOR-END<<< */

const TASK_DETAIL = {
  id: 7,
  taskNo: "EXP202609261030000001",
  exportType: "tenantFinance",
  period: "thisMonth",
  format: "CSV",
  status: "PENDING",
  progress: 0,
  fileUrl: null,
  fileSize: null,
  errorMessage: null,
  createdAt: "2026-09-26 10:30:00",
  startedAt: null,
  finishedAt: null,
};

describe("C6-2-T2-F1 · 路由声明（路径钉死 + 全量 requirePlatformAuth）", () => {
  it("前缀与前端字面契约逐字一致（/api/platform/reports/export），auth 为 requirePlatformAuth", () => {
    expect(declaredPrefixes).toEqual(["/api/platform/reports/export"]);
    expect(routeConfigs.map((c) => c.auth)).toEqual(["requirePlatformAuth"]);
  });

  it("只声明卡内 6 条端点（方法 + 路径），无自拟无增减，且旧前缀 export-tasks 不再出现", () => {
    expect(declaredRoutes().sort()).toEqual(
      [
        "GET /",
        "POST /",
        "GET /:id/status",
        "GET /:id/download",
        "GET /:id/logs",
        "POST /:id/retry",
      ].sort()
    );
    // T2 原有的 "not.toContain('download')" / "not.toContain('/status')" 是该单按错误前缀钉死的路径断言；
    // 本单按卡内交付物① 新增 status/download ⇒ 依 R7 第 2 条翻正为「这 6 条必须存在」+「旧前缀不得出现」。
    const paths = `${declaredRoutes().join("\n")}\n${declaredFullPaths().join("\n")}`;
    expect(paths).not.toContain("export-tasks");
    expect(declaredRoutes()).not.toContain("GET /:id");
  });

  it("无令牌访问 6 条端点 ⇒ 全部 401（不落到业务层）", async () => {
    const results = await Promise.all([
      request(guardedApp).get(PREFIX),
      request(guardedApp).post(PREFIX).send({ exportType: "tenantFinance", format: "CSV" }),
      request(guardedApp).get(`${PREFIX}/1/status`),
      request(guardedApp).get(`${PREFIX}/1/download`),
      request(guardedApp).get(`${PREFIX}/1/logs`),
      request(guardedApp).post(`${PREFIX}/1/retry`),
    ]);
    for (const res of results) {
      expect(res.status).toBe(401);
    }
    expect(mocks.listExportTasks).not.toHaveBeenCalled();
    expect(mocks.createExportTask).not.toHaveBeenCalled();
    expect(mocks.getExportTaskDetail).not.toHaveBeenCalled();
    expect(mocks.listExportTaskLogs).not.toHaveBeenCalled();
    expect(mocks.retryExportTask).not.toHaveBeenCalled();
  });
});

describe("C6-2-T2-F1 · 前后端字面契约一致性（本单核心判据）", () => {
  it("前端 4 处字面路径（api.ts 封装 + Dashboard.vue）4/4 逐字落到后端注册路径上（反测 ④a 的判红点）", () => {
    const frontend = frontendExportContract();
    expect(frontend).toEqual([
      "/api/platform/reports/export",
      "/api/platform/reports/export/:id/download",
      "/api/platform/reports/export/:id/logs",
      "/api/platform/reports/export/:id/status",
    ]);
    const backend = declaredFullPaths();
    for (const literal of frontend) {
      expect(backend).toContain(literal);
    }
  });

  it("后端全量注册路径 = 前端 4 处字面 + 后端新增 retry（6 条端点 / 5 条不同路径，无第 7 条）", () => {
    const backend = declaredFullPaths();
    const frontend = new Set(frontendExportContract());
    expect(backend.filter((path) => !frontend.has(path))).toEqual([
      "/api/platform/reports/export/:id/retry",
    ]);
    expect(backend).toHaveLength(5);
    expect(declaredRoutes()).toHaveLength(6);
  });
});

describe("C6-2-T2-F1 · #1 GET /api/platform/reports/export（列表）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 空态（total 0 / records []），并按默认分页参数调用 service", async () => {
    mocks.listExportTasks.mockResolvedValue({ total: 0, page: 1, pageSize: 20, records: [] });

    const res = await request(app).get(PREFIX);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data).toEqual({ total: 0, page: 1, pageSize: 20, records: [] });
    const arg = mocks.listExportTasks.mock.calls[0][0] as any;
    expect(arg.page).toBe(1);
    expect(arg.pageSize).toBe(20);
    expect(arg.status).toBeUndefined();
  });

  it("status 四态逐个可用；非法 status ⇒ 400 且不调用 service", async () => {
    mocks.listExportTasks.mockResolvedValue({ total: 0, page: 1, pageSize: 20, records: [] });

    for (const status of ["PENDING", "GENERATING", "SUCCESS", "FAILED"]) {
      const res = await request(app).get(`${PREFIX}?status=${status}`);
      expect(res.status).toBe(200);
      const calls = mocks.listExportTasks.mock.calls;
      expect((calls[calls.length - 1][0] as any).status).toBe(status);
    }

    const before = mocks.listExportTasks.mock.calls.length;
    const bad = await request(app).get(`${PREFIX}?status=FOO`);
    expect(bad.status).toBe(400);
    expect(mocks.listExportTasks.mock.calls.length).toBe(before);
  });

  it("page/pageSize 边界：page=0 ⇒ 400；pageSize=101 ⇒ 400（超限显式拒绝，不静默夹取）；pageSize=100 ⇒ 200", async () => {
    mocks.listExportTasks.mockResolvedValue({ total: 0, page: 1, pageSize: 100, records: [] });

    expect((await request(app).get(`${PREFIX}?page=0`)).status).toBe(400);
    expect((await request(app).get(`${PREFIX}?pageSize=101`)).status).toBe(400);
    expect((await request(app).get(`${PREFIX}?pageSize=100&page=2`)).status).toBe(200);
    const arg = mocks.listExportTasks.mock.calls[0][0] as any;
    expect(arg.pageSize).toBe(100);
    expect(arg.page).toBe(2);
  });
});

describe("C6-2-T2-F1 · #2 POST /api/platform/reports/export（创建）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + { id, taskNo, status: 'PENDING' }，并把 exportType/period/format + 当前管理员 ID 传给 service", async () => {
    mocks.createExportTask.mockResolvedValue({
      id: 11,
      taskNo: "EXP202609261030000001",
      status: "PENDING",
    });

    const res = await request(app)
      .post(PREFIX)
      .send({ exportType: "tenantFinance", period: "thisMonth", format: "XLSX" });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data).toEqual({
      id: 11,
      taskNo: "EXP202609261030000001",
      status: "PENDING",
    });
    expect(res.body.data.status).not.toBe("GENERATING");
    expect(res.body.data.status).not.toBe("SUCCESS");
    expect(mocks.createExportTask.mock.calls[0][0]).toEqual({
      exportType: "tenantFinance",
      period: "thisMonth",
      format: "XLSX",
      adminId: 1,
    });
  });

  it("CSV/XLSX 两值均可用；period 缺省 / null / 空串三种写法均透传 null（列语义 NULL=未指定）", async () => {
    mocks.createExportTask.mockResolvedValue({ id: 12, taskNo: "EXP202609261030000002", status: "PENDING" });

    const payloads: any[] = [
      { exportType: "resourceCost", format: "CSV" },
      { exportType: "resourceCost", format: "XLSX" },
      { exportType: "resourceCost", format: "CSV", period: null },
      { exportType: "resourceCost", format: "CSV", period: "   " },
    ];
    for (const payload of payloads) {
      const res = await request(app).post(PREFIX).send(payload);
      expect(res.status).toBe(200);
    }
    for (const call of mocks.createExportTask.mock.calls) {
      expect((call[0] as any).period ?? null).toBeNull();
    }
  });

  it("format 非法（excel/PDF/缺省） ⇒ 400 且不调用 service（仅 CSV|XLSX）", async () => {
    for (const payload of [
      { exportType: "tenantFinance", format: "excel" },
      { exportType: "tenantFinance", format: "PDF" },
      { exportType: "tenantFinance" },
    ]) {
      const res = await request(app).post(PREFIX).send(payload as any);
      expect(res.status).toBe(400);
    }
    expect(mocks.createExportTask).not.toHaveBeenCalled();
  });

  it("exportType 为空/缺失 ⇒ 400 且不调用 service", async () => {
    expect((await request(app).post(PREFIX).send({ exportType: "", format: "CSV" })).status).toBe(400);
    expect((await request(app).post(PREFIX).send({ format: "CSV" })).status).toBe(400);
    expect(mocks.createExportTask).not.toHaveBeenCalled();
  });
});

describe("C6-2-T2-F1 · #3 GET /api/platform/reports/export/:id/status（状态 = T2 详情超集）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 任务状态：卡内 9 键与 T2 原有 exportType/period/format/createdAt 全部在（一个字段都不许删）", async () => {
    mocks.getExportTaskDetail.mockResolvedValue(TASK_DETAIL);

    const res = await request(app).get(`${PREFIX}/7/status`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(TASK_DETAIL);
    for (const key of [
      "id",
      "taskNo",
      "status",
      "progress",
      "fileUrl",
      "fileSize",
      "errorMessage",
      "startedAt",
      "finishedAt",
      "exportType",
      "period",
      "format",
      "createdAt",
    ]) {
      expect(Object.keys(res.body.data)).toContain(key);
    }
    expect(mocks.getExportTaskDetail.mock.calls[0][0]).toBe(7);
  });

  it("任务不存在 ⇒ 404（service 抛 AppError，路由层不吞错）", async () => {
    mocks.getExportTaskDetail.mockRejectedValueOnce(new AppError("导出任务不存在：999", 404));

    const res = await request(app).get(`${PREFIX}/999/status`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("404");
  });

  it("id 非数字/非正数 ⇒ 400 且不调用 service；旧裸详情路径 /:id 已不再注册（无第 7 条）", async () => {
    expect((await request(app).get(`${PREFIX}/abc/status`)).status).toBe(400);
    expect((await request(app).get(`${PREFIX}/0/status`)).status).toBe(400);
    expect(mocks.getExportTaskDetail).not.toHaveBeenCalled();

    expect((await request(app).get(`${PREFIX}/7`)).status).toBe(404);
    expect(mocks.getExportTaskDetail).not.toHaveBeenCalled();
  });
});

describe("C6-2-T2-F1 · #4 GET /api/platform/reports/export/:id/download（新增：无文件诚实 404）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("无 file_url ⇒ 404 + 明确 msg「导出文件尚未生成（生成器待接入）」，不得 200、不得文件体（反测 ④b 的判红点）", async () => {
    mocks.getExportTaskDetail.mockResolvedValue({ ...TASK_DETAIL, fileUrl: null, fileSize: null });

    const res = await request(app).get(`${PREFIX}/7/download`);

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(200);
    expect(res.body.code).toBe("404");
    expect(res.body.msg).toBe("导出文件尚未生成（生成器待接入）");
    expect(res.body.data).toBeUndefined();
    expect(String(res.headers["content-type"] ?? "")).not.toContain("octet-stream");
    expect(mocks.getExportTaskDetail.mock.calls[0][0]).toBe(7);
  });

  it("只读：download 不触发任何写端点或列表/日志的 service 调用（不置 SUCCESS、不伪造 file_url）", async () => {
    mocks.getExportTaskDetail.mockResolvedValue({ ...TASK_DETAIL, fileUrl: null });

    await request(app).get(`${PREFIX}/7/download`);

    expect(mocks.listExportTasks).not.toHaveBeenCalled();
    expect(mocks.createExportTask).not.toHaveBeenCalled();
    expect(mocks.listExportTaskLogs).not.toHaveBeenCalled();
    expect(mocks.retryExportTask).not.toHaveBeenCalled();
  });

  it("任务不存在 ⇒ 404（service 抛 AppError，download 不吞错、不回落成 200）", async () => {
    mocks.getExportTaskDetail.mockRejectedValueOnce(new AppError("导出任务不存在：999", 404));

    const res = await request(app).get(`${PREFIX}/999/download`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("404");
  });

  it("id 非数字/非正数 ⇒ 400 且不调用 service", async () => {
    expect((await request(app).get(`${PREFIX}/abc/download`)).status).toBe(400);
    expect((await request(app).get(`${PREFIX}/0/download`)).status).toBe(400);
    expect(mocks.getExportTaskDetail).not.toHaveBeenCalled();
  });
});

describe("C6-2-T2-F1 · #5 GET /api/platform/reports/export/:id/logs（日志）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + { logs: [] }（无日志诚实空态）", async () => {
    mocks.listExportTaskLogs.mockResolvedValue({ logs: [] });

    const res = await request(app).get(`${PREFIX}/7/logs`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ logs: [] });
    expect(mocks.listExportTaskLogs.mock.calls[0][0]).toBe(7);
  });

  it("200 + 升序日志（接口原样透出，不重排）", async () => {
    mocks.listExportTaskLogs.mockResolvedValue({
      logs: [
        { level: "INFO", message: "任务已创建，等待生成器接入", createdAt: "2026-09-26 10:30:00" },
        { level: "ERROR", message: "生成器未接入", createdAt: "2026-09-26 10:31:00" },
      ],
    });

    const res = await request(app).get(`${PREFIX}/7/logs`);

    expect(res.status).toBe(200);
    expect(res.body.data.logs.map((l: any) => l.level)).toEqual(["INFO", "ERROR"]);
  });

  it("任务不存在 ⇒ 404", async () => {
    mocks.listExportTaskLogs.mockRejectedValueOnce(new AppError("导出任务不存在：999", 404));

    const res = await request(app).get(`${PREFIX}/999/logs`);

    expect(res.status).toBe(404);
  });
});

describe("C6-2-T2-F1 · #6 POST /api/platform/reports/export/:id/retry（重排）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + { id, taskNo, status: 'PENDING' }（FAILED → PENDING）", async () => {
    mocks.retryExportTask.mockResolvedValue({
      id: 7,
      taskNo: "EXP202609261030000001",
      status: "PENDING",
    });

    const res = await request(app).post(`${PREFIX}/7/retry`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      id: 7,
      taskNo: "EXP202609261030000001",
      status: "PENDING",
    });
    expect(mocks.retryExportTask.mock.calls[0][0]).toBe(7);
  });

  it("SUCCESS 状态 retry ⇒ 400（service 显式拒绝，接口不把它变成 200）", async () => {
    mocks.retryExportTask.mockRejectedValueOnce(
      new AppError("仅失败任务可重排：当前状态为 SUCCESS，只允许 FAILED → PENDING", 400)
    );

    const res = await request(app).post(`${PREFIX}/7/retry`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("400");
  });

  it("重复 retry（状态已回到 PENDING）⇒ 400", async () => {
    mocks.retryExportTask.mockRejectedValueOnce(
      new AppError("仅失败任务可重排：当前状态为 PENDING，只允许 FAILED → PENDING", 400)
    );

    const res = await request(app).post(`${PREFIX}/7/retry`);

    expect(res.status).toBe(400);
  });

  it("任务不存在 ⇒ 404；id 非数字 ⇒ 400", async () => {
    mocks.retryExportTask.mockRejectedValueOnce(new AppError("导出任务不存在：999", 404));
    expect((await request(app).post(`${PREFIX}/999/retry`)).status).toBe(404);
    expect((await request(app).post(`${PREFIX}/abc/retry`)).status).toBe(400);
  });
});
