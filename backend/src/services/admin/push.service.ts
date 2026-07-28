/**
 * 推送服务
 *
 * 用途：App 端推送通知统一入口，支持多厂商适配（极光 JPush / Firebase Cloud Messaging / 华为 HMS Push Kit）。
 * - registerToken：注册/更新推送Token（upsert t_push_token，按 device_id + provider 唯一）
 * - unregisterToken：注销Token（status 置 0）
 * - sendToUser：向指定用户的全部有效设备并发推送
 * - sendToTenant：向租户内全部有效设备广播推送
 * - getProvider：按名称获取服务商实例（jpush/fcm/hms）
 *
 * 安全设计：
 * - 所有第三方密钥（JPush appKey/masterSecret、FCM service account、HMS appId/appSecret）从环境变量读取
 * - 密钥未配置时不抛异常，降级返回 errorMsg，保证通知主流程不受影响
 * - 使用 queryWithTenant / queryOneWithTenant 实现租户隔离，所有 SQL 自动注入 tenant_id 条件
 *
 * 关联任务：R51-07 后端推送通知服务
 */

import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import logger from "../../shared/logger";
import { env } from "../../shared/env";

// ==================== 类型定义 ====================

/** 推送服务商名称 */
export type PushProviderName = "jpush" | "fcm" | "hms";

/** 推送类型（对齐现有 NotificationType：system/order/inventory/marketing） */
export type PushType = "system" | "order" | "inventory" | "marketing";

/** 支持的推送服务商白名单 */
export const PUSH_PROVIDER_VALUES: readonly PushProviderName[] = ["jpush", "fcm", "hms"] as const;

/** 推送负载 */
export interface PushPayload {
    /** 推送Token（极光 registration_id / FCM token / HMS token） */
    token: string;
    /** 通知标题 */
    title: string;
    /** 通知内容 */
    content: string;
    /** 附加数据（跳转路由等） */
    extras?: Record<string, unknown>;
    /** 推送类型 */
    type?: PushType;
}

/** 推送结果 */
export interface PushResult {
    success: boolean;
    messageId?: string;
    errorMsg?: string;
}

/** PushProvider 接口 — 统一推送服务商行为 */
export interface PushProvider {
    name: PushProviderName;
    /** 推送单条消息 */
    send(payload: PushPayload): Promise<PushResult>;
    /** 批量推送（默认实现：并发调用 send） */
    sendBatch(payloads: PushPayload[]): Promise<PushResult[]>;
}

/** Token 行（数据库返回结构） */
export interface PushTokenRow {
    id: number;
    tenant_id: string;
    user_id: number;
    device_id: string;
    push_token: string;
    provider: PushProviderName;
    app_platform: string;
    app_version: string | null;
    status: number;
    last_active_at: string;
    created_at: string;
    updated_at: string;
}

/** 注册Token入参 */
export interface RegisterTokenInput {
    userId: number;
    deviceId: string;
    pushToken: string;
    provider?: PushProviderName;
    appPlatform: string;
    appVersion?: string | null;
}

/** 发送通知入参（用于 sendToUser / sendToTenant） */
export interface SendPushInput {
    title: string;
    content: string;
    extras?: Record<string, unknown>;
    type?: PushType;
}

// ==================== 默认批量推送实现（混入到具体 Provider） ====================

async function defaultSendBatch(provider: PushProvider, payloads: PushPayload[]): Promise<PushResult[]> {
    return Promise.all(payloads.map((p) => provider.send(p)));
}

// ==================== JPush 极光推送 ====================

class JPushProvider implements PushProvider {
    name: PushProviderName = "jpush";

    /** 从环境变量读取 appKey（每次调用时动态读取，便于测试时 mock） */
    private getAppKey(): string {
        return env.JPUSH_APP_KEY;
    }

    /** 从环境变量读取 masterSecret */
    private getMasterSecret(): string {
        return env.JPUSH_MASTER_SECRET;
    }

    private buildAuthHeader(appKey: string, masterSecret: string): string {
        return "Basic " + Buffer.from(`${appKey}:${masterSecret}`).toString("base64");
    }

    async send(payload: PushPayload): Promise<PushResult> {
        const appKey = this.getAppKey();
        const masterSecret = this.getMasterSecret();
        if (!appKey || !masterSecret) {
            return { success: false, errorMsg: "JPush appKey/masterSecret 未配置（请设置 JPUSH_APP_KEY / JPUSH_MASTER_SECRET 环境变量）" };
        }
        const body = {
            platform: "all",
            audience: { registration_id: [payload.token] },
            notification: {
                alert: payload.content,
                android: {
                    title: payload.title,
                    extras: payload.extras || {},
                },
                ios: {
                    alert: payload.content,
                    sound: "default",
                    extras: payload.extras || {},
                },
            },
            options: { time_to_live: 86400 },
        };
        try {
            const resp = await fetch("https://api.jpush.cn/v3/push", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: this.buildAuthHeader(appKey, masterSecret),
                },
                body: JSON.stringify(body),
            });
            const data = (await resp.json()) as { msg_id?: string; error?: { code?: number; message?: string } };
            if (resp.ok && data.msg_id) {
                return { success: true, messageId: String(data.msg_id) };
            }
            return { success: false, errorMsg: data.error?.message || `JPush HTTP ${resp.status}` };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`[push.jpush] 推送失败: ${msg}`);
            return { success: false, errorMsg: msg };
        }
    }

    sendBatch(payloads: PushPayload[]): Promise<PushResult[]> {
        return defaultSendBatch(this, payloads);
    }
}

// ==================== FCM Firebase Cloud Messaging ====================

class FCMProvider implements PushProvider {
    name: PushProviderName = "fcm";

    private getProjectId(): string {
        return env.FCM_PROJECT_ID;
    }

    private getAccessToken(): string {
        return env.FCM_ACCESS_TOKEN;
    }

    async send(payload: PushPayload): Promise<PushResult> {
        const projectId = this.getProjectId();
        const accessToken = this.getAccessToken();
        if (!projectId || !accessToken) {
            return { success: false, errorMsg: "FCM projectId/accessToken 未配置（请设置 FCM_PROJECT_ID / FCM_ACCESS_TOKEN 环境变量）" };
        }
        const body = {
            message: {
                token: payload.token,
                notification: { title: payload.title, body: payload.content },
                data: (payload.extras as Record<string, string>) || {},
            },
        };
        try {
            const resp = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(body),
            });
            const data = (await resp.json()) as { name?: string; error?: { message?: string } };
            if (resp.ok && data.name) {
                return { success: true, messageId: data.name };
            }
            return { success: false, errorMsg: data.error?.message || `FCM HTTP ${resp.status}` };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`[push.fcm] 推送失败: ${msg}`);
            return { success: false, errorMsg: msg };
        }
    }

    sendBatch(payloads: PushPayload[]): Promise<PushResult[]> {
        return defaultSendBatch(this, payloads);
    }
}

// ==================== HMS 华为推送（HarmonyOS） ====================

class HMSProvider implements PushProvider {
    name: PushProviderName = "hms";

    private getAppId(): string {
        return env.HMS_APP_ID;
    }

    private getAppSecret(): string {
        return env.HMS_APP_SECRET;
    }

    /** 获取 HMS OAuth access_token */
    private async fetchAccessToken(appId: string, appSecret: string): Promise<string | null> {
        try {
            const resp = await fetch(`https://oauth-api.cloud.huawei.com/openapi/v1/${appId}/token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    grant_type: "client_credentials",
                    client_secret: appSecret,
                    client_id: appId,
                }),
            });
            const data = (await resp.json()) as { access_token?: string };
            return data.access_token || null;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`[push.hms] 获取 access_token 失败: ${msg}`);
            return null;
        }
    }

    async send(payload: PushPayload): Promise<PushResult> {
        const appId = this.getAppId();
        const appSecret = this.getAppSecret();
        if (!appId || !appSecret) {
            return { success: false, errorMsg: "HMS appId/appSecret 未配置（请设置 HMS_APP_ID / HMS_APP_SECRET 环境变量）" };
        }
        try {
            const accessToken = await this.fetchAccessToken(appId, appSecret);
            if (!accessToken) {
                return { success: false, errorMsg: "HMS 获取 access_token 失败" };
            }
            const pushResp = await fetch(`https://push-api.cloud.huawei.com/v2/${appId}/messages:send`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    message: {
                        token: [payload.token],
                        notification: { title: payload.title, body: payload.content },
                        data: payload.extras ? JSON.stringify(payload.extras) : undefined,
                    },
                }),
            });
            const pushData = (await pushResp.json()) as { code?: string; msgId?: string; msg?: string };
            if (pushResp.ok && pushData.code === "0") {
                return { success: true, messageId: pushData.msgId };
            }
            return { success: false, errorMsg: pushData.msg || `HMS HTTP ${pushResp.status}` };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`[push.hms] 推送失败: ${msg}`);
            return { success: false, errorMsg: msg };
        }
    }

    sendBatch(payloads: PushPayload[]): Promise<PushResult[]> {
        return defaultSendBatch(this, payloads);
    }
}

// ==================== Provider 注册表（单例） ====================

const providers: Record<PushProviderName, PushProvider> = {
    jpush: new JPushProvider(),
    fcm: new FCMProvider(),
    hms: new HMSProvider(),
};

/**
 * 获取指定服务商实例
 *
 * @param name 服务商名称（jpush/fcm/hms）
 * @throws 400 — 非法的服务商名称
 */
export function getProvider(name: PushProviderName): PushProvider {
    if (!PUSH_PROVIDER_VALUES.includes(name)) {
        throw Object.assign(new Error(`非法的推送服务商：${name}`), { statusCode: 400 });
    }
    return providers[name];
}

// ==================== Token 注册/注销/查询 ====================

/**
 * 注册/更新推送Token（upsert：根据 device_id + provider 唯一键）
 * - 已存在：更新 token + 状态置 1 + 刷新 last_active_at
 * - 不存在：插入新记录
 *
 * @param data 注册数据
 * @param tenantId 租户ID
 * @returns 新建/更新后的记录ID
 */
export async function registerToken(
    data: RegisterTokenInput,
    tenantId: string
): Promise<{ id: number }> {
    const provider: PushProviderName = data.provider ?? "jpush";
    if (!PUSH_PROVIDER_VALUES.includes(provider)) {
        throw Object.assign(new Error(`非法的推送服务商：${provider}`), { statusCode: 400 });
    }
    if (!data.userId || data.userId <= 0) {
        throw Object.assign(new Error("用户ID必须为正整数"), { statusCode: 400 });
    }
    if (!data.deviceId || data.deviceId.trim().length === 0) {
        throw Object.assign(new Error("设备ID不能为空"), { statusCode: 400 });
    }
    if (!data.pushToken || data.pushToken.trim().length === 0) {
        throw Object.assign(new Error("推送Token不能为空"), { statusCode: 400 });
    }
    if (!data.appPlatform || data.appPlatform.trim().length === 0) {
        throw Object.assign(new Error("平台不能为空"), { statusCode: 400 });
    }

    const existing = await queryOneWithTenant<{ id: number }>(
        "SELECT id FROM t_push_token WHERE device_id = ? AND provider = ?",
        [data.deviceId, provider],
        tenantId
    );

    if (existing) {
        await queryWithTenant(
            `UPDATE t_push_token
       SET user_id = ?, push_token = ?, app_platform = ?, app_version = ?, status = 1, last_active_at = NOW()
       WHERE id = ?`,
            [data.userId, data.pushToken, data.appPlatform, data.appVersion ?? null, existing.id],
            tenantId
        );
        return { id: existing.id };
    }

    const result = await queryWithTenant<{ insertId: number }>(
        `INSERT INTO t_push_token
       (user_id, device_id, push_token, provider, app_platform, app_version, status, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
        [data.userId, data.deviceId, data.pushToken, provider, data.appPlatform, data.appVersion ?? null],
        tenantId
    );
    const insertId = Number(
        (result as unknown as Record<string, unknown>).insertId ?? 0
    );
    return { id: insertId };
}

/**
 * 注销推送Token（软删除：status 置 0）
 *
 * @param deviceId 设备ID
 * @param provider 服务商名称
 * @param tenantId 租户ID
 * @returns affected=1 注销成功，affected=0 Token不存在
 */
export async function unregisterToken(
    deviceId: string,
    provider: PushProviderName,
    tenantId: string
): Promise<{ affected: number }> {
    if (!PUSH_PROVIDER_VALUES.includes(provider)) {
        throw Object.assign(new Error(`非法的推送服务商：${provider}`), { statusCode: 400 });
    }
    if (!deviceId || deviceId.trim().length === 0) {
        throw Object.assign(new Error("设备ID不能为空"), { statusCode: 400 });
    }

    const existing = await queryOneWithTenant<{ id: number }>(
        "SELECT id FROM t_push_token WHERE device_id = ? AND provider = ?",
        [deviceId, provider],
        tenantId
    );

    if (!existing) {
        return { affected: 0 };
    }

    await queryWithTenant(
        "UPDATE t_push_token SET status = 0 WHERE id = ?",
        [existing.id],
        tenantId
    );
    return { affected: 1 };
}

/**
 * 查询当前用户的所有有效 Token
 *
 * @param userId 用户ID
 * @param tenantId 租户ID
 * @returns Token 列表（不含 push_token 字段以避免泄露）
 */
export async function getUserTokens(
    userId: number,
    tenantId: string
): Promise<Array<Omit<PushTokenRow, "push_token">>> {
    if (!userId || userId <= 0) {
        throw Object.assign(new Error("用户ID必须为正整数"), { statusCode: 400 });
    }
    return queryWithTenant<Omit<PushTokenRow, "push_token">>(
        `SELECT id, tenant_id, user_id, device_id, provider, app_platform, app_version, status, last_active_at, created_at, updated_at
     FROM t_push_token
     WHERE user_id = ? AND status = 1
     ORDER BY last_active_at DESC`,
        [userId],
        tenantId
    );
}

// ==================== 推送发送 ====================

/**
 * 向指定用户的所有有效设备并发推送
 *
 * @param userId 用户ID
 * @param tenantId 租户ID
 * @param payload 推送内容（title/content/extras/type）
 * @returns 各设备的推送结果数组（无设备时返回 [{success:false, errorMsg}]）
 */
export async function sendToUser(
    userId: number,
    tenantId: string,
    payload: SendPushInput
): Promise<PushResult[]> {
    if (!userId || userId <= 0) {
        throw Object.assign(new Error("用户ID必须为正整数"), { statusCode: 400 });
    }

    const tokens = await queryWithTenant<{ push_token: string; provider: PushProviderName }>(
        "SELECT push_token, provider FROM t_push_token WHERE user_id = ? AND status = 1",
        [userId],
        tenantId
    );

    if (!tokens || tokens.length === 0) {
        return [{ success: false, errorMsg: "用户无有效推送Token" }];
    }

    return Promise.all(
        tokens.map((t) => {
            const provider = getProvider(t.provider);
            return provider.send({
                token: t.push_token,
                title: payload.title,
                content: payload.content,
                extras: payload.extras,
                type: payload.type,
            });
        })
    );
}

/**
 * 向租户内所有有效设备广播推送
 *
 * @param tenantId 租户ID
 * @param payload 推送内容
 * @returns 各设备的推送结果数组（无设备时返回 [{success:false, errorMsg}]）
 */
export async function sendToTenant(
    tenantId: string,
    payload: SendPushInput
): Promise<PushResult[]> {
    const tokens = await queryWithTenant<{ push_token: string; provider: PushProviderName }>(
        "SELECT push_token, provider FROM t_push_token WHERE status = 1",
        [],
        tenantId
    );

    if (!tokens || tokens.length === 0) {
        return [{ success: false, errorMsg: "租户无有效推送Token" }];
    }

    return Promise.all(
        tokens.map((t) => {
            const provider = getProvider(t.provider);
            return provider.send({
                token: t.push_token,
                title: payload.title,
                content: payload.content,
                extras: payload.extras,
                type: payload.type,
            });
        })
    );
}
