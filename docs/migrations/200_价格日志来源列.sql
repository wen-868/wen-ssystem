-- ============================================
-- 迁移编号：200
-- 单号：S3-204（跨线协作：MS 侧数据接口 —— 销售序列 + 价格历史）
-- 描述：t_product_price_log 补 source 列 —— source VARCHAR(16) NOT NULL DEFAULT 'admin'
-- 创建人：阿坚（后端）
-- 日期：2026-10-15
-- 依据：docs/tasks/inbox/ACTIVE-S3-204.md 三（2.1 字段含 source(admin|ai)）
--       ＋ docs/tasks/cards/跨线协作-MS侧数据接口需求-销售序列与价格历史.md 需求 2 ①
--
-- 一、为什么必须补这一列（缺口，不是预防性改动）
--   需求 2 要求改价历史「记录字段含 source（admin=后台改价 / ai=AI 底座改价）」，
--   以便价格走势分析区分「人工调价」与「AI 建议调价」两类来源。
--   实测本机真库 information_schema（s3199_main，同 main 迁移语料建库）：
--     t_product_price_log 现有列 = id, tenant_id, sku_id, operator_id, price_type,
--     old_price, new_price, action_type, change_reason, batch_no, ip, created_at
--   ⇒ **无 source 列**：改价来源不可判定（operator_id 只能反推是谁，判不出来自 AI 还是后台）。
--   现有列已覆盖需求其余字段：
--     sku_id ✓ / price_type=价格等级（COST/RETAIL/WHOLESALE/MINIAPP/STORE）✓ /
--     old_price ✓ / new_price ✓ / created_at=变更时间 ✓ / operator_id=操作人 ✓
--   ⇒ 只补 source 一列，不新建表（避免与业务真源重复）。
--
-- 二、为什么幂等（可重复执行，第二遍零错误码）
--   information_schema.COLUMNS 存在性判断 ⇒ 列不存在才 ALTER，已存在走「跳过」分支
--   （照 081/194/196 的 PREPARE/EXECUTE 写法）。
--   本文件有两条执行路径，都会跑它，故幂等不是可选项：
--     1) 后端启动 backend/src/shared/migration.ts 第 8 步（遍历 docs/migrations/*.sql 逐条执行，
--        且在 app.listen 之前，见 src/server.ts:261/268）
--     2) CI migration-check 门禁（空库真跑 docs/migrations）
--
-- 三、列定义口径
--   source VARCHAR(16) NOT NULL DEFAULT 'admin' COMMENT '价格来源：admin=后台改价(工作台/移动端/批量)，ai=AI 底座改价'
--   · DEFAULT 'admin' ⇒ 存量行（迁移前写入）与未显式传 source 的调用方语义不变，**不回填、不改历史行**；
--   · 长度 16 足够容纳 'admin'/'ai'，留余量以免将来新增来源要改列；
--   · AFTER action_type：与同一批补列（085 的 change_reason/batch_no）同区，保持「变更元信息」聚簇。
--   · 零 DML：本文件只有 SET / PREPARE / EXECUTE / DEALLOCATE / SELECT，无任何数据写语句，
--     在 MIG-4 写闸门 block 下也能整篇执行。
--
-- 四、回滚
--   ALTER TABLE t_product_price_log DROP COLUMN source;
-- ============================================

SET @s3204_added = 0;

SET @s3204_col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_price_log' AND COLUMN_NAME = 'source');
SET @s3204_sql = IF(@s3204_col = 0,
  'ALTER TABLE t_product_price_log ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT ''admin'' COMMENT ''价格来源：admin=后台改价(工作台/移动端/批量)，ai=AI 底座改价'' AFTER action_type',
  'SELECT ''source 已存在，跳过'' AS result');
PREPARE s3204_stmt FROM @s3204_sql;
EXECUTE s3204_stmt;
DEALLOCATE PREPARE s3204_stmt;
SET @s3204_added = @s3204_added + IF(@s3204_col = 0, 1, 0);

-- 跑后核对：列是否就位 + 存量行是否全部落回 DEFAULT（不回填）
SELECT CONCAT('200 t_product_price_log.source：本次新增 ', @s3204_added, ' 列，当前 ',
  (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_price_log' AND COLUMN_NAME = 'source'),
  ' / 1 列；存量行 source=admin 计数 ',
  (SELECT COUNT(*) FROM t_product_price_log WHERE source = 'admin'),
  IF(@s3204_added = 0, '（列已存在，跳过）', '')) AS result;
