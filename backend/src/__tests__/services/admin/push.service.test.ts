/**
 * 推送服务 service 单元测试
 * 被测文件：src/services/admin/push.service.ts
 *
 * 覆盖范围：
 *  - 常量 PUSH_PROVIDER_VALUES
 *  - registerToken：新增/upsert/参数校验（provider/userId/deviceId/pushToken/appPlatform）
 *  - unregisterToken：注销成功/不存在/参数校验
 *  - getUserTokens：查询/参数校验
 *  - sendToUser：单设备/多设备并发/无token/参数校验/推送失败错误隔离
 *  - sendToTenant：广播/无token
 *  - getProvider：正确实例/非法名称抛 400
 *  - JPush/FCM/HMS 三大厂商适配（mock fetch 验证 URL/headers/body）
 *  - 三大厂商密钥未配置时降级返回 errorMsg（不抛异常）
 *  - 租户隔离验证（queryWithTenant 调用时第三个参数为 tenantId）
 *
 * 关联任务：R51-07 后端推送通知服务
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ==================== Mock db ====================

const mocks = vi.hoisted(() => ({
    queryWithTenant: vi.fn(),
    queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
    queryWithTenant: mocks.queryWithTenant,
    queryOneWithTenant: mocks.queryOneWithTenant,
    query: vi.fn(),
    queryOne: vi.fn(),
    transaction: vi.fn(),
    pool: { query: vi.fn() },
}));

// ==================== 导入被测模块 ====================

import {
    registerToken,
    unregisterToken,
    getUserTokens,
    sendToUser,
    sendToTenant,
    getProvider,
    PUSH_PROVIDER_VALUES,
} from "../../../services/admin/push.service";

// ==================== 公共 setup/teardown ====================

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

beforeEach(() => {
    vi.clearAllMocks();
    // 重置环境变量
    process.env = { ...originalEnv };
    // 重置 fetch（每个用例内自行 vi.fn 覆盖）
    global.fetch = originalFetch;
});

afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
});

// ==================== 工具函数 ====================

/** 构造一个最小 fetch Response */
function makeFetchResponse(body: unknown, ok = true, status = 200) {
    return vi.fn().mockResolvedValue({
        ok,
        status,
        json: () => Promise.resolve(body),
    } as unknown as Response);
}

// ================================================================
// 常量校验
// ================================================================
describe("push.service - 常量 PUSH_PROVIDER_VALUES", () => {
    it("包含 jpush / fcm / hms 三个服务商", () => {
        expect(PUSH_PROVIDER_VALUES).toEqual(["jpush", "fcm", "hms"]);
    });
});

// ================================================================
// getProvider
// ================================================================
describe("push.service - getProvider", () => {
    it("返回 jpush 实例", () => {
        const p = getProvider("jpush");
        expect(p.name).toBe("jpush");
    });

    it("返回 fcm 实例", () => {
        const p = getProvider("fcm");
        expect(p.name).toBe("fcm");
    });

    it("返回 hms 实例", () => {
        const p = getProvider("hms");
        expect(p.name).toBe("hms");
    });

    it("非法服务商名称 → 抛 400", () => {
        // TS 不能传任意字符串，这里强转绕过类型检查
        expect(() => getProvider("unknown" as any)).toThrow();
        try {
            getProvider("unknown" as any);
        } catch (e: any) {
            expect(e.statusCode).toBe(400);
            expect(e.message).toContain("unknown");
        }
    });
});

// ================================================================
// registerToken
// ================================================================
describe("push.service - registerToken", () => {
    it("成功新增（默认 provider=jpush，无 existing）", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(null); // existing 不存在
        mocks.queryWithTenant.mockResolvedValue({ insertId: 101 });

        const res = await registerToken(
            {
                userId: 10,
                deviceId: "device-A",
                pushToken: "token-abc",
                appPlatform: "android",
            },
            "tenant-001"
        );

        expect(res).toEqual({ id: 101 });

        // 验证先查询 existing
        const selectCall = mocks.queryOneWithTenant.mock.calls[0];
        expect(selectCall[0]).toContain("SELECT id FROM t_push_token");
        expect(selectCall[0]).toContain("device_id = ?");
        expect(selectCall[0]).toContain("provider = ?");
        expect(selectCall[1]).toEqual(["device-A", "jpush"]);
        expect(selectCall[2]).toBe("tenant-001"); // 租户隔离

        // 验证 INSERT 调用
        const insertCall = mocks.queryWithTenant.mock.calls[0];
        expect(insertCall[0]).toContain("INSERT INTO t_push_token");
        expect(insertCall[1]).toEqual([
            10,
            "device-A",
            "token-abc",
            "jpush",
            "android",
            null, // appVersion
        ]);
        expect(insertCall[2]).toBe("tenant-001");
    });

    it("显式指定 provider=fcm + appVersion", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(null);
        mocks.queryWithTenant.mockResolvedValue({ insertId: 200 });

        const res = await registerToken(
            {
                userId: 20,
                deviceId: "device-B",
                pushToken: "fcm-token",
                provider: "fcm",
                appPlatform: "ios",
                appVersion: "1.2.3",
            },
            "t-fcm"
        );

        expect(res).toEqual({ id: 200 });
        expect(mocks.queryOneWithTenant.mock.calls[0][1]).toEqual([
            "device-B",
            "fcm",
        ]);
        expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual([
            20,
            "device-B",
            "fcm-token",
            "fcm",
            "ios",
            "1.2.3",
        ]);
    });

    it("upsert：existing 存在 → 走 UPDATE 分支，返回原 ID", async () => {
        mocks.queryOneWithTenant.mockResolvedValue({ id: 999 });

        const res = await registerToken(
            {
                userId: 30,
                deviceId: "device-C",
                pushToken: "new-token",
                provider: "hms",
                appPlatform: "harmony",
            },
            "t-upsert"
        );

        expect(res).toEqual({ id: 999 });
        // 仅调用了 1 次 queryWithTenant（UPDATE），不应再调 INSERT
        expect(mocks.queryWithTenant).toHaveBeenCalledTimes(1);
        const updateCall = mocks.queryWithTenant.mock.calls[0];
        expect(updateCall[0]).toContain("UPDATE t_push_token");
        expect(updateCall[0]).toContain("SET user_id = ?");
        expect(updateCall[0]).toContain("status = 1");
        expect(updateCall[0]).toContain("last_active_at = NOW()");
        expect(updateCall[1]).toEqual([
            30,
            "new-token",
            "harmony",
            null,
            999, // existing.id
        ]);
        expect(updateCall[2]).toBe("t-upsert");
    });

    it("insertId 为 undefined 时返回 0", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(null);
        mocks.queryWithTenant.mockResolvedValue({}); // 无 insertId

        const res = await registerToken(
            {
                userId: 1,
                deviceId: "d1",
                pushToken: "t1",
                appPlatform: "android",
            },
            "t1"
        );
        expect(res).toEqual({ id: 0 });
    });

    it("非法 provider → 抛 400", async () => {
        await expect(
            registerToken(
                {
                    userId: 1,
                    deviceId: "d1",
                    pushToken: "t1",
                    provider: "wrong" as any,
                    appPlatform: "android",
                },
                "t1"
            )
        ).rejects.toMatchObject({
            message: expect.stringContaining("非法的推送服务商"),
            statusCode: 400,
        });
        expect(mocks.queryOneWithTenant).not.toHaveBeenCalled();
        expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("userId 非正整数 → 抛 400", async () => {
        await expect(
            registerToken(
                {
                    userId: 0,
                    deviceId: "d1",
                    pushToken: "t1",
                    appPlatform: "android",
                },
                "t1"
            )
        ).rejects.toMatchObject({
            message: "用户ID必须为正整数",
            statusCode: 400,
        });
    });

    it("空 deviceId → 抛 400", async () => {
        await expect(
            registerToken(
                {
                    userId: 1,
                    deviceId: "  ",
                    pushToken: "t1",
                    appPlatform: "android",
                },
                "t1"
            )
        ).rejects.toMatchObject({
            message: "设备ID不能为空",
            statusCode: 400,
        });
    });

    it("空 pushToken → 抛 400", async () => {
        await expect(
            registerToken(
                {
                    userId: 1,
                    deviceId: "d1",
                    pushToken: "",
                    appPlatform: "android",
                },
                "t1"
            )
        ).rejects.toMatchObject({
            message: "推送Token不能为空",
            statusCode: 400,
        });
    });

    it("空 appPlatform → 抛 400", async () => {
        await expect(
            registerToken(
                {
                    userId: 1,
                    deviceId: "d1",
                    pushToken: "t1",
                    appPlatform: "",
                },
                "t1"
            )
        ).rejects.toMatchObject({
            message: "平台不能为空",
            statusCode: 400,
        });
    });

    it("租户隔离：所有 SQL 调用都传入正确的 tenantId", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(null);
        mocks.queryWithTenant.mockResolvedValue({ insertId: 1 });

        await registerToken(
            {
                userId: 5,
                deviceId: "d-tenant",
                pushToken: "t",
                appPlatform: "android",
            },
            "tenant-XYZ"
        );

        expect(mocks.queryOneWithTenant.mock.calls[0][2]).toBe("tenant-XYZ");
        expect(mocks.queryWithTenant.mock.calls[0][2]).toBe("tenant-XYZ");
    });
});

// ================================================================
// unregisterToken
// ================================================================
describe("push.service - unregisterToken", () => {
    it("注销成功（existing 存在）", async () => {
        mocks.queryOneWithTenant.mockResolvedValue({ id: 88 });

        const res = await unregisterToken("device-X", "fcm", "t1");

        expect(res).toEqual({ affected: 1 });

        // 验证先查询 existing
        const selectCall = mocks.queryOneWithTenant.mock.calls[0];
        expect(selectCall[0]).toContain("SELECT id FROM t_push_token");
        expect(selectCall[1]).toEqual(["device-X", "fcm"]);
        expect(selectCall[2]).toBe("t1");

        // 验证 UPDATE 调用
        const updateCall = mocks.queryWithTenant.mock.calls[0];
        expect(updateCall[0]).toContain("UPDATE t_push_token SET status = 0");
        expect(updateCall[1]).toEqual([88]);
        expect(updateCall[2]).toBe("t1");
    });

    it("Token 不存在 → affected=0", async () => {
        mocks.queryOneWithTenant.mockResolvedValue(null);

        const res = await unregisterToken("no-such", "jpush", "t1");

        expect(res).toEqual({ affected: 0 });
        // 不应调用 UPDATE
        expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("非法 provider → 抛 400", async () => {
        await expect(
            unregisterToken("d1", "wrong" as any, "t1")
        ).rejects.toMatchObject({
            message: expect.stringContaining("非法的推送服务商"),
            statusCode: 400,
        });
        expect(mocks.queryOneWithTenant).not.toHaveBeenCalled();
    });

    it("空 deviceId → 抛 400", async () => {
        await expect(unregisterToken("  ", "jpush", "t1")).rejects.toMatchObject({
            message: "设备ID不能为空",
            statusCode: 400,
        });
    });
});

// ================================================================
// getUserTokens
// ================================================================
describe("push.service - getUserTokens", () => {
    it("查询成功（不含 push_token 字段）", async () => {
        const rows = [
            {
                id: 1,
                tenant_id: "t1",
                user_id: 10,
                device_id: "d1",
                provider: "jpush",
                app_platform: "android",
                app_version: "1.0",
                status: 1,
                last_active_at: "2026-07-20",
                created_at: "2026-07-19",
                updated_at: "2026-07-20",
            },
        ];
        mocks.queryWithTenant.mockResolvedValue(rows);

        const res = await getUserTokens(10, "t1");

        expect(res).toEqual(rows);
        const call = mocks.queryWithTenant.mock.calls[0];
        const sql = call[0] as string;
        expect(sql).toContain("SELECT id, tenant_id, user_id, device_id, provider");
        expect(sql).toContain("status = 1");
        expect(call[1]).toEqual([10]);
        expect(call[2]).toBe("t1");
        // 验证 SELECT 字段列表不含 push_token（只截取 SELECT 到 FROM 之间的部分，避免 FROM t_push_token 表名误判）
        const selectClause = sql.substring(
            sql.toLowerCase().indexOf("select"),
            sql.toLowerCase().indexOf("from")
        );
        expect(selectClause).not.toContain("push_token");
    });

    it("userId 非正整数 → 抛 400", async () => {
        await expect(getUserTokens(0, "t1")).rejects.toMatchObject({
            message: "用户ID必须为正整数",
            statusCode: 400,
        });
        await expect(getUserTokens(-1, "t1")).rejects.toMatchObject({
            message: "用户ID必须为正整数",
            statusCode: 400,
        });
    });
});

// ================================================================
// sendToUser
// ================================================================
describe("push.service - sendToUser", () => {
    it("单设备推送（jpush 成功）", async () => {
        mocks.queryWithTenant.mockResolvedValue([
            { push_token: "token-1", provider: "jpush" },
        ]);
        // 配置 JPush 环境变量
        process.env.JPUSH_APP_KEY = "app-key-123";
        process.env.JPUSH_MASTER_SECRET = "secret-456";
        const mockFetch = makeFetchResponse({ msg_id: "msg-001" }, true, 200);
        global.fetch = mockFetch as any;

        const results = await sendToUser(10, "t1", {
            title: "标题",
            content: "内容",
        });

        expect(results).toEqual([{ success: true, messageId: "msg-001" }]);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        // 验证 fetch 调用参数
        const call = mockFetch.mock.calls[0];
        expect(call[0]).toBe("https://api.jpush.cn/v3/push");
        const opts = call[1] as RequestInit;
        expect(opts.method).toBe("POST");
        const headers = opts.headers as Record<string, string>;
        expect(headers["Authorization"]).toContain("Basic ");
        const body = JSON.parse(opts.body as string);
        expect(body.audience.registration_id).toEqual(["token-1"]);
        expect(body.notification.android.title).toBe("标题");
    });

    it("多设备并发推送（不同厂商各自调用）", async () => {
        mocks.queryWithTenant.mockResolvedValue([
            { push_token: "t-jpush", provider: "jpush" },
            { push_token: "t-fcm", provider: "fcm" },
            { push_token: "t-hms", provider: "hms" },
        ]);
        process.env.JPUSH_APP_KEY = "k1";
        process.env.JPUSH_MASTER_SECRET = "s1";
        process.env.FCM_PROJECT_ID = "fcm-proj";
        process.env.FCM_ACCESS_TOKEN = "fcm-token";
        process.env.HMS_APP_ID = "hms-app";
        process.env.HMS_APP_SECRET = "hms-secret";

        const mockFetch = vi.fn();
        // jpush 调用
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ msg_id: "m-jpush" }),
        });
        // fcm 调用
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ name: "projects/fcm-proj/messages/1" }),
        });
        // hms token 调用
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ access_token: "hms-access" }),
        });
        // hms push 调用
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ code: "0", msgId: "hms-msg-id" }),
        });
        global.fetch = mockFetch as any;

        const results = await sendToUser(20, "t-multi", {
            title: "T",
            content: "C",
        });

        expect(results).toHaveLength(3);
        expect(results[0]).toEqual({ success: true, messageId: "m-jpush" });
        expect(results[1]).toEqual({ success: true, messageId: "projects/fcm-proj/messages/1" });
        expect(results[2]).toEqual({ success: true, messageId: "hms-msg-id" });
        // 总共调用 fetch 4 次（jpush 1 + fcm 1 + hms token 1 + hms push 1）
        expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("无有效 Token → 返回 [{success:false}]", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);

        const results = await sendToUser(10, "t1", {
            title: "T",
            content: "C",
        });

        expect(results).toEqual([{ success: false, errorMsg: "用户无有效推送Token" }]);
        expect(mocks.queryWithTenant).toHaveBeenCalledTimes(1);
    });

    it("userId 非正整数 → 抛 400", async () => {
        await expect(
            sendToUser(0, "t1", { title: "T", content: "C" })
        ).rejects.toMatchObject({
            message: "用户ID必须为正整数",
            statusCode: 400,
        });
    });

    it("推送失败错误隔离：单条 Provider 抛异常不影响其他设备", async () => {
        mocks.queryWithTenant.mockResolvedValue([
            { push_token: "ok-token", provider: "jpush" },
            { push_token: "bad-token", provider: "fcm" },
        ]);
        process.env.JPUSH_APP_KEY = "k";
        process.env.JPUSH_MASTER_SECRET = "s";
        process.env.FCM_PROJECT_ID = "p";
        process.env.FCM_ACCESS_TOKEN = "t";

        const mockFetch = vi.fn();
        // jpush 成功
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ msg_id: "ok-1" }),
        });
        // fcm 抛异常
        mockFetch.mockRejectedValueOnce(new Error("FCM 网络错误"));
        global.fetch = mockFetch as any;

        const results = await sendToUser(30, "t-err", {
            title: "T",
            content: "C",
        });

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({ success: true, messageId: "ok-1" });
        expect(results[1]).toEqual({
            success: false,
            errorMsg: "FCM 网络错误",
        });
    });

    it("租户隔离：查询 Token 时第三个参数为 tenantId", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);

        await sendToUser(99, "tenant-ABC", { title: "T", content: "C" });

        const call = mocks.queryWithTenant.mock.calls[0];
        expect(call[2]).toBe("tenant-ABC");
    });
});

// ================================================================
// sendToTenant
// ================================================================
describe("push.service - sendToTenant", () => {
    it("广播成功", async () => {
        mocks.queryWithTenant.mockResolvedValue([
            { push_token: "tk1", provider: "jpush" },
        ]);
        process.env.JPUSH_APP_KEY = "k";
        process.env.JPUSH_MASTER_SECRET = "s";
        global.fetch = makeFetchResponse({ msg_id: "msg-x" }) as any;

        const results = await sendToTenant("t-broadcast", {
            title: "广播标题",
            content: "广播内容",
        });

        expect(results).toEqual([{ success: true, messageId: "msg-x" }]);
        // 验证查询无 user_id 条件，仅 status=1
        const call = mocks.queryWithTenant.mock.calls[0];
        expect(call[0]).toContain("FROM t_push_token WHERE status = 1");
        expect(call[0]).not.toContain("user_id");
        expect(call[1]).toEqual([]);
        expect(call[2]).toBe("t-broadcast");
    });

    it("租户无 Token → 返回 [{success:false}]", async () => {
        mocks.queryWithTenant.mockResolvedValue([]);

        const results = await sendToTenant("t-empty", {
            title: "T",
            content: "C",
        });

        expect(results).toEqual([{ success: false, errorMsg: "租户无有效推送Token" }]);
    });
});

// ================================================================
// JPushProvider 专项
// ================================================================
describe("push.service - JPushProvider", () => {
    it("send 成功（含 extras 透传）", async () => {
        process.env.JPUSH_APP_KEY = "jpush-key";
        process.env.JPUSH_MASTER_SECRET = "jpush-secret";
        const mockFetch = makeFetchResponse({ msg_id: "jpush-success" }, true, 200);
        global.fetch = mockFetch as any;

        const provider = getProvider("jpush");
        const result = await provider.send({
            token: "reg-id-1",
            title: "标题",
            content: "内容",
            extras: { route: "/order/123" },
            type: "order",
        });

        expect(result).toEqual({ success: true, messageId: "jpush-success" });
        // 验证 Authorization Basic 编码
        const call = mockFetch.mock.calls[0];
        const opts = call[1] as RequestInit;
        const headers = opts.headers as Record<string, string>;
        const expected = "Basic " + Buffer.from("jpush-key:jpush-secret").toString("base64");
        expect(headers["Authorization"]).toBe(expected);
        const body = JSON.parse(opts.body as string);
        expect(body.notification.android.extras).toEqual({ route: "/order/123" });
        expect(body.notification.ios.extras).toEqual({ route: "/order/123" });
    });

    it("send 密钥未配置 → 降级返回 errorMsg（不抛异常）", async () => {
        delete process.env.JPUSH_APP_KEY;
        delete process.env.JPUSH_MASTER_SECRET;
        const mockFetch = vi.fn();
        global.fetch = mockFetch as any;

        const provider = getProvider("jpush");
        const result = await provider.send({
            token: "t",
            title: "T",
            content: "C",
        });

        expect(result.success).toBe(false);
        expect(result.errorMsg).toContain("未配置");
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("send HTTP 错误（响应 ok=false，error.message）", async () => {
        process.env.JPUSH_APP_KEY = "k";
        process.env.JPUSH_MASTER_SECRET = "s";
        global.fetch = makeFetchResponse(
            { error: { message: "Invalid registration_id" } },
            false,
            400
        ) as any;

        const provider = getProvider("jpush");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result).toEqual({
            success: false,
            errorMsg: "Invalid registration_id",
        });
    });

    it("send 响应无 msg_id（ok=true 但无 msg_id）→ 返回 errorMsg with HTTP status", async () => {
        process.env.JPUSH_APP_KEY = "k";
        process.env.JPUSH_MASTER_SECRET = "s";
        global.fetch = makeFetchResponse({}, true, 200) as any;

        const provider = getProvider("jpush");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result.success).toBe(false);
        expect(result.errorMsg).toContain("JPush HTTP 200");
    });

    it("send fetch 抛异常 → 错误信息透传", async () => {
        process.env.JPUSH_APP_KEY = "k";
        process.env.JPUSH_MASTER_SECRET = "s";
        const mockFetch = vi.fn().mockRejectedValue(new Error("连接超时"));
        global.fetch = mockFetch as any;

        const provider = getProvider("jpush");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result).toEqual({ success: false, errorMsg: "连接超时" });
    });

    it("sendBatch 并发调用 send（多 payload）", async () => {
        process.env.JPUSH_APP_KEY = "k";
        process.env.JPUSH_MASTER_SECRET = "s";
        const mockFetch = makeFetchResponse({ msg_id: "batch" }, true, 200);
        global.fetch = mockFetch as any;

        const provider = getProvider("jpush");
        const results = await provider.sendBatch([
            { token: "t1", title: "T1", content: "C1" },
            { token: "t2", title: "T2", content: "C2" },
        ]);

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({ success: true, messageId: "batch" });
        expect(results[1]).toEqual({ success: true, messageId: "batch" });
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});

// ================================================================
// FCMProvider 专项
// ================================================================
describe("push.service - FCMProvider", () => {
    it("send 成功（projectId + accessToken）", async () => {
        process.env.FCM_PROJECT_ID = "fcm-project-id";
        process.env.FCM_ACCESS_TOKEN = "fcm-access-token";
        const mockFetch = makeFetchResponse(
            { name: "projects/fcm-project-id/messages/123" },
            true,
            200
        );
        global.fetch = mockFetch as any;

        const provider = getProvider("fcm");
        const result = await provider.send({
            token: "fcm-token-1",
            title: "T",
            content: "C",
        });

        expect(result).toEqual({
            success: true,
            messageId: "projects/fcm-project-id/messages/123",
        });
        // 验证 URL 包含 projectId
        const call = mockFetch.mock.calls[0];
        expect(call[0]).toBe(
            "https://fcm.googleapis.com/v1/projects/fcm-project-id/messages:send"
        );
        // 验证 Bearer token
        const opts = call[1] as RequestInit;
        const headers = opts.headers as Record<string, string>;
        expect(headers["Authorization"]).toBe("Bearer fcm-access-token");
        const body = JSON.parse(opts.body as string);
        expect(body.message.token).toBe("fcm-token-1");
        expect(body.message.notification.title).toBe("T");
    });

    it("send 密钥未配置 → 降级返回 errorMsg", async () => {
        delete process.env.FCM_PROJECT_ID;
        delete process.env.FCM_ACCESS_TOKEN;
        const mockFetch = vi.fn();
        global.fetch = mockFetch as any;

        const provider = getProvider("fcm");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result.success).toBe(false);
        expect(result.errorMsg).toContain("未配置");
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("send 仅配置 projectId 未配置 accessToken → 降级返回 errorMsg", async () => {
        process.env.FCM_PROJECT_ID = "p1";
        delete process.env.FCM_ACCESS_TOKEN;
        const mockFetch = vi.fn();
        global.fetch = mockFetch as any;

        const provider = getProvider("fcm");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result.success).toBe(false);
        expect(result.errorMsg).toContain("未配置");
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("send HTTP 错误（ok=false，error.message）", async () => {
        process.env.FCM_PROJECT_ID = "p";
        process.env.FCM_ACCESS_TOKEN = "t";
        global.fetch = makeFetchResponse(
            { error: { message: "Invalid token" } },
            false,
            400
        ) as any;

        const provider = getProvider("fcm");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result).toEqual({ success: false, errorMsg: "Invalid token" });
    });

    it("send 响应无 name → 返回 errorMsg with HTTP status", async () => {
        process.env.FCM_PROJECT_ID = "p";
        process.env.FCM_ACCESS_TOKEN = "t";
        global.fetch = makeFetchResponse({}, true, 200) as any;

        const provider = getProvider("fcm");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result.success).toBe(false);
        expect(result.errorMsg).toContain("FCM HTTP 200");
    });

    it("send fetch 抛异常 → 错误信息透传", async () => {
        process.env.FCM_PROJECT_ID = "p";
        process.env.FCM_ACCESS_TOKEN = "t";
        const mockFetch = vi.fn().mockRejectedValue(new Error("network down"));
        global.fetch = mockFetch as any;

        const provider = getProvider("fcm");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result).toEqual({ success: false, errorMsg: "network down" });
    });
});

// ================================================================
// HMSProvider 专项（华为 Push Kit：OAuth2 + 推送两段式）
// ================================================================
describe("push.service - HMSProvider", () => {
    it("send 成功（先获取 access_token，再调推送，code=0 表示成功）", async () => {
        process.env.HMS_APP_ID = "hms-app-id";
        process.env.HMS_APP_SECRET = "hms-secret";
        const mockFetch = vi.fn();
        // 第一次：获取 access_token
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ access_token: "hms-access-1" }),
        });
        // 第二次：推送
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ code: "0", msgId: "hms-msg-001" }),
        });
        global.fetch = mockFetch as any;

        const provider = getProvider("hms");
        const result = await provider.send({
            token: "hms-device-token",
            title: "T",
            content: "C",
            extras: { route: "/home" },
        });

        expect(result).toEqual({ success: true, messageId: "hms-msg-001" });

        // 验证第一次调用：获取 access_token
        const tokenCall = mockFetch.mock.calls[0];
        expect(tokenCall[0]).toBe(
            "https://oauth-api.cloud.huawei.com/openapi/v1/hms-app-id/token"
        );
        const tokenOpts = tokenCall[1] as RequestInit;
        const tokenBody = JSON.parse(tokenOpts.body as string);
        expect(tokenBody.grant_type).toBe("client_credentials");
        expect(tokenBody.client_secret).toBe("hms-secret");
        expect(tokenBody.client_id).toBe("hms-app-id");

        // 验证第二次调用：推送
        const pushCall = mockFetch.mock.calls[1];
        expect(pushCall[0]).toBe(
            "https://push-api.cloud.huawei.com/v2/hms-app-id/messages:send"
        );
        const pushOpts = pushCall[1] as RequestInit;
        const pushHeaders = pushOpts.headers as Record<string, string>;
        expect(pushHeaders["Authorization"]).toBe("Bearer hms-access-1");
        const pushBody = JSON.parse(pushOpts.body as string);
        expect(pushBody.message.token).toEqual(["hms-device-token"]);
        expect(pushBody.message.notification.title).toBe("T");
    });

    it("send 密钥未配置 → 降级返回 errorMsg", async () => {
        delete process.env.HMS_APP_ID;
        delete process.env.HMS_APP_SECRET;
        const mockFetch = vi.fn();
        global.fetch = mockFetch as any;

        const provider = getProvider("hms");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result.success).toBe(false);
        expect(result.errorMsg).toContain("未配置");
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("send 获取 access_token 失败（响应无 access_token）→ 返回 errorMsg", async () => {
        process.env.HMS_APP_ID = "appid";
        process.env.HMS_APP_SECRET = "appsecret";
        const mockFetch = makeFetchResponse({}, true, 200); // 无 access_token
        global.fetch = mockFetch as any;

        const provider = getProvider("hms");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result).toEqual({ success: false, errorMsg: "HMS 获取 access_token 失败" });
        // 只调用了 1 次 fetch（token 接口），未调用推送接口
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("send 获取 access_token 时 fetch 抛异常 → 返回 errorMsg", async () => {
        process.env.HMS_APP_ID = "appid";
        process.env.HMS_APP_SECRET = "appsecret";
        const mockFetch = vi.fn().mockRejectedValue(new Error("token endpoint down"));
        global.fetch = mockFetch as any;

        const provider = getProvider("hms");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result).toEqual({
            success: false,
            errorMsg: "HMS 获取 access_token 失败",
        });
    });

    it("send 推送响应 code 非 '0' → 返回 errorMsg", async () => {
        process.env.HMS_APP_ID = "appid";
        process.env.HMS_APP_SECRET = "appsecret";
        const mockFetch = vi.fn();
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ access_token: "at" }),
        });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ code: "1000", msg: "无效的Token" }),
        });
        global.fetch = mockFetch as any;

        const provider = getProvider("hms");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result).toEqual({ success: false, errorMsg: "无效的Token" });
    });

    it("send 推送响应无 msg 字段 → 返回 errorMsg with HTTP status", async () => {
        process.env.HMS_APP_ID = "appid";
        process.env.HMS_APP_SECRET = "appsecret";
        const mockFetch = vi.fn();
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ access_token: "at" }),
        });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 500,
            json: () => Promise.resolve({ code: "1" }),
        });
        global.fetch = mockFetch as any;

        const provider = getProvider("hms");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result.success).toBe(false);
        expect(result.errorMsg).toContain("HMS HTTP 500");
    });

    it("send 推送阶段 fetch 抛异常 → 错误信息透传", async () => {
        process.env.HMS_APP_ID = "appid";
        process.env.HMS_APP_SECRET = "appsecret";
        const mockFetch = vi.fn();
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ access_token: "at" }),
        });
        mockFetch.mockRejectedValueOnce(new Error("push endpoint down"));
        global.fetch = mockFetch as any;

        const provider = getProvider("hms");
        const result = await provider.send({ token: "t", title: "T", content: "C" });

        expect(result).toEqual({ success: false, errorMsg: "push endpoint down" });
    });
});
