/**
 * R101-C3-1 开放平台 Webhook 服务单测
 * 覆盖：SSRF 回调地址校验 / 订阅创建（bcrypt 存签名密钥、明文一次性）/ 测试推送与手动重推的
 *       投递落库 / 非 2xx 与超时判定 / 连续失败自动暂停 / 日志不含明文。
 *
 * 范式：`src/__tests__/services/platform/platform-template.service.test.ts`（mock `shared/db`）+ stub global fetch。
 * 沙箱 vitest 无法启动（spawn EPERM），用例只写好，首次真跑由凌舟在本机执行。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";

const hoisted = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  captured: [] as unknown[][],
  insertPlatformAuditLog: vi.fn(),
  fetch: vi.fn(),
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
  assertSafeCallbackUrl,
  createWebhook,
  listWebhooks,
  listDeliveries,
  listFailures,
  redeliver,
  resumeWebhook,
  testWebhook,
  DELIVER_TIMEOUT_MS,
} from "../../../services/platform/open-webhook.service";

const OPERATOR = { adminId: 1, adminName: "testadmin", ip: "10.0.0.1" };

function respondQuery(rules: Array<[RegExp, unknown]>): void {
  hoisted.query.mockImplementation(async (sql: unknown, params: unknown) => {
    for (const [pattern, result] of rules) {
      if (pattern.test(String(sql))) {
        return typeof result === "function" ? (result as (...args: unknown[]) => unknown)(params) : result;
      }
    }
    throw new Error(`未预期的 SQL（query）：${String(sql)}`);
  });
}

function webhookRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    tenantId: "t1",
    eventType: "order.created",
    callbackUrl: "https://erp.example.com/hook",
    signSecret: "$2b$10$storedhashstoredhashstoredha",
    retryPolicy: "1m/5m/30m x3",
    pauseThreshold: 10,
    paused: 0,
    lastTriggerAt: null,
    lastStatus: null,
    lastError: null,
    createdAt: "2026-09-20 10:00:00",
    updatedAt: "2026-09-20 10:00:00",
    ...overrides,
  };
}

function deliveryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    subscriptionId: 3,
    tenantId: "t1",
    eventType: "order.created",
    payload: JSON.stringify({ event: "order.created", test: true }),
    attempt: 1,
    status: "OK",
    httpStatus: 200,
    error: null,
    triggeredBy: "TEST",
    durationMs: 12,
    createdAt: "2026-09-23 10:05:00",
    ...overrides,
  };
}

function leaksOf(secret: string, calls: unknown[][]): unknown[][] {
  return calls.filter((call) => call.some((arg) => JSON.stringify(arg ?? null)?.includes(secret)));
}

function auditCalls(): unknown[][] {
  return hoisted.insertPlatformAuditLog.mock.calls as unknown[][];
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.captured.length = 0;
  hoisted.insertPlatformAuditLog.mockResolvedValue(1);
  vi.stubGlobal("fetch", hoisted.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("open-webhook.service · assertSafeCallbackUrl（SSRF 防护）", () => {
  it("合法 https 公网地址：通过并返回 URL", () => {
    expect(assertSafeCallbackUrl("https://erp.example.com/hook").hostname).toBe("erp.example.com");
    expect(assertSafeCallbackUrl("  https://erp.example.com:8443/hook  ").port).toBe("8443");
  });

  const blocked: string[] = [
    "http://erp.example.com/hook",
    "ftp://erp.example.com/hook",
    "not-a-url",
    "https://localhost/hook",
    "https://erp.local/hook",
    "https://erp.internal/hook",
    "https://127.0.0.1/hook",
    "https://10.1.2.3/hook",
    "https://172.16.5.5/hook",
    "https://192.168.1.10/hook",
    "https://169.254.169.254/latest/meta-data/",
    "https://224.0.0.1/hook",
    "https://[::1]/hook",
  ];

  for (const url of blocked) {
    it(`${url} ⇒ 400（拒绝并给出中文原因）`, () => {
      let thrown: any = null;
      try {
        assertSafeCallbackUrl(url);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).not.toBeNull();
      expect(thrown.statusCode).toBe(400);
    });
  }
});

describe("open-webhook.service · createWebhook", () => {
  it("事件码不在目录内 ⇒ 400 且不写库", async () => {
    await expect(createWebhook({ eventType: "made.up", callbackUrl: "https://erp.example.com/hook" }, OPERATOR))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("回调地址为内网 ⇒ 400 且不写库", async () => {
    await expect(
      createWebhook({ eventType: "order.created", callbackUrl: "https://127.0.0.1/hook" }, OPERATOR)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("201：签名密钥 bcrypt 存库、明文只在返回值、审计不含明文", async () => {
    respondQuery([[/INSERT INTO t_open_webhook/, { insertId: 31, affectedRows: 1 }]]);

    const result = await createWebhook(
      { eventType: "order.approved", callbackUrl: "https://erp.example.com/hook", tenantId: "t1" },
      OPERATOR
    );

    expect(result.id).toBe(31);
    expect(result.signSecret).toMatch(/^[0-9a-f]{48}$/);
    const [, params] = hoisted.query.mock.calls[0];
    expect(String(params[3])).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare(result.signSecret, String(params[3]))).toBe(true);
    expect(leaksOf(result.signSecret, hoisted.captured)).toEqual([]);
    expect(leaksOf(result.signSecret, auditCalls())).toEqual([]);
    expect(auditCalls()[0][0]).toMatchObject({
      module: "open_platform",
      action: "WEBHOOK_CREATE",
      targetId: 31,
      detail: { eventType: "order.approved", signSecretIssued: true },
    });
  });
});

describe("open-webhook.service · testWebhook（投递落库 + 结果判定）", () => {
  it("对端 200 ⇒ OK，投递记录 triggered_by=TEST、attempt=1，订阅最近状态回写", async () => {
    hoisted.fetch.mockResolvedValue({ status: 200 });
    hoisted.queryOne
      .mockResolvedValueOnce(webhookRow())
      .mockResolvedValueOnce({ total: 1, failCount: 0 })
      .mockResolvedValueOnce(deliveryRow({ status: "OK", httpStatus: 200 }));
    respondQuery([[/INSERT INTO t_open_webhook_delivery/, { insertId: 11, affectedRows: 1 }], [/UPDATE t_open_webhook/, { affectedRows: 1 }]]);

    const result = await testWebhook(3, OPERATOR);

    expect(hoisted.fetch).toHaveBeenCalledWith(
      "https://erp.example.com/hook",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.delivery.status).toBe("OK");
    expect(result.delivery.httpStatus).toBe(200);
    expect(result.eventType).toBe("order.created");

    const insertCall = hoisted.query.mock.calls.find((call) => String(call[0]).includes("INSERT INTO t_open_webhook_delivery"));
    expect(insertCall).toBeTruthy();
    const insertParams = insertCall?.[1] as unknown[];
    expect(insertParams[0]).toBe(3);
    expect(insertParams[1]).toBe("t1");
    expect(insertParams[2]).toBe("order.created");
    expect(JSON.parse(String(insertParams[3]))).toMatchObject({ event: "order.created", test: true });
    expect(insertParams[4]).toBe(1); // attempt
    expect(insertParams[5]).toBe("OK");
    expect(insertParams[6]).toBe(200);
    expect(insertParams[7]).toBeNull();
    expect(insertParams[8]).toBe("TEST");
    expect(typeof insertParams[9]).toBe("number"); // duration_ms

    const updateCall = hoisted.query.mock.calls.find((call) => String(call[0]).includes("SET last_trigger_at"));
    expect((updateCall?.[1] as unknown[])[0]).toBe("OK");
    expect((updateCall?.[1] as unknown[])[1]).toBeNull();
    expect((updateCall?.[1] as unknown[])[2]).toBe(3);
  });

  it("对端 500 ⇒ FAIL + 非 2xx 原因", async () => {
    hoisted.fetch.mockResolvedValue({ status: 500 });
    hoisted.queryOne
      .mockResolvedValueOnce(webhookRow())
      .mockResolvedValueOnce({ total: 1, failCount: 1 })
      .mockResolvedValueOnce(deliveryRow({ status: "FAIL", httpStatus: 500, error: "对端返回非 2xx：500" }));
    respondQuery([[/INSERT INTO t_open_webhook_delivery/, { insertId: 12, affectedRows: 1 }], [/UPDATE t_open_webhook/, { affectedRows: 1 }]]);

    const result = await testWebhook(3, OPERATOR);

    expect(result.delivery.status).toBe("FAIL");
    expect(result.delivery.error).toBe("对端返回非 2xx：500");
    const insertCall = hoisted.query.mock.calls.find((call) => String(call[0]).includes("INSERT INTO t_open_webhook_delivery"));
    expect((insertCall?.[1] as unknown[])[5]).toBe("FAIL");
  });

  it("连接失败（fetch 抛错）⇒ FAIL + 原始原因（截断入库）", async () => {
    hoisted.fetch.mockRejectedValue(new Error("connect ETIMEDOUT 1.2.3.4:443"));
    hoisted.queryOne
      .mockResolvedValueOnce(webhookRow())
      .mockResolvedValueOnce({ total: 1, failCount: 1 })
      .mockResolvedValueOnce(deliveryRow({ status: "FAIL", httpStatus: null, error: "connect ETIMEDOUT 1.2.3.4:443" }));
    respondQuery([[/INSERT INTO t_open_webhook_delivery/, { insertId: 13, affectedRows: 1 }], [/UPDATE t_open_webhook/, { affectedRows: 1 }]]);

    const result = await testWebhook(3, OPERATOR);
    expect(result.delivery.status).toBe("FAIL");
    expect(result.delivery.error).toContain("ETIMEDOUT");
  });

  it("超时（AbortError）⇒ FAIL + 明确超时文案（含阈值毫秒）", async () => {
    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";
    hoisted.fetch.mockRejectedValue(abort);
    hoisted.queryOne
      .mockResolvedValueOnce(webhookRow())
      .mockResolvedValueOnce({ total: 1, failCount: 1 })
      .mockResolvedValueOnce(deliveryRow({ status: "FAIL", httpStatus: null, error: `请求超时（> ${DELIVER_TIMEOUT_MS}ms）` }));
    respondQuery([[/INSERT INTO t_open_webhook_delivery/, { insertId: 14, affectedRows: 1 }], [/UPDATE t_open_webhook/, { affectedRows: 1 }]]);

    const result = await testWebhook(3, OPERATOR);
    expect(result.delivery.error).toBe(`请求超时（> ${DELIVER_TIMEOUT_MS}ms）`);
  });

  it("连续失败达阈值 ⇒ 自动暂停（UPDATE paused=1 + warn，日志不含密钥）", async () => {
    hoisted.fetch.mockResolvedValue({ status: 503 });
    hoisted.queryOne
      .mockResolvedValueOnce(webhookRow({ pauseThreshold: 10 }))
      .mockResolvedValueOnce({ total: 10, failCount: 10 })
      .mockResolvedValueOnce(deliveryRow({ status: "FAIL", httpStatus: 503, error: "对端返回非 2xx：503" }));
    respondQuery([[/INSERT INTO t_open_webhook_delivery/, { insertId: 15, affectedRows: 1 }], [/UPDATE t_open_webhook/, { affectedRows: 1 }]]);

    await testWebhook(3, OPERATOR);

    const pauseCall = hoisted.query.mock.calls.find((call) => String(call[0]).includes("SET paused = 1"));
    expect(pauseCall).toBeTruthy();
    expect((pauseCall?.[1] as unknown[])[0]).toBe(3);
    const warned = hoisted.captured.filter((call) => String(call[1] ?? "").includes("自动暂停"));
    expect(warned).toHaveLength(1);
    expect(leaksOf("$2b$10$storedhashstoredhashstoredha", hoisted.captured)).toEqual([]);
  });

  it("未达阈值 ⇒ 不暂停", async () => {
    hoisted.fetch.mockResolvedValue({ status: 500 });
    hoisted.queryOne
      .mockResolvedValueOnce(webhookRow())
      .mockResolvedValueOnce({ total: 3, failCount: 3 })
      .mockResolvedValueOnce(deliveryRow({ status: "FAIL", httpStatus: 500 }));
    respondQuery([[/INSERT INTO t_open_webhook_delivery/, { insertId: 16, affectedRows: 1 }], [/UPDATE t_open_webhook/, { affectedRows: 1 }]]);

    await testWebhook(3, OPERATOR);
    expect(hoisted.query.mock.calls.some((call) => String(call[0]).includes("SET paused = 1"))).toBe(false);
  });

  it("订阅不存在 ⇒ 404 且不出站请求", async () => {
    hoisted.queryOne.mockResolvedValueOnce(null);
    await expect(testWebhook(88, OPERATOR)).rejects.toMatchObject({ statusCode: 404 });
    expect(hoisted.fetch).not.toHaveBeenCalled();
  });

  it("历史数据里的非法回调地址 ⇒ 400 且不出站请求（出站前二次校验）", async () => {
    hoisted.queryOne.mockResolvedValueOnce(webhookRow({ callbackUrl: "http://127.0.0.1/hook" }));
    await expect(testWebhook(3, OPERATOR)).rejects.toMatchObject({ statusCode: 400 });
    expect(hoisted.fetch).not.toHaveBeenCalled();
  });
});

describe("open-webhook.service · redeliver", () => {
  it("默认重推最近一条：attempt = 源 attempt + 1，triggered_by=MANUAL", async () => {
    hoisted.fetch.mockResolvedValue({ status: 200 });
    hoisted.queryOne
      .mockResolvedValueOnce(webhookRow())
      .mockResolvedValueOnce(deliveryRow({ id: 20, attempt: 1, status: "FAIL", payload: JSON.stringify({ event: "order.created", seq: 7 }) }))
      .mockResolvedValueOnce({ total: 2, failCount: 0 })
      .mockResolvedValueOnce(deliveryRow({ id: 21, attempt: 2, triggeredBy: "MANUAL" }));
    respondQuery([[/INSERT INTO t_open_webhook_delivery/, { insertId: 21, affectedRows: 1 }], [/UPDATE t_open_webhook/, { affectedRows: 1 }]]);

    const result = await redeliver(3, undefined, OPERATOR);

    expect(result.redeliverOf).toBe(20);
    expect(result.attempt).toBe(2);
    const insertParams = hoisted.query.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO t_open_webhook_delivery")
    )?.[1] as unknown[];
    expect(JSON.parse(String(insertParams[3]))).toEqual({ event: "order.created", seq: 7 }); // 报文原样重推
    expect(insertParams[4]).toBe(2);
    expect(insertParams[8]).toBe("MANUAL");
    expect(auditCalls()[0][0]).toMatchObject({ action: "WEBHOOK_REDELIVER", detail: { redeliverOf: 20, attempt: 2 } });
  });

  it("指定 deliveryId：按 (id, subscription_id) 定位源投递", async () => {
    hoisted.fetch.mockResolvedValue({ status: 200 });
    hoisted.queryOne
      .mockResolvedValueOnce(webhookRow())
      .mockResolvedValueOnce(deliveryRow({ id: 9, attempt: 3 }))
      .mockResolvedValueOnce({ total: 1, failCount: 0 })
      .mockResolvedValueOnce(deliveryRow({ id: 22, attempt: 4 }));
    respondQuery([[/INSERT INTO t_open_webhook_delivery/, { insertId: 22, affectedRows: 1 }], [/UPDATE t_open_webhook/, { affectedRows: 1 }]]);

    const result = await redeliver(3, 9, OPERATOR);
    expect(result.redeliverOf).toBe(9);
    expect(result.attempt).toBe(4);
    const sourceSql = String(hoisted.queryOne.mock.calls[1][0]);
    expect(sourceSql).toContain("WHERE id = ? AND subscription_id = ?");
    expect(hoisted.queryOne.mock.calls[1][1]).toEqual([9, 3]);
  });

  it("无投递记录 ⇒ 404（不发无意义请求）", async () => {
    hoisted.queryOne.mockResolvedValueOnce(webhookRow()).mockResolvedValueOnce(null);
    await expect(redeliver(3, undefined, OPERATOR)).rejects.toMatchObject({ statusCode: 404 });
    expect(hoisted.fetch).not.toHaveBeenCalled();
  });

  it("指定的投递记录不属于该订阅 ⇒ 404", async () => {
    hoisted.queryOne.mockResolvedValueOnce(webhookRow()).mockResolvedValueOnce(null);
    await expect(redeliver(3, 77, OPERATOR)).rejects.toMatchObject({ statusCode: 404 });
    expect(hoisted.fetch).not.toHaveBeenCalled();
  });
});

describe("open-webhook.service · listWebhooks / listDeliveries / listFailures / resumeWebhook", () => {
  it("listWebhooks：成功率派生（无推送 ⇒ null，不造 0%）", async () => {
    respondQuery([
      [
        /FROM t_open_webhook w/,
        [
          webhookRow({ recentPushCount: 20, recentOkCount: 19 }),
          webhookRow({ id: 4, recentPushCount: 0, recentOkCount: 0, paused: 1 }),
        ],
      ],
    ]);

    const result = await listWebhooks();

    expect(result.total).toBe(2);
    expect(result.records[0].recentSuccessRate).toBe(95);
    expect(result.records[0].paused).toBe(false);
    expect(result.records[1].recentSuccessRate).toBeNull();
    expect(result.records[1].paused).toBe(true);
  });

  it("listWebhooks：tenantId/paused 进 SQL 条件", async () => {
    respondQuery([[/FROM t_open_webhook w/, []]]);
    await listWebhooks({ tenantId: "t1", paused: 1 });
    const [sql, params] = hoisted.query.mock.calls[0];
    expect(String(sql)).toContain("w.tenant_id = ?");
    expect(String(sql)).toContain("w.paused = ?");
    expect(params).toEqual(["t1", 1]);
  });

  it("listDeliveries：分页 + payload 反序列化为对象", async () => {
    hoisted.queryOne.mockResolvedValueOnce(webhookRow()).mockResolvedValueOnce({ total: 1 });
    respondQuery([[/FROM t_open_webhook_delivery\s+WHERE subscription_id = \?/, [deliveryRow()]]]);

    const result = await listDeliveries(3, { page: 2, pageSize: 10 });

    expect(result.total).toBe(1);
    expect(result.records[0].payload).toEqual({ event: "order.created", test: true });
    expect(hoisted.query.mock.calls[0][1]).toEqual([3, 10, 10]);
  });

  it("listFailures：只取 FAIL 且 total 来自 COUNT", async () => {
    hoisted.queryOne.mockResolvedValueOnce(webhookRow()).mockResolvedValueOnce({ total: 5 });
    respondQuery([[/status = 'FAIL'/, [deliveryRow({ status: "FAIL", error: "对端返回非 2xx：500" })]]]);

    const result = await listFailures(3, 5);

    expect(result.total).toBe(5);
    expect(result.records[0].error).toContain("500");
    expect(hoisted.query.mock.calls[0][1]).toEqual([3, 5]);
  });

  it("listFailures：订阅不存在 ⇒ 404", async () => {
    hoisted.queryOne.mockResolvedValueOnce(null);
    await expect(listFailures(88, 5)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("resumeWebhook：已暂停 ⇒ 置 paused=0 并留审计", async () => {
    hoisted.queryOne.mockResolvedValueOnce(webhookRow({ paused: 1 }));
    respondQuery([[/UPDATE t_open_webhook/, { affectedRows: 1 }]]);

    await expect(resumeWebhook(3, OPERATOR)).resolves.toEqual({ id: 3, paused: false, resumed: true });
    expect(String(hoisted.query.mock.calls[0][0])).toContain("SET paused = 0");
    expect(auditCalls()[0][0]).toMatchObject({ action: "WEBHOOK_RESUME" });
  });

  it("resumeWebhook：未暂停 ⇒ changed=false 且不写库", async () => {
    hoisted.queryOne.mockResolvedValueOnce(webhookRow({ paused: 0 }));
    await expect(resumeWebhook(3, OPERATOR)).resolves.toEqual({ id: 3, paused: false, resumed: false });
    expect(hoisted.query).not.toHaveBeenCalled();
  });
});
