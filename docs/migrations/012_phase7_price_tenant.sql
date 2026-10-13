-- 编号: 012, 描述: 价格租户配置, 创建人: 阿坚, 日期: 2026-07-06
-- S3-197（原收口第 60 项②，同族补充）：本文件 4 条 `ADD INDEX idx_<表名去 t_ 前缀>_tenant (tenant_id)`
--   与 `migration.ts` 第2步为 TENANT_TABLES 统一建的 `idx_<表名>_tenant`（例：t_price_level
--   ⇒ idx_t_price_level_tenant）**同表同列、仅命名不同** ⇒ 空库上净多建 4 个重复索引。
--   统一到既有规范命名后，这 4 条在库内规范索引已存在时按 ER_DUP_KEYNAME 跳过（净效果＝只少重复项）。
--   列定义与顺序一字未改；索引名与下方注释同步更新。

-- ============================================
-- Phase 7: 价格策略表添加 tenant_id 支持
-- 涉及表：price_level, sku_price, customer_price_binding, price_change_log
-- S3-197：索引名已统一为规范命名 idx_t_<表名>_tenant（原为 idx_<表名去 t_>_tenant）
-- ============================================

USE liquor_inventory;

-- 1. price_level 表添加 tenant_id
ALTER TABLE t_price_level
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER status;

ALTER TABLE t_price_level
ADD INDEX idx_t_price_level_tenant (tenant_id);

-- 2. sku_price 表添加 tenant_id
ALTER TABLE t_sku_price
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER status;

ALTER TABLE t_sku_price
ADD INDEX idx_t_sku_price_tenant (tenant_id);

-- 3. customer_price_binding 表添加 tenant_id
ALTER TABLE t_customer_price_binding
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER expire_at;

ALTER TABLE t_customer_price_binding
ADD INDEX idx_t_customer_price_binding_tenant (tenant_id);

-- 4. price_change_log 表添加 tenant_id
ALTER TABLE t_price_change_log
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER changed_by;

ALTER TABLE t_price_change_log
ADD INDEX idx_t_price_change_log_tenant (tenant_id);
