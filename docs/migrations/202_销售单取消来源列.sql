-- ============================================
-- 迁移编号：202
-- 单号：S3-209（跨线 P1：销售单取消端点 —— AI 底座 cancelSalesOrder 唯一阻塞项）
-- 描述：t_sale_bill 补 void_source 列 —— void_source VARCHAR(16) NOT NULL DEFAULT 'admin'
-- 创建人：阿坚（后端）
-- 日期：2026-10-15
-- 依据：docs/tasks/inbox/ACTIVE-S3-209.md §二（入参 source: 'admin' | 'ai'，AI 发起的取消必须可追溯）
--       ＋ §三.7（source 落库，两次调用各一次，历史/操作日志可见来源）
--
-- 一、为什么必须补这一列（缺口，不是预防性改动）
--   取消销售单要能区分"人工取消"与"AI 底座取消"（同一口径见 S3-204 的 t_product_price_log.source）。
--   实测本机真库 information_schema（s3209_main，同 main 迁移语料建库）：
--     t_sale_bill 现有列含 void_reason（作废原因，init_database.sql:734）与 updated_at，
--     **但没有**来源列 ⇒ 取消来源不可判定（operator_id 只说明是谁，判不出来自 AI 还是后台）。
--   现有列已覆盖本单其余落库需求：
--     void_reason ✓（入参 reason）/ business_status=VOIDED ✓ / collection_status=CLOSED ✓ /
--     updated_at ✓（取消时间）/ t_operation_log ✓（操作人 + 时间 + 前后值 JSON）
--   ⇒ 只补 void_source 一列，不新建表、不加 voided_by / voided_at（避免与操作日志重复记账）。
--
-- 二、为什么幂等（可重复执行，第二遍零错误码）
--   information_schema.COLUMNS 存在性判断 ⇒ 列不存在才 ALTER，已存在走「跳过」分支
--   （照 081 / 194 / 196 / 200 的 PREPARE/EXECUTE 写法）。
--   本文件有两条执行路径，都会跑它，故幂等不是可选项：
--     1) 后端启动 backend/src/shared/migration.ts 第 8 步（遍历 docs/migrations/*.sql 逐条执行）
--     2) CI migration-check 门禁（空库真跑 docs/migrations）
--
-- 三、列定义口径
--   void_source VARCHAR(16) NOT NULL DEFAULT 'admin' COMMENT '取消来源：admin=工作台/移动端人工取消，ai=AI 底座取消'
--   · DEFAULT 'admin' ⇒ 存量行（迁移前写入）与"未显式传 source"的调用方语义不变，**不回填、不改历史行**；
--   · 长度 16 足够容纳 'admin'/'ai'，留余量以免将来新增来源要改列；
--   · AFTER void_reason：与"作废元信息"同区聚簇（void_reason 之后）；
--   · 零 DML：本文件只有 SET / PREPARE / EXECUTE / DEALLOCATE / SELECT，无任何数据写语句，
--     在 MIG-4 写闸门 block 下也能整篇执行。
--
-- 四、回滚
--   ALTER TABLE t_sale_bill DROP COLUMN void_source
-- ============================================

SET @s3209_added = 0;

SET @s3209_col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sale_bill' AND COLUMN_NAME = 'void_source');
SET @s3209_sql = IF(@s3209_col = 0,
  'ALTER TABLE t_sale_bill ADD COLUMN void_source VARCHAR(16) NOT NULL DEFAULT ''admin'' COMMENT ''取消来源：admin=工作台/移动端人工取消，ai=AI 底座取消'' AFTER void_reason',
  'SELECT ''void_source 已存在，跳过'' AS result');
PREPARE s3209_stmt FROM @s3209_sql;
EXECUTE s3209_stmt;
DEALLOCATE PREPARE s3209_stmt;
SET @s3209_added = @s3209_added + IF(@s3209_col = 0, 1, 0);

-- 跑后核对：列是否就位 + 存量行是否全部落回 DEFAULT（不回填）
SELECT CONCAT('202 t_sale_bill.void_source：本次新增 ', @s3209_added, ' 列，当前 ',
  (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sale_bill' AND COLUMN_NAME = 'void_source'),
  ' / 1 列；存量行 void_source=admin 计数 ',
  (SELECT COUNT(*) FROM t_sale_bill WHERE void_source = 'admin'),
  IF(@s3209_added = 0, '（列已存在，跳过）', '')) AS result;
