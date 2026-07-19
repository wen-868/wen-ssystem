/**
 * 通知发送器（扩展版：通知记录 + 推送）
 *
 * 用途：在原 shared/notification-sender.ts 写入 t_notification 表的基础上，
 *      调用 PushService.sendToUser 异步推送通知到用户设备。
 *
 * 设计原则：
 * - 推送失败不影响通知记录创建（错误隔离：catch 异常后只记日志，不向上抛）
 * - 推送与通知类型映射：SYSTEM→system / ORDER→order / PAYMENT→order / ALERT→inventory / CREDIT→system / RECALL→system
 * - 关联任务：R51-07 后端推送通知服务
 *
 * 与 shared/notification-sender.ts 的关系：
 * - shared/notification-sender.ts 是底层通知记录写入器（被路由层 re-export 使用）
 * - 本文件在其基础上扩展推送能力，调用方按需选用
 */

import { pool, queryOne } from "../../shared/db";
import { sendNotification, type SendNotificationParams } from "../../shared/notification-sender";
import { sendToUser } from "./push.service";
import logger from "../../shared/logger";

/** 推送类型（对齐 PushService.PushType） */
type PushType = "system" | "order" | "inventory" | "marketing";

/**
 * 通知类型 → 推送类型 映射
 *
 * 通知类型 SendNotificationParams.type 是业务概念（SYSTEM/ORDER/PAYMENT/ALERT/CREDIT/RECALL），
 * 推送类型 PushType 是 App 端路由分发概念（system/order/inventory/marketing），按语义归并：
 *  - SYSTEM/CREDIT/RECALL → system（系统通知）
 *  - ORDER/PAYMENT → order（订单通知）
 *  - ALERT → inventory（库存/告警通知，对齐 App 端 inventory 路由）
 */
const TYPE_TO_PUSH_TYPE: Record<SendNotificationParams["type"], PushType> = {
    SYSTEM: "system",
    ORDER: "order",
    PAYMENT: "order",
    ALERT: "inventory",
    CREDIT: "system",
    RECALL: "system",
};

/**
 * 创建通知记录并异步推送
 *
 * 流程：
 *   1. 调用 shared/notification-sender.sendNotification 写入 t_notification 表
 *   2. 调用 PushService.sendToUser 异步推送到用户设备
 *   3. 推送失败仅记日志，不影响通知记录创建
 *
 * @param params 通知参数
 * @param options 可选：是否启用推送（默认 true）、是否需要推送 extras
 * @returns 通知记录ID + 推送结果数组（推送失败不影响通知ID）
 */
export async function sendNotificationWithPush(
    params: SendNotificationParams,
    options: { enablePush?: boolean } = {}
): Promise<{ notificationId: number; pushResults: Array<{ success: boolean; errorMsg?: string }> }> {
    const { enablePush = true } = options;

    // 1. 写入通知记录
    const notificationId = await sendNotification(pool, params);

    // 2. 异步推送（错误隔离：catch 异常后只记日志，不向上抛）
    let pushResults: Array<{ success: boolean; errorMsg?: string }> = [];
    if (enablePush) {
        try {
            const pushType = TYPE_TO_PUSH_TYPE[params.type] || "system";
            const results = await sendToUser(params.recipientId, params.tenantId, {
                title: params.title,
                content: params.content,
                type: pushType,
                extras: {
                    notificationId,
                    relatedId: params.relatedId ?? null,
                    relatedType: params.relatedType ?? null,
                    type: pushType,
                },
            });
            pushResults = results;
            const failed = results.filter((r) => !r.success);
            if (failed.length > 0) {
                logger.warn(
                    `[notification-sender] 推送部分失败: notificationId=${notificationId}, failed=${failed.length}/${results.length}`
                );
            }
        } catch (err) {
            // 推送整体失败不影响通知记录创建
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`[notification-sender] 推送异常（不影响通知记录）: notificationId=${notificationId}, error=${msg}`);
            pushResults = [{ success: false, errorMsg: msg }];
        }
    }

    return { notificationId, pushResults };
}

/**
 * 批量创建通知记录并推送
 *
 * @param items 通知参数数组
 * @returns 每条通知的结果数组（顺序与 items 一致）
 */
export async function sendBatchNotificationWithPush(
    items: SendNotificationParams[]
): Promise<Array<{ notificationId: number; pushResults: Array<{ success: boolean; errorMsg?: string }> }>> {
    return Promise.all(items.map((item) => sendNotificationWithPush(item)));
}

/**
 * 简易计数：查询某租户某用户的通知未读总数（推送点击后回传 used_id 时可校验）
 * 用于推送前的"是否还有未读"判断，避免重复推送已读通知
 *
 * @param userId 用户ID
 * @param tenantId 租户ID
 * @returns 未读总数
 */
export async function getUnreadCount(userId: number, tenantId: string): Promise<number> {
    const row = await queryOne<{ total: number }>(
        "SELECT COUNT(*) AS total FROM t_notification WHERE recipient_id = ? AND tenant_id = ? AND is_read = 0",
        [userId, tenantId]
    );
    return Number(row?.total ?? 0);
}

export { sendNotification, type SendNotificationParams } from "../../shared/notification-sender";
