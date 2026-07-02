-- 营销标签字段（Phase 3）
-- 日期：2026-06-29
-- 依赖：需先执行 add_tenant_id.sql 中的 add_column_if_not_exists 存储过程
-- MySQL 8.0 兼容版本

CALL add_column_if_not_exists('product_spu', 'marketing_tags', "JSON DEFAULT NULL COMMENT '营销标签：[\"NEW\",\"HOT\",\"RECOMMEND\",\"LIMITED\",\"CLEARANCE\"]'");