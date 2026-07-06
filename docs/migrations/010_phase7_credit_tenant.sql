-- ============================================
-- Phase 7: 信用额度表添加 tenant_id 支持
-- 涉及表：customer_credit, credit_operation_log, collection_record
-- ============================================

USE liquor_inventory;

-- 1. customer_credit 表添加 tenant_id
ALTER TABLE customer_credit
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER version;

ALTER TABLE customer_credit
ADD INDEX idx_customer_credit_tenant (tenant_id);

-- 2. credit_operation_log 表添加 tenant_id
ALTER TABLE credit_operation_log
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER remark;

ALTER TABLE credit_operation_log
ADD INDEX idx_credit_operation_log_tenant (tenant_id);

-- 3. collection_record 表添加 tenant_id
ALTER TABLE collection_record
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER created_at;

ALTER TABLE collection_record
ADD INDEX idx_collection_record_tenant (tenant_id);
