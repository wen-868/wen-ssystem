/**
 * S3-192（B 轨）：在**真迁移库**上跑产品真实的订阅到期作业，验证"到期 ⇒ 租户被停用"这条业务结果。
 *
 * 用法：node docs/evidence/S3-192/harness/06-runtime-expiry.mjs
 * 步骤：
 *   ① 造探针数据：一个**启用**租户（t_tenant.status=1）＋ 一条 end_date 已过、status='ACTIVE' 的订阅
 *   ② 调产品真作业 checkSubscriptionExpiry()
 *   ③ 读回 t_tenant / t_subscription，打印原始行
 * ⚠️ 探针数据（我构造的），不是生产数据；写在 s3192_full 这个本机私有库里。
 */
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3406";
process.env.DB_USER = process.env.DB_USER || "root";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "";
process.env.DB_NAME = process.env.DB_NAME || "s3192_full";
process.env.JWT_SECRET = process.env.JWT_SECRET || "s3192-local-secret";
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.USE_MOCK_DB = "false";

const { query } = await import("../../../../backend/dist/shared/db.js");
const { checkSubscriptionExpiry } = await import("../../../../backend/dist/services/subscription-expiry.service.js");

const TENANT_ID = "s3192-runtime-tenant";

// ① 探针数据（幂等：先删后插）
await query("DELETE FROM t_subscription WHERE tenant_id = ?", [TENANT_ID]);
await query("DELETE FROM t_tenant WHERE id = ?", [TENANT_ID]);
await query(
  "INSERT INTO t_tenant (id, tenant_code, name, company_name, contact_person, contact_mobile, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
  [TENANT_ID, "T-S3192-RT", "S3-192 运行期探针租户", "S3-192 运行期探针租户", "探针联系人", "13800000000", 1]
);
// t_subscription 的 NOT NULL 无默认列（本机真迁移库 SHOW COLUMNS 读数）：subscription_no / tenant_id /
// plan_id / plan_name / plan_type / start_date / end_date / duration_days / price ⇒ 必须逐列给值
await query(
  `INSERT INTO t_subscription
     (subscription_no, tenant_id, plan_id, plan_name, plan_type, start_date, end_date, duration_days, price, status, payment_status)
   VALUES (?, ?, 1, '探针套餐', 'MONTHLY', DATE_SUB(CURDATE(), INTERVAL 40 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY), 30, 199.00, 'ACTIVE', 'PAID')`,
  ["SUB-S3192-RT", TENANT_ID]
);

console.log("[S3-192] ① 作业执行前：");
const before = await query(
  "SELECT id, CAST(status AS CHAR) AS status_raw, suspend_reason, suspended_at FROM t_tenant WHERE id = ?",
  [TENANT_ID]
);
console.log("   t_tenant:", JSON.stringify(before));
console.log(
  "   t_subscription:",
  JSON.stringify(await query("SELECT subscription_no, status, end_date FROM t_subscription WHERE tenant_id = ?", [TENANT_ID]))
);

// ② 跑产品真作业
await checkSubscriptionExpiry();

// ③ 读回
console.log("[S3-192] ② 作业执行后：");
const after = await query(
  "SELECT id, CAST(status AS CHAR) AS status_raw, suspend_reason, (suspended_at IS NOT NULL) AS has_suspended_at FROM t_tenant WHERE id = ?",
  [TENANT_ID]
);
console.log("   t_tenant:", JSON.stringify(after));
console.log(
  "   t_subscription:",
  JSON.stringify(await query("SELECT subscription_no, status, end_date FROM t_subscription WHERE tenant_id = ?", [TENANT_ID]))
);

// 显式退出：mysql2 连接池会让事件循环一直存活，不 exit 时进程不返回（stdout 重定向到文件还会因此不落盘）
process.exit(0);
