-- S3-199 · 表结构核对查询（只读；在全新 MySQL 8 空库跑完迁移后执行）
-- 口径来源：R101-收口总清单.md 第 64 / 66 项；R101-S3-158-凌舟验收.md 裁定 2

-- ① 第 64 项：t_tenant_admin 的外键（期望 0 行 —— 裁定口径「不建物理外键」）
SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE, DELETE_RULE
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't_tenant_admin';

-- ② 第 64 项：指向 t_tenant.id 的外键全量（用于对照：本表在不在其中）
SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, DELETE_RULE
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 't_tenant'
 ORDER BY TABLE_NAME;

-- ③ 第 64 项：t_tenant_admin 列类型（169 的最终口径：tenant_id VARCHAR(36) / user_id BIGINT UNSIGNED）
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_tenant_admin'
 ORDER BY ORDINAL_POSITION;

-- ④ 第 64 项：孤儿行（tenant_id 无对应 t_tenant.id；如将来要补外键，此项必须为 0）
SELECT COUNT(*) AS orphan_rows
  FROM t_tenant_admin a LEFT JOIN t_tenant t ON t.id = a.tenant_id
 WHERE t.id IS NULL;

-- ⑤ 第 66 项：指向 t_retail_order.id 的外键及其删除规则（期望 2 条，DELETE_RULE 均为 CASCADE）
SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, r.DELETE_RULE
  FROM information_schema.KEY_COLUMN_USAGE k
  JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
 WHERE k.CONSTRAINT_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME = 't_retail_order'
 ORDER BY k.TABLE_NAME;

-- ⑥ 第 66 项：t_retail_order 的软删证据列（证明「作废」不是物理删除）
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_retail_order'
   AND COLUMN_NAME IN ('order_status', 'cancel_reason', 'cancelled_at');

-- ⑦ 留痕：t_tenant_admin 表注释读数（本项仅如实记录，不作判据）
SELECT TABLE_NAME, TABLE_COMMENT
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('t_tenant_admin', 't_retail_order');
