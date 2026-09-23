/**
 * R101-C3-1 开放平台密钥服务单测（复用 t_library_api_key + 轮换 + 打码 + 明文不落日志/审计）
 *
 * 范式：`src/__tests__/services/platform/platform-template.service.test.ts`（mock `shared/db`）。
 * 说明：本文件按 SQL 文本来路由 mock，避免"用例只靠调用顺序"而在实现调整后静默失配。
 *
 * 沙箱 vitest 无法启动（spawn EPERM），用例只写好，首次真跑由凌舟在本机执行。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

const hoisted = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  captured: [] as unknown[][],
  insertPlatformAuditLog: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: hoisted.query,
  queryOne: hoisted.queryOne,
}));

vi.mock("../../../shared/logger", () => {
  const record =
    (level: string) =>
    (msg: unknown, ...args: unknown[]) => {
      hoisted.captured.push([level, msg, ...args]);
    };
  return {
    default: { info: record("info"), warn: record("warn"), error: record("error"), debug: record("debug") },
  };
});

vi.mock("../../../services/admin/platform-audit-log.service", () => ({
  insertPlatformAuditLog: hoisted.insertPlatformAuditLog,
}));

import {
  createApiKey,
  listApiKeys,
  updateApiKey,
  enableApiKey,
  revokeApiKey,
  rotateApiKey,
  completeRotation,
  getApiKeyStats,
  maskAppKey,
  ROTATE_WINDOW_DAYS,
} from "../../../services/platform/open-api-key.service";

const OPERATOR = { adminId: 1, adminName: "testadmin", ip: "10.0.0.1" };

/** 按 SQL 文本路由 query()（未命中即抛错，防止实现漂移后用例静默通过） */
function respondQuery(rules: Array<[RegExp, unknown]>): void {
  hoisted.query.mockImplementation(async (sql: unknown) => {
    for (const [pattern, result] of rules) {
      if (pattern.test(String(sql))) return result;
    }
    throw new Error(`未预期的 SQL（query）：${String(sql)}`);
  });
}

/** 按 SQL 文本路由 queryOne() */
function respondQueryOne(rules: Array<[RegExp, unknown]>): void {
  hoisted.queryOne.mockImplementation(async (sql: unknown) => {
    for (const [pattern, result] of rules) {
      if (pattern.test(String(sql))) return result;
    }
    throw new Error(`未预期的 SQL（queryOne）：${String(sql)}`);
  });
}

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
    remark: null,
    rotateExpireAt: null,
    createdAt: "2026-09-01 10:00:00",
    updatedAt: "2026-09-01 10:00:00",
    ...overrides,
  };
}

function leaksOf(secret: string, calls: unknown[][]): unknown[][] {
  return calls.filter((call) => call.some((arg) => JSON.stringify(arg ?? null)?.includes(secret)));
}

function auditCalls(): unknown[][] {
  return hoisted.insertPlatformAuditLog.mock.calls as unknown[][];
}

describe("open-api-key.service · maskAppKey（服务端打码，唯一出口）", () => {
  it("长密钥：保留 4 位前缀 + 4 位后缀，中段固定 ****，绝不原样返回", () => {
    const masked = maskAppKey("zk_live_aaaabbbbccccdddd");
    expect(masked).toBe("zk_l****dddd");
    expect(masked).not.toBe("zk_live_aaaabbbbccccdddd");
  });

  it("短值/空值：全掩码（不泄露长度语义之外的任何字符）", () => {
    expect(maskAppKey("abcd")).toBe("****");
    expect(maskAppKey("")).toBe("****");
    expect(maskAppKey("12345678")).toBe("********");
  });
});

describe("open-api-key.service · listApiKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.captured.length = 0;
    hoisted.insertPlatformAuditLog.mockResolvedValue(1);
  });

  it("空态：records []、total 0（读路径零写操作）", async () => {
    respondQueryOne([[/COUNT\(\*\) AS total/, { total: 0 }]]);
    respondQuery([[/FROM t_library_api_key/, []]]);

    const result = await listApiKeys({ page: 1, pageSize: 20 });

    expect(result).toEqual({ records: [], total: 0, page: 1, pageSize: 20 });
    expect(hoisted.insertPlatformAuditLog).not.toHaveBeenCalled();
  });

  it("映射：apiKey 打码、scopes/allowedIps 解析为数组、rotateStatus 三态派生", async () => {
    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    respondQueryOne([[/COUNT\(\*\) AS total/, { total: 2 }]]);
    respondQuery([
      [
        /FROM t_library_api_key/,
        [
          keyRow(),
          keyRow({ id: 6, status: 0, rotateExpireAt: future, scopes: null, allowedIps: null }),
        ],
      ],
    ]);

    const result = await listApiKeys({ page: 1, pageSize: 20 });

    expect(result.records[0].apiKey).toBe("zk_l****dddd");
    expect(result.records[0].scopes).toEqual(["library:r"]);
    expect(result.records[0].allowedIps).toEqual(["1.2.3.4"]);
    expect(result.records[0].rotateStatus).toBe("ACTIVE");
    expect(result.records[1].rotateStatus).toBe("ROTATING"); // 轮换中优先于 status=0
    expect(result.records[1].scopes).toEqual([]);
    expect(result.records[1].allowedIps).toEqual([]);
    // 返回项不含任何密钥本体字段
    expect(Object.keys(result.records[0])).not.toContain("apiSecret");
    expect(Object.keys(result.records[0])).not.toContain("prevApiSecret");
  });

  it("筛选条件：tenantId/status/keyword 进 SQL，分页参数落在 LIMIT/OFFSET", async () => {
    respondQueryOne([[/COUNT\(\*\) AS total/, { total: 0 }]]);
    respondQuery([[/FROM t_library_api_key/, []]]);

    await listApiKeys({ page: 3, pageSize: 10, tenantId: "t1", status: 1, keyword: "erp" });

    const [countSql, countParams] = hoisted.queryOne.mock.calls[0];
    expect(String(countSql)).toContain("tenant_id = ?");
    expect(String(countSql)).toContain("status = ?");
    expect(String(countSql)).toContain("app_name LIKE ?");
    expect(countParams).toEqual(["t1", 1, "%erp%", "%erp%"]);

    const [, listParams] = hoisted.query.mock.calls[0];
    expect(listParams).toEqual(["t1", 1, "%erp%", "%erp%", 10, 20]);
  });
});

describe("open-api-key.service · createApiKey（明文一次性 + 不落日志/审计）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.captured.length = 0;
    hoisted.insertPlatformAuditLog.mockResolvedValue(1);
    respondQuery([[/INSERT INTO t_library_api_key/, { insertId: 21, affectedRows: 1 }]]);
  });

  it("入库 bcrypt 哈希；明文只在返回值；返回值同时含完整 AppKey（签发结果一次性展示）", async () => {
    const result = await createApiKey({ appName: "某某ERP对接", tenantId: "t1", qps: 30, scopes: ["order:rw"] }, OPERATOR);

    expect(result.apiKey).toMatch(/^zk_live_[0-9a-f]{32}$/);
    expect(result.apiSecret).toMatch(/^[0-9a-f]{48}$/);

    const [, params] = hoisted.query.mock.calls[0];
    const storedHash = String(params[3]);
    expect(storedHash).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare(result.apiSecret, storedHash)).toBe(true); // 明文与哈希可对上
    expect(storedHash).not.toContain(result.apiSecret);
    expect(params[7]).toBe(JSON.stringify(["order:rw"]));
  });

  it("默认值：tenantId=default、dailyLimit=10000、qps=10、scopes 空（不落空串）", async () => {
    await createApiKey({ appName: "无参应用" }, OPERATOR);

    const [, params] = hoisted.query.mock.calls[0];
    expect(params[1]).toBe("default");
    expect(params[5]).toBe(10000);
    expect(params[6]).toBe(10);
    expect(params[7]).toBeNull();
  });

  it("明文 AppSecret / 完整 AppKey 都不出现在日志与审计中；审计只记打码值", async () => {
    const result = await createApiKey({ appName: "探针应用" }, OPERATOR);

    expect(leaksOf(result.apiSecret, hoisted.captured)).toEqual([]);
    expect(leaksOf(result.apiSecret, auditCalls())).toEqual([]);
    expect(leaksOf(result.apiKey, auditCalls())).toEqual([]);
    expect(auditCalls()[0][0]).toMatchObject({
      module: "open_platform",
      action: "API_KEY_CREATE",
      adminName: "testadmin",
      targetId: 21,
      detail: { tenantId: "default", appName: "探针应用", appKeyMasked: maskAppKey(result.apiKey), qps: 10 },
    });
  });

  it("探针反测：若明文真被写进日志，探针必须命中（证明该门禁能红）", () => {
    const secret = "cafebabe".repeat(6);
    expect(leaksOf(secret, [["warn", `appSecret=${secret}`]])).toHaveLength(1);
    expect(leaksOf(secret, [["warn", "appSecret=****"]])).toHaveLength(0);
  });

  it("审计写入失败不影响签发：返回照常，且 warn 日志不含明文", async () => {
    hoisted.insertPlatformAuditLog.mockRejectedValueOnce(new Error("INSERT INTO t_platform_audit_log failed"));

    const result = await createApiKey({ appName: "审计失败应用" }, OPERATOR);

    expect(result.apiSecret).toMatch(/^[0-9a-f]{48}$/);
    expect(hoisted.captured).toHaveLength(1);
    expect(String(hoisted.captured[0][0])).toBe("warn");
    expect(leaksOf(result.apiSecret, hoisted.captured)).toEqual([]);
  });
});

describe("open-api-key.service · update / enable / revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.captured.length = 0;
    hoisted.insertPlatformAuditLog.mockResolvedValue(1);
    respondQueryOne([[/FROM t_library_api_key WHERE id = \?/, keyRow()]]);
  });

  it("updateApiKey：只更新传入字段，返回 changedFields", async () => {
    respondQuery([[/UPDATE t_library_api_key/, { affectedRows: 1 }]]);

    const result = await updateApiKey(5, { dailyLimit: 500, allowedIps: ["1.1.1.1"], scopes: [] }, OPERATOR);

    expect(result).toEqual({ id: 5, updated: true, changedFields: ["dailyLimit", "allowedIps", "scopes"] });
    const [sql, params] = hoisted.query.mock.calls[0];
    expect(String(sql)).toContain("daily_limit = ?");
    expect(String(sql)).toContain("allowed_ips = ?");
    expect(String(sql)).toContain("scopes = ?");
    expect(params).toEqual([500, JSON.stringify(["1.1.1.1"]), null, 5]); // scopes=[] → NULL（空=最小权限）
  });

  it("updateApiKey：空 patch ⇒ 400 且不写库", async () => {
    await expect(updateApiKey(5, {}, OPERATOR)).rejects.toMatchObject({ statusCode: 400 });
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("updateApiKey：不存在 ⇒ 404", async () => {
    respondQueryOne([[/FROM t_library_api_key WHERE id = \?/, null]]);
    await expect(updateApiKey(9, { qps: 30 }, OPERATOR)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("enableApiKey：status=1", async () => {
    respondQuery([[/UPDATE t_library_api_key/, { affectedRows: 1 }]]);
    await expect(enableApiKey(5, OPERATOR)).resolves.toEqual({ id: 5, status: 1, enabled: true });
    expect(String(hoisted.query.mock.calls[0][0])).toContain("SET status = 1");
  });

  it("revokeApiKey：DELETE 并留审计（审计只记打码值）", async () => {
    respondQuery([[/DELETE FROM t_library_api_key/, { affectedRows: 1 }]]);

    await expect(revokeApiKey(5, OPERATOR)).resolves.toEqual({ id: 5, deleted: true });
    expect(String(hoisted.query.mock.calls[0][0])).toContain("DELETE FROM t_library_api_key");
    expect(auditCalls()[0][0]).toMatchObject({
      action: "API_KEY_REVOKE",
      detail: { appKeyMasked: "zk_l****dddd", tenantId: "t1" },
    });
    expect(leaksOf("zk_live_aaaabbbbccccdddd", auditCalls())).toEqual([]);
  });

  it("revokeApiKey：不存在 ⇒ 404 且不删", async () => {
    respondQueryOne([[/FROM t_library_api_key WHERE id = \?/, null]]);
    await expect(revokeApiKey(9, OPERATOR)).rejects.toMatchObject({ statusCode: 404 });
    expect(hoisted.query).not.toHaveBeenCalled();
  });
});

describe("open-api-key.service · rotateApiKey / completeRotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.captured.length = 0;
    hoisted.insertPlatformAuditLog.mockResolvedValue(1);
  });

  it("轮换：旧密钥转存 prev_*、窗口 = 7 天（显式常量）、返回新明文一次", async () => {
    const rotated = keyRow({ rotateExpireAt: "2026-09-30 10:00:00" });
    // 第一次 queryOne = 旧行；UPDATE 后第二次 queryOne = 轮换后的行（rotate 不查 COUNT，故只按顺序给值）
    hoisted.queryOne.mockResolvedValueOnce(keyRow()).mockResolvedValueOnce(rotated);
    respondQuery([[/UPDATE t_library_api_key/, { affectedRows: 1 }]]);

    const result = await rotateApiKey(5, OPERATOR);

    expect(ROTATE_WINDOW_DAYS).toBe(7);
    expect(result.apiKey).toMatch(/^zk_live_[0-9a-f]{32}$/);
    expect(result.apiKey).not.toBe("zk_live_aaaabbbbccccdddd");
    expect(result.apiSecret).toMatch(/^[0-9a-f]{48}$/);
    expect(result.rotateStatus).toBe("ROTATING");
    expect(result.previousAppKeyMasked).toBe("zk_l****dddd");
    expect(result.rotateExpireAt).toBe("2026-09-30 10:00:00");

    const [sql, params] = hoisted.query.mock.calls[0];
    expect(String(sql)).toContain("prev_api_key = api_key");
    expect(String(sql)).toContain("prev_api_secret = api_secret");
    expect(String(sql)).toContain("INTERVAL 7 DAY");
    expect(params[0]).toBe(result.apiKey);
    expect(await bcrypt.compare(result.apiSecret, String(params[1]))).toBe(true);
    expect(leaksOf(result.apiSecret, hoisted.captured)).toEqual([]);
    expect(leaksOf(result.apiSecret, auditCalls())).toEqual([]);
  });

  it("轮换中再次轮换 ⇒ 409 且不写库（不产生第三份密钥）", async () => {
    respondQueryOne([[/(FROM t_library_api_key WHERE id = \?)/, keyRow({ rotateExpireAt: new Date(Date.now() + 60000).toISOString() })]]);

    await expect(rotateApiKey(5, OPERATOR)).rejects.toMatchObject({ statusCode: 409 });
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("并发兜底：条件 UPDATE affectedRows=0 ⇒ 409", async () => {
    hoisted.queryOne.mockResolvedValueOnce(keyRow());
    respondQuery([[/UPDATE t_library_api_key/, { affectedRows: 0 }]]);

    await expect(rotateApiKey(5, OPERATOR)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("轮换不存在 ⇒ 404", async () => {
    hoisted.queryOne.mockResolvedValueOnce(null);
    await expect(rotateApiKey(9, OPERATOR)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("completeRotation：清空 prev_* 与 rotate_expire_at（旧密钥立即失效）", async () => {
    hoisted.queryOne.mockResolvedValueOnce(keyRow({ rotateExpireAt: "2026-09-30 10:00:00" }));
    respondQuery([[/UPDATE t_library_api_key/, { affectedRows: 1 }]]);

    await expect(completeRotation(5, OPERATOR)).resolves.toEqual({
      id: 5,
      rotateStatus: "ACTIVE",
      previousKeyInvalidated: true,
    });
    const sql = String(hoisted.query.mock.calls[0][0]);
    expect(sql).toContain("prev_api_key = NULL");
    expect(sql).toContain("prev_api_secret = NULL");
    expect(sql).toContain("rotate_expire_at = NULL");
  });

  it("completeRotation：不在轮换中 ⇒ 400 且不写库", async () => {
    hoisted.queryOne.mockResolvedValueOnce(keyRow({ rotateExpireAt: null }));
    await expect(completeRotation(5, OPERATOR)).rejects.toMatchObject({ statusCode: 400 });
    expect(hoisted.query).not.toHaveBeenCalled();
  });
});

describe("open-api-key.service · getApiKeyStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.captured.length = 0;
    hoisted.insertPlatformAuditLog.mockResolvedValue(1);
  });

  it("近 7 日序列 + 合计 + 错误率（无调用时为 null，不造 0）", async () => {
    hoisted.queryOne.mockResolvedValueOnce(keyRow());
    respondQuery([
      [
        /FROM t_open_api_call_daily/,
        [
          { statDate: "2026-09-22", callCount: 10, errorCount: 1 },
          { statDate: "2026-09-23", callCount: 30, errorCount: 2 },
        ],
      ],
    ]);

    const result = await getApiKeyStats(5, 7);

    expect(result.series).toEqual([
      { date: "2026-09-22", callCount: 10, errorCount: 1, errorRate: 0.1 },
      { date: "2026-09-23", callCount: 30, errorCount: 2, errorRate: 0.0667 },
    ]);
    expect(result.total).toEqual({ callCount: 40, errorCount: 3, errorRate: 0.075 });
    expect(result.hasData).toBe(true);
    expect(result.apiKey).toBe("zk_l****dddd"); // 统计出口同样打码
    expect(result.range).toEqual({ days: 7 });
    const [, params] = hoisted.query.mock.calls[0];
    expect(params).toEqual([5, 6]);
  });

  it("空态：series []、hasData false、errorRate null", async () => {
    hoisted.queryOne.mockResolvedValueOnce(keyRow());
    respondQuery([[/FROM t_open_api_call_daily/, []]]);

    const result = await getApiKeyStats(5, 30);

    expect(result.series).toEqual([]);
    expect(result.hasData).toBe(false);
    expect(result.total).toEqual({ callCount: 0, errorCount: 0, errorRate: null });
  });

  it("密钥不存在 ⇒ 404（不查统计表）", async () => {
    hoisted.queryOne.mockResolvedValueOnce(null);
    await expect(getApiKeyStats(9, 7)).rejects.toMatchObject({ statusCode: 404 });
    expect(hoisted.query).not.toHaveBeenCalled();
  });
});
