-- 营销标签字段（Phase 3）
-- 日期：2026-06-29
-- 不使用 ADD COLUMN IF NOT EXISTS，由迁移引擎容错处理

ALTER TABLE product_spu ADD COLUMN marketing_tags JSON DEFAULT NULL COMMENT '营销标签：["NEW","HOT","RECOMMEND","LIMITED","CLEARANCE"]';