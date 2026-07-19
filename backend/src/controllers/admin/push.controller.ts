/**
 * 推送Token控制器
 *
 * 注意：禁止 try-catch（项目规则决策 3），错误统一由全局 errorHandler 处理。
 * 通过 asyncHandler 包装异步函数，自动捕获 Promise 异常并传递到 errorHandler。
 *
 * 接口列表：
 *   POST /api/admin/push/register     注册/更新推送Token
 *   POST /api/admin/push/unregister   注销推送Token
 *   GET  /api/admin/push/tokens       查询当前用户Token列表
 *   POST /api/admin/push/test         发送测试推送（仅 BOSS 角色）
 *
 * 关联任务：R51-07 后端推送通知服务
 */

import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { hasAnyRole } from "../../middleware/auth";
import * as pushService from "../../services/admin/push.service";

// ==================== Zod Schema ====================

const providerSchema = z.enum(["jpush", "fcm", "hms"]);
const appPlatformSchema = z.enum(["android", "ios", "harmony"]);

const registerSchema = z.object({
    deviceId: z.string().min(1).max(128),
    pushToken: z.string().min(1),
    provider: providerSchema.optional(),
    appPlatform: appPlatformSchema,
    appVersion: z.string().max(32).nullable().optional(),
});

const unregisterSchema = z.object({
    deviceId: z.string().min(1).max(128),
    provider: providerSchema,
});

const testPushSchema = z.object({
    title: z.string().min(1).max(100),
    content: z.string().min(1).max(500),
    userId: z.number().int().positive().optional(),
});

// ==================== 控制器函数 ====================

/**
 * 注册/更新推送Token
 * POST /api/admin/push/register
 *
 * body: { deviceId, pushToken, provider?, appPlatform, appVersion? }
 */
export const registerToken = asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const userId = req.user?.id;
    const tenantId = req.tenantId!;
    if (!userId) {
        throw Object.assign(new Error("无法识别用户身份"), { statusCode: 401 });
    }
    const result = await pushService.registerToken(
        {
            userId,
            deviceId: body.deviceId,
            pushToken: body.pushToken,
            provider: body.provider,
            appPlatform: body.appPlatform,
            appVersion: body.appVersion ?? null,
        },
        tenantId
    );
    res.json(ok(result));
});

/**
 * 注销推送Token
 * POST /api/admin/push/unregister
 *
 * body: { deviceId, provider }
 */
export const unregisterToken = asyncHandler(async (req, res) => {
    const body = unregisterSchema.parse(req.body);
    const result = await pushService.unregisterToken(
        body.deviceId,
        body.provider,
        req.tenantId!
    );
    res.json(ok(result));
});

/**
 * 查询当前用户的Token列表
 * GET /api/admin/push/tokens
 */
export const listTokens = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        throw Object.assign(new Error("无法识别用户身份"), { statusCode: 401 });
    }
    const result = await pushService.getUserTokens(userId, req.tenantId!);
    res.json(ok(result));
});

/**
 * 发送测试推送（仅 BOSS/SUPER_ADMIN/OPERATION_ADMIN 角色可用）
 * POST /api/admin/push/test
 *
 * body: { title, content, userId? }
 * - userId 缺省时推给当前用户
 */
export const sendTestPush = asyncHandler(async (req, res) => {
    const body = testPushSchema.parse(req.body);
    const user = req.user;
    if (!user) {
        throw Object.assign(new Error("无法识别用户身份"), { statusCode: 401 });
    }
    // 仅 BOSS/SUPER_ADMIN/OPERATION_ADMIN 可触发测试推送
    const allowed = hasAnyRole(user, ["SUPER_ADMIN", "OPERATION_ADMIN", "BOSS"]);
    if (!allowed) {
        throw Object.assign(new Error("无权限：测试推送仅限管理员角色"), { statusCode: 403 });
    }
    const targetUserId = body.userId ?? user.id;
    const results = await pushService.sendToUser(targetUserId, req.tenantId!, {
        title: body.title,
        content: body.content,
        type: "system",
        extras: { test: true, triggeredBy: user.id },
    });
    res.json(ok({ targetUserId, results }));
});
