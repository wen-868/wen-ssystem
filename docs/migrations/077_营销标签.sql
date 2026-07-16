-- 编号: 077, 描述: 营销标签, 创建人: 阿坚, 日期: 2026-07-05
-- 日期：2026-06-29
-- 不使用 ADD COLUMN IF NOT EXISTS，由迁移引擎容错处理

ALTER TABLE t_product_spu ADD COLUMN marketing_tags JSON DEFAULT NULL COMMENT '营销标签：["NEW","HOT","RECOMMEND","LIMITED","CLEARANCE"]';