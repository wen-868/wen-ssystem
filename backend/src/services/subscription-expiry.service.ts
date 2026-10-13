import { query } from "../shared/db";
import logger from "../shared/logger";
import { toTenantStatusValue } from "./platform-tenant.service";

/**
 * 租户「停用」在库里的写值。
 *
 * `t_tenant.status` 的**权威形态是 TINYINT（1=启用 / 0=停用）**：
 *   · `backend/src/shared/migration.ts:539` 与 `docs/migrations/092_租户ID.sql:76` 都按 TINYINT 建表；
 *   · 证据 `docs/evidence/MIG-1/outputs/02-plan.json:2043` 的注记「与 092 迁移及生产一致」、
 *     收口卡 `R101-C4-0-阿坚清账.md:437`（A7）、迁移 `169_tenant_admin_uuid.sql` 的注释（生产
 *     写 'ACTIVE' 字符串 ⇒ 500）均指向数值列；S3-150 已在真库复现 1366（写字符串）。
 * 故"落 DISABLED"在库层就是写 0 —— 取值经唯一映射点 `toTenantStatusValue` 得出，不在本文件另立口径。
 * 读写两侧都用 `toTenantStatus`/`toTenantStatusValue` 的口径（0/'0'/'DISABLED' ⇒ DISABLED）。
 */
const TENANT_STATUS_DISABLED_DB = toTenantStatusValue("DISABLED") ?? 0;

/**
 * "当前启用"的判定（供 WHERE 用）：按**字符串**比较 status。
 *
 * 为什么不用 `status = 'ACTIVE'`：在 TINYINT 列上 MySQL 会把 'ACTIVE' 隐式转成 0
 * ⇒ 谓词变成 `status = 0`，命中的是**停用**行（语义反了；本文件原 L84/L93 两处即此写法）。
 * 而 `status = 1` 在 `docs/migrations/016/029` 声明的 VARCHAR(16) 老库上又不命中 'ACTIVE'。
 * 转字符串后比较在两种 schema 下语义一致：
 *   · TINYINT ⇒ CAST(1) = '1' 命中、CAST(0) = '0' 不命中；
 *   · VARCHAR ⇒ 'ACTIVE'/'1' 命中、'DISABLED'/'0' 不命中。
 */
const TENANT_ACTIVE_SQL_PREDICATE = `CAST(status AS CHAR) IN ('1', 'ACTIVE')`;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/** 即将到期的订阅行 */
interface ExpiringSubscriptionRow {
  id: number;
  subscription_no: string;
  tenant_id: string;
  end_date: string;
  expire_notify_sent: number;
  auto_renew: number;
  company_name: string;
  contact_mobile: string;
  contact_person: string;
  days_remaining: number;
}

/** 已过期的订阅行 */
interface ExpiredSubscriptionRow {
  id: number;
  subscription_no: string;
  tenant_id: string;
  end_date: string;
  company_name: string;
  tenant_status: string;
  overdue_days: number;
}

/**
 * 订阅到期检查服务
 * 每天凌晨2点检查即将到期的订阅
 * 1. 检查7天内即将到期的订阅，发送到期提醒
 * 2. 检查已过期但未停用的订阅，自动停用租户
 */
export async function checkSubscriptionExpiry() {
  logger.info("[SubscriptionExpiry] 开始检查订阅到期...");

  try {
    // 1. 检查7天内即将到期的订阅
    const expiringSoon = await query<ExpiringSubscriptionRow>(
      `SELECT s.id, s.subscription_no, s.tenant_id, s.end_date,
              s.expire_notify_sent, s.auto_renew,
              t.company_name, t.contact_mobile, t.contact_person,
              DATEDIFF(s.end_date, CURDATE()) AS days_remaining
       FROM t_subscription s
       LEFT JOIN t_tenant t ON t.id = s.tenant_id
       WHERE s.status = 'ACTIVE'
         AND s.payment_status = 'PAID'
         AND s.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
         AND s.expire_notify_sent = 0
       ORDER BY s.end_date ASC`
    );

    for (const sub of expiringSoon) {
      logger.info(`[SubscriptionExpiry] 订阅 ${sub.subscription_no} 将在 ${sub.days_remaining} 天后到期`);

      // 发送到期提醒（这里只是记录日志，实际应该对接短信/邮件服务）
      logger.info(`[SubscriptionExpiry] 发送到期提醒给 ${sub.company_name} (${sub.contact_mobile})`);

      // 标记已发送通知（平台级定时任务：sub.tenant_id 来自前一个跨租户 SELECT，作为双保险加入 WHERE 条件）
      await query(
        "UPDATE t_subscription SET expire_notify_sent = 1, expire_notify_at = NOW() WHERE id = ? AND tenant_id = ?",
        [sub.id, sub.tenant_id]
      );

      // 如果是自动续费，创建续费订单
      if (sub.auto_renew) {
        logger.info(`[SubscriptionExpiry] 订阅 ${sub.subscription_no} 开启自动续费，创建续费订单`);
        // 这里可以调用创建续费订单的逻辑
      }
    }

    // 2. 检查已过期但未停用的订阅
    const expired = await query<ExpiredSubscriptionRow>(
      `SELECT s.id, s.subscription_no, s.tenant_id, s.end_date,
              t.company_name, t.status AS tenant_status,
              DATEDIFF(CURDATE(), s.end_date) AS overdue_days
       FROM t_subscription s
       LEFT JOIN t_tenant t ON t.id = s.tenant_id
       WHERE s.status = 'ACTIVE'
         AND s.end_date < CURDATE()
         AND CAST(t.status AS CHAR) IN ('1', 'ACTIVE')
       ORDER BY s.end_date ASC`
    );

    for (const sub of expired) {
      logger.info(`[SubscriptionExpiry] 订阅 ${sub.subscription_no} 已过期 ${sub.overdue_days} 天`);

      // 自动停用租户
      //  · status 落「DISABLED」的库值（唯一映射点 toTenantStatusValue ⇒ 0，见文件头常量说明）：
      //    原写法直接写字符串 EXPIRED，在 TINYINT 列上触发
      //    ER_TRUNCATED_WRONG_VALUE_FOR_FIELD(1366) ⇒ 本语句自上线起**从未成功过**
      //    （同一缺陷 S3-150 已在真库复现；生产 sql_mode 含 STRICT_TRANS_TABLES）。
      //  · WHERE 用「转字符串比较」判定"当前启用"（原 'ACTIVE' 在 TINYINT 列上被转成 0 ⇒ 语义反了）。
      await query(
        `UPDATE t_tenant SET status = ?, suspend_reason = '订阅已到期', suspended_at = NOW()
         WHERE id = ? AND ${TENANT_ACTIVE_SQL_PREDICATE}`,
        [TENANT_STATUS_DISABLED_DB, sub.tenant_id]
      );

      // 更新订阅状态（平台级定时任务：sub.tenant_id 作为双保险加入 WHERE 条件）
      await query(
        "UPDATE t_subscription SET status = 'EXPIRED' WHERE id = ? AND tenant_id = ?",
        [sub.id, sub.tenant_id]
      );

      logger.info(`[SubscriptionExpiry] 租户 ${sub.company_name} 已自动停用`);
    }

    logger.info(`[SubscriptionExpiry] 检查完成，发现 ${expiringSoon.length} 个即将到期，${expired.length} 个已过期`);
  } catch (error) {
    logger.error("[SubscriptionExpiry] 检查失败:", error);
  }
}

/**
 * 启动订阅到期检查定时任务
 * 每天凌晨2点执行
 */
export function startSubscriptionExpiryScanner() {
  if (schedulerInterval) {
    logger.info("[SubscriptionExpiry] 定时任务已在运行");
    return;
  }

  logger.info("[SubscriptionExpiry] 启动订阅到期检查定时任务");

  // 启动时立即执行一次
  checkSubscriptionExpiry();

  // 每24小时执行一次
  schedulerInterval = setInterval(() => {
    const now = new Date();
    // 在凌晨2点执行
    if (now.getHours() === 2 && now.getMinutes() === 0) {
      checkSubscriptionExpiry();
    }
  }, 60 * 1000); // 每分钟检查一次时间
}

/**
 * 停止订阅到期检查定时任务
 */
export function stopSubscriptionExpiryScanner() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info("[SubscriptionExpiry] 定时任务已停止");
  }
}
