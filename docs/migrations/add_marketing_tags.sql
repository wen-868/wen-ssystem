-- 营销标签字段（Phase 3）
-- 日期：2026-06-29
-- 注意：ADD COLUMN IF NOT EXISTS 为 MariaDB 语法，MySQL 8.0 请使用
--       add_tenant_id.sql 中的 add_column_if_not_exists 存储过程替代

ALTER TABLE product_spu
  ADD COLUMN IF NOT EXISTS marketing_tags JSON DEFAULT NULL COMMENT '营销标签：["NEW","HOT","RECOMMEND","LIMITED","CLEARANCE"]';