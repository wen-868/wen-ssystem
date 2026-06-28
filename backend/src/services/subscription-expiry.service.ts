import { query, queryOne } from "../shared/db.js";

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * 订阅到期检查服务
 * 每天凌晨2点检查即将到期的订阅
 * 1. 检查7天内即将到期的订阅，发送到期提醒
 * 2. 检查已过期但未停用的订阅，自动停用租户
 */
export async function checkSubscriptionExpiry() {
  console.info("[SubscriptionExpiry] 开始检查订阅到期...");

  try {
    // 1. 检查7天内即将到期的订阅
    const expiringSoon = await query<any>(
      `SELECT s.id, s.subscription_no, s.tenant_id, s.end_date,
              s.expire_notify_sent, s.auto_renew,
              t.company_name, t.contact_mobile, t.contact_person,
              DATEDIFF(s.end_date, CURDATE()) AS days_remaining
       FROM subscription s
       LEFT JOIN tenant t ON t.id = s.tenant_id
       WHERE s.status = 'ACTIVE'
         AND s.payment_status = 'PAID'
         AND s.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
         AND s.expire_notify_sent = 0
       ORDER BY s.end_date ASC`
    );

    for (const sub of expiringSoon) {
      console.info(`[SubscriptionExpiry] 订阅 ${sub.subscription_no} 将在 ${sub.days_remaining} 天后到期`);

      // 发送到期提醒（这里只是记录日志，实际应该对接短信/邮件服务）
      console.info(`[SubscriptionExpiry] 发送到期提醒给 ${sub.company_name} (${sub.contact_mobile})`);

      // 标记已发送通知
      await query(
        "UPDATE subscription SET expire_notify_sent = 1, expire_notify_at = NOW() WHERE id = ?",
        [sub.id]
      );

      // 如果是自动续费，创建续费订单
      if (sub.auto_renew) {
        console.info(`[SubscriptionExpiry] 订阅 ${sub.subscription_no} 开启自动续费，创建续费订单`);
        // 这里可以调用创建续费订单的逻辑
      }
    }

    // 2. 检查已过期但未停用的订阅
    const expired = await query<any>(
      `SELECT s.id, s.subscription_no, s.tenant_id, s.end_date,
              t.company_name, t.status AS tenant_status,
              DATEDIFF(CURDATE(), s.end_date) AS overdue_days
       FROM subscription s
       LEFT JOIN tenant t ON t.id = s.tenant_id
       WHERE s.status = 'ACTIVE'
         AND s.end_date < CURDATE()
         AND t.status = 'ACTIVE'
       ORDER BY s.end_date ASC`
    );

    for (const sub of expired) {
      console.info(`[SubscriptionExpiry] 订阅 ${sub.subscription_no} 已过期 ${sub.overdue_days} 天`);

      // 自动停用租户
      await query(
        `UPDATE tenant SET status = 'EXPIRED', suspend_reason = '订阅已到期', suspended_at = NOW()
         WHERE id = ? AND status = 'ACTIVE'`,
        [sub.tenant_id]
      );

      // 更新订阅状态
      await query(
        "UPDATE subscription SET status = 'EXPIRED' WHERE id = ?",
        [sub.id]
      );

      console.info(`[SubscriptionExpiry] 租户 ${sub.company_name} 已自动停用`);
    }

    console.info(`[SubscriptionExpiry] 检查完成，发现 ${expiringSoon.length} 个即将到期，${expired.length} 个已过期`);
  } catch (error) {
    console.error("[SubscriptionExpiry] 检查失败:", error);
  }
}

/**
 * 启动订阅到期检查定时任务
 * 每天凌晨2点执行
 */
export function startSubscriptionExpiryScanner() {
  if (schedulerInterval) {
    console.info("[SubscriptionExpiry] 定时任务已在运行");
    return;
  }

  console.info("[SubscriptionExpiry] 启动订阅到期检查定时任务");

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
    console.info("[SubscriptionExpiry] 定时任务已停止");
  }
}
