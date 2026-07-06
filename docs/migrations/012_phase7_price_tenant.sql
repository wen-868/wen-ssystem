-- 编号: 012, 描述: 价格租户配置, 创建人: 阿坚, 日期: 2026-07-06

-- ============================================
-- Phase 7: 价格策略表添加 tenant_id 支持
-- 涉及表：price_level, sku_price, customer_price_binding, price_change_log
-- ============================================

USE liquor_inventory;

-- 1. price_level 表添加 tenant_id
ALTER TABLE price_level
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER status;

ALTER TABLE price_level
ADD INDEX idx_price_level_tenant (tenant_id);

-- 2. sku_price 表添加 tenant_id
ALTER TABLE sku_price
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER status;

ALTER TABLE sku_price
ADD INDEX idx_sku_price_tenant (tenant_id);

-- 3. customer_price_binding 表添加 tenant_id
ALTER TABLE customer_price_binding
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER expire_at;

ALTER TABLE customer_price_binding
ADD INDEX idx_customer_price_binding_tenant (tenant_id);

-- 4. price_change_log 表添加 tenant_id
ALTER TABLE price_change_log
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER changed_by;

ALTER TABLE price_change_log
ADD INDEX idx_price_change_log_tenant (tenant_id);
