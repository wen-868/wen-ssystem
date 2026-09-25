/**
 * C6-2-T2（+ F1 修订单）：平台报表导出任务中心服务单测
 * （t_platform_export_task / t_platform_export_task_log，迁移 182）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T2.md 交付物②③、验收标准③④⑤⑥
 *       + docs/tasks/cards/R101-派单-20260926-C6-2-T2-F1.md（仅把端点路径改为前端字面契约
 *         /api/platform/reports/export，并登记 download 的权限点；服务逻辑与 SQL 断言一字未动）
 * 覆盖：
 *   · 列表：空表诚实空态（total 0 / records []）/ total 由真实 COUNT 派生 / status 精确筛选 /
 *     分页（page 默认 1、pageSize 默认 20、offset 计算）/ 字段 camelCase 映射；
 *   · 创建：**创建即 PENDING + progress 0，file_url/file_size/error_message/started_at/finished_at 全 NULL**
 *     （防"假成功"回归的核心断言，对应验收标准④b 与⑤）+ 写一条 INFO 日志「任务已创建，等待生成器接入」；
 *   · 详情：不存在 ⇒ 404；字段映射（fileUrl/fileSize/period 可空且 null 原样透出）；
 *   · 日志：任务不存在 ⇒ 404 且零日志查询；无日志 ⇒ logs: []；
 *     **按 created_at 升序**（SQL 含 ORDER BY created_at ASC、不含 DESC；返回顺序不反转，对应验收标准④c）；
 *   · 状态机：retry **仅** FAILED → PENDING（重置 progress、清空 error_message/file_url/file_size/
 *     started_at/finished_at、写 INFO 日志）；SUCCESS/PENDING/GENERATING/重复 retry ⇒ 400；
 *     不存在 ⇒ 404；并发（UPDATE affectedRows 0）⇒ 400 且不写日志（对应验收标准④a）；
 *   · 权限点常量与 T6 目录的**漂移即红**双向核对（目录出现 export: 域时必须与本文件常量对齐）。
 *
 * 注意（踩坑 [118]，2026-09-26 实测复核）：本次执行所在沙箱**无子进程能力**
 * （`node -e` 里 `child_process.execFileSync` = EPERM；vitest 4 用 esbuild 起子进程转译配置 ⇒ `spawn EPERM`），
 * 故本文件**无法在执行方沙箱内运行**，必须由凌舟在本机 `cd backend && npx vitest run` 执行。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));

import {
  EXPORT_TASK_PERMISSIONS,
  EXPORT_TASK_PERMISSION_CODES,
  EXPORT_TASK_STATUSES,
  EXPORT_TASK_FORMATS,
  EXPORT_TASK_LOG_LEVELS,
  CREATED_STATUS,
  CREATED_LOG_MESSAGE,
  RETRY_FROM_STATUS,
  RETRY_TO_STATUS,
  RETRY_LOG_MESSAGE,
  buildTaskNo,
  listExportTasks,
  createExportTask,
  getExportTaskDetail,
  listExportTaskLogs,
  retryExportTask,
} from "../../../services/platform/platform-export-task.service";
import { PERMISSION_CATALOG } from "../../../services/platform/platform-role.service";
import { AppError } from "../../../shared/app-error";

interface ExecCall {
  sql: string;
  params: unknown[];
}

/** 单行 SQL 便于断言（折叠换行/缩进，保留括号内的占位符列表） */
function flat(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

function execCalls(): ExecCall[] {
  return (mocks.connExecute.mock.calls as unknown[][]).map((call) => ({
    sql: flat(String(call[1])),
    params: (call[2] ?? []) as unknown[],
  }));
}

function queryCalls(): ExecCall[] {
  return (mocks.query.mock.calls as unknown[][]).map((call) => ({
    sql: String(call[0]),
    params: (call[1] ?? []) as unknown[],
  }));
}

/** 一条任务行（列别名口径 = 服务层 TASK_COLUMNS 的别名，与 mysql2 实际返回一致） */
const TASK_ROW = {
  id: 7,
  taskNo: "EXP202609261030000001",
  exportType: "tenantFinance",
  period: "thisMonth" as string | null,
  format: "CSV",
  status: "PENDING" as string,
  progress: 0 as number | string,
  fileUrl: null as string | null,
  fileSize: null as number | string | null,
  errorMessage: null as string | null,
  createdAt: "2026-09-26 10:30:00",
  startedAt: null as unknown,
  finishedAt: null as unknown,
};

describe("C6-2-T2 · 常量口径（状态四态 / 格式两值 / 创建态 / 任务编号 / 权限点）", () => {
  it("状态四态与格式两值与派单卡 + 迁移 182 逐字一致", () => {
    expect([...EXPORT_TASK_STATUSES]).toEqual(["PENDING", "GENERATING", "SUCCESS", "FAILED"]);
    expect([...EXPORT_TASK_FORMATS]).toEqual(["CSV", "XLSX"]);
    expect([...EXPORT_TASK_LOG_LEVELS]).toEqual(["INFO", "WARN", "ERROR"]);
  });

  it("创建态恒为 PENDING（没有任何 worker 时不得是 GENERATING）", () => {
    expect(CREATED_STATUS).toBe("PENDING");
    expect(RETRY_FROM_STATUS).toBe("FAILED");
    expect(RETRY_TO_STATUS).toBe("PENDING");
  });

  it("任务编号：EXP + 14 位时间 + 4 位随机，长度 21 ≤ 列宽 32", () => {
    const taskNo = buildTaskNo(new Date(2026, 8, 26, 10, 30, 5));
    expect(taskNo).toMatch(/^EXP\d{18}$/);
    expect(taskNo.startsWith("EXP20260926103005")).toBe(true);
    expect(taskNo.length).toBeLessThanOrEqual(32);
  });

  it("权限点：本域登记值与 T6 目录（PERMISSION_CATALOG）漂移即红（目录当前无 export 域 ⇒ 期望为空集）", () => {
    expect(EXPORT_TASK_PERMISSIONS.list).toBe("export:view");
    expect(EXPORT_TASK_PERMISSIONS.create).toBe("export:create");
    // F1 新增的 download 读取端点沿用查看权限（不新增权限点取值，仅登记本域端点）
    expect(EXPORT_TASK_PERMISSIONS.download).toBe("export:view");
    expect(EXPORT_TASK_PERMISSIONS.retry).toBe("export:retry");

    // 双向核对：目录里一旦出现 export: 开头的权限点，必须与本文件登记的取值全集一致
    // （T6 目录补齐 export 域时若不与这里对齐，本用例变红，强制同步；当前 0 命中 ⇒ 断言恒真）
    const catalogExportCodes = PERMISSION_CATALOG.filter((entry) =>
      entry.permCode.startsWith("export:")
    ).map((entry) => entry.permCode);
    for (const code of catalogExportCodes) {
      expect(EXPORT_TASK_PERMISSION_CODES).toContain(code);
    }
  });
});

describe("C6-2-T2-F1 · GET /api/platform/reports/export（任务列表）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ insertId: 5, affectedRows: 1 }, undefined]);
  });

  it("空表 ⇒ total 0 / page 1 / pageSize 20 / records []（诚实空态，不造示例任务）", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    const list = await listExportTasks({});

    expect(list).toEqual({ total: 0, page: 1, pageSize: 20, records: [] });
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("total 由真实 COUNT 派生（字符串数字也折算），records 字段逐项 camelCase 映射", async () => {
    mocks.query
      .mockResolvedValueOnce([{ total: "3" }])
      .mockResolvedValueOnce([
        TASK_ROW,
        { ...TASK_ROW, id: 8, taskNo: "EXP202609261030000002", status: "FAILED", progress: 40, errorMessage: "生成器未接入", period: null, format: "XLSX" },
      ]);

    const list = await listExportTasks({});

    expect(list.total).toBe(3);
    expect(list.records).toHaveLength(2);
    expect(list.records[0]).toEqual({
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
    });
    expect(list.records[1].period).toBeNull();
    expect(list.records[1].progress).toBe(40);
    expect(list.records[1].format).toBe("XLSX");
  });

  it("status 精确筛选：COUNT 与 LIST 两条 SQL 都带 WHERE status = ?（不静默忽略筛选）", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await listExportTasks({ status: "FAILED", page: 3, pageSize: 50 });

    const calls = queryCalls();
    expect(calls[0].sql).toContain("WHERE status = ?");
    expect(calls[0].params).toEqual(["FAILED"]);
    expect(calls[1].sql).toContain("WHERE status = ?");
    // 分页参数：where 参数在前，末尾追加 [pageSize, offset]，offset = (3-1)*50 = 100
    expect(calls[1].params).toEqual(["FAILED", 50, 100]);
    expect(calls[1].sql).toContain("LIMIT ? OFFSET ?");
  });

  it("未传 status ⇒ 无 WHERE 条件，分页参数只有 [pageSize, offset]", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await listExportTasks({ page: 1, pageSize: 20 });

    const calls = queryCalls();
    expect(calls[0].sql).not.toContain("WHERE status");
    expect(calls[0].params).toEqual([]);
    expect(calls[1].params).toEqual([20, 0]);
  });
});

describe("C6-2-T2-F1 · POST /api/platform/reports/export（创建，防假成功核心组）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ insertId: 11, affectedRows: 1 }, undefined]);
  });

  it("创建后必须是 PENDING 且 fileUrl 为 null（acceptance ④b 的判红点）", async () => {
    const created = await createExportTask({
      exportType: "tenantFinance",
      period: "thisMonth",
      format: "CSV",
      adminId: 9,
    });

    const calls = execCalls();
    const insert = calls[0];

    // ① 状态以**参数**写入，取值必须是 CREATED_STATUS（= PENDING）；改回 GENERATING/SUCCESS 本用例必红
    expect(insert.params[4]).toBe("PENDING");
    expect(insert.params[5]).toBe(0);
    // ② 文件类四列在 INSERT 里是字面量 NULL：没有生成器就不许有任何"已生成"痕迹
    expect(insert.sql).toContain("VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, NULL)");
    expect(insert.sql).not.toContain("SUCCESS");
    expect(insert.sql).not.toContain("GENERATING");
    // ③ 返回值口径
    expect(created.id).toBe(11);
    expect(created.status).toBe("PENDING");
    expect(created.taskNo).toMatch(/^EXP\d{18}$/);
  });

  it("创建同时写一条 INFO 日志「任务已创建，等待生成器接入」（同一事务内，顺序在 INSERT 之后）", async () => {
    await createExportTask({ exportType: "resourceCost", format: "XLSX", adminId: 9 });

    const calls = execCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0].sql).toContain("INSERT INTO t_platform_export_task ");
    expect(calls[1].sql).toContain("INSERT INTO t_platform_export_task_log");
    expect(calls[1].sql).toContain("'INFO'");
    expect(calls[1].params).toEqual([11, CREATED_LOG_MESSAGE]);
    expect(CREATED_LOG_MESSAGE).toBe("任务已创建，等待生成器接入");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("period 未传 / 空串 ⇒ 写 NULL（不落空串）；adminId 缺省 ⇒ NULL（不编造 ID）", async () => {
    await createExportTask({ exportType: "planDistribution", format: "CSV" });
    expect(execCalls()[0].params[2]).toBeNull();
    expect(execCalls()[0].params[6]).toBeNull();

    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ insertId: 12, affectedRows: 1 }, undefined]);
    await createExportTask({ exportType: "planDistribution", period: "   ", format: "CSV", adminId: 9 });
    expect(execCalls()[0].params[2]).toBeNull();
    expect(execCalls()[0].params[6]).toBe(9);
  });

  it("format 非法（excel/PDF/空） ⇒ 400 且零事务（不落库、不静默改成 CSV）", async () => {
    for (const bad of ["excel", "PDF", "", "csv"]) {
      await expect(
        createExportTask({ exportType: "tenantFinance", format: bad as any })
      ).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("exportType 为空/纯空白 ⇒ 400 且零事务", async () => {
    await expect(
      createExportTask({ exportType: "   ", format: "CSV" })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("C6-2-T2-F1 · GET /api/platform/reports/export/:id/status（状态＝T2 详情记录）", () => {
  beforeEach(() => vi.resetAllMocks());

  it("不存在 ⇒ 404（AppError，不是 TypeError/500），且零事务", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);

    await expect(getExportTaskDetail(999)).rejects.toBeInstanceOf(AppError);
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(getExportTaskDetail(999)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.queryOne.mock.calls[0][1]).toEqual([999]);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("存在 ⇒ 字段逐项映射：fileUrl/fileSize/startedAt/finishedAt 为 null 时原样透出（不折算成 ''/0）", async () => {
    mocks.queryOne.mockResolvedValueOnce(TASK_ROW);

    const detail = await getExportTaskDetail(7);

    expect(detail).toEqual({
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
    });
  });
});

describe("C6-2-T2-F1 · GET /api/platform/reports/export/:id/logs（日志升序）", () => {
  beforeEach(() => vi.resetAllMocks());

  it("任务不存在 ⇒ 404，且不查日志表（只发生 1 次任务存在性查询）", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);

    await expect(listExportTaskLogs(999)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.queryOne).toHaveBeenCalledTimes(1);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("无日志 ⇒ logs: []（诚实空态）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 7, taskNo: TASK_ROW.taskNo, status: "PENDING" });
    mocks.query.mockResolvedValueOnce([]);

    const result = await listExportTaskLogs(7);

    expect(result).toEqual({ logs: [] });
    expect(queryCalls()[0].params).toEqual([7]);
  });

  it("按 created_at 升序（acceptance ④c 的判红点）：SQL 必须是 ASC、不得出现 DESC，返回顺序不反转", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 7, taskNo: TASK_ROW.taskNo, status: "FAILED" });
    mocks.query.mockResolvedValueOnce([
      { level: "INFO", message: "任务已创建，等待生成器接入", createdAt: "2026-09-26 10:30:00" },
      { level: "ERROR", message: "生成器未接入", createdAt: "2026-09-26 10:31:00" },
      { level: "INFO", message: "任务已重排为 PENDING，等待生成器接入", createdAt: "2026-09-26 10:32:00" },
    ]);

    const { logs } = await listExportTaskLogs(7);

    const sql = queryCalls()[0].sql;
    expect(sql).toContain("ORDER BY created_at ASC");
    expect(sql.toUpperCase()).not.toContain("DESC");
    expect(logs.map((item) => item.createdAt)).toEqual([
      "2026-09-26 10:30:00",
      "2026-09-26 10:31:00",
      "2026-09-26 10:32:00",
    ]);
    expect(logs[0]).toEqual({
      level: "INFO",
      message: "任务已创建，等待生成器接入",
      createdAt: "2026-09-26 10:30:00",
    });
  });
});

describe("C6-2-T2-F1 · POST /api/platform/reports/export/:id/retry（状态机，acceptance ④a 的判红点）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ insertId: 0, affectedRows: 1 }, undefined]);
  });

  it("FAILED ⇒ PENDING：重置 progress、清空四列、写 INFO 日志，返回 PENDING", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 7, taskNo: TASK_ROW.taskNo, status: "FAILED" });

    const result = await retryExportTask(7);

    const calls = execCalls();
    expect(calls[0].sql).toContain("UPDATE t_platform_export_task");
    expect(calls[0].sql).toContain("progress = 0");
    expect(calls[0].sql).toContain("error_message = NULL");
    expect(calls[0].sql).toContain("file_url = NULL");
    expect(calls[0].sql).toContain("file_size = NULL");
    expect(calls[0].sql).toContain("started_at = NULL");
    expect(calls[0].sql).toContain("finished_at = NULL");
    // 纵深防御：WHERE 里再带一次 FAILED；状态用参数写，取值为 PENDING
    expect(calls[0].sql).toContain("WHERE id = ? AND status = ?");
    expect(calls[0].params).toEqual(["PENDING", 7, "FAILED"]);
    expect(calls[0].sql).not.toContain("SUCCESS");
    expect(calls[1].sql).toContain("INSERT INTO t_platform_export_task_log");
    expect(calls[1].sql).toContain("'INFO'");
    expect(calls[1].params).toEqual([7, RETRY_LOG_MESSAGE]);
    expect(result).toEqual({ id: 7, taskNo: TASK_ROW.taskNo, status: "PENDING" });
  });

  it("SUCCESS 状态 retry ⇒ 400 显式拒绝，且零事务、零日志（不改状态、不造成功）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 7, taskNo: TASK_ROW.taskNo, status: "SUCCESS" });

    await expect(retryExportTask(7)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.connExecute).not.toHaveBeenCalled();
  });

  it("PENDING / GENERATING ⇒ 400（含「重复 retry」：FAILED→PENDING 后再 retry 必被拒）", async () => {
    for (const status of ["PENDING", "GENERATING"]) {
      mocks.queryOne.mockResolvedValueOnce({ id: 7, taskNo: TASK_ROW.taskNo, status });
      await expect(retryExportTask(7)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("任务不存在 ⇒ 404，且零事务", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);

    await expect(retryExportTask(999)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("并发兜底：UPDATE affectedRows = 0 ⇒ 400 且不写日志（不静默成功）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 7, taskNo: TASK_ROW.taskNo, status: "FAILED" });
    mocks.connExecute.mockResolvedValue([{ insertId: 0, affectedRows: 0 }, undefined]);

    await expect(retryExportTask(7)).rejects.toMatchObject({ statusCode: 400 });
    expect(execCalls()).toHaveLength(1);
  });
});
