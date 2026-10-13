-- 编号: 010, 描述: 赊销租户配置, 创建人: 阿坚, 日期: 2026-07-06
-- S3-197（原收口第 60 项②，同族补充）：本文件 3 条 `ADD INDEX idx_<表名去 t_ 前缀>_tenant (tenant_id)`
--   与 `migration.ts` 第2步为 TENANT_TABLES 统一建的 `idx_<表名>_tenant`（例：t_customer_credit
--   ⇒ idx_t_customer_credit_tenant）**同表同列、仅命名不同** ⇒ 空库上净多建 3 个重复索引。
--   统一到既有规范命名后，这 3 条在库内规范索引已存在时按 ER_DUP_KEYNAME 跳过（净效果＝只少重复项）。
--   列定义与顺序一字未改；索引名与下方注释同步更新。

-- ============================================
-- Phase 7: 信用额度表添加 tenant_id 支持
-- 涉及表：customer_credit, credit_operation_log, collection_record
-- S3-197：索引名已统一为规范命名 idx_t_<表名>_tenant（原为 idx_<表名去 t_>_tenant）
-- ============================================

USE liquor_inventory;

-- 1. customer_credit 表添加 tenant_id
ALTER TABLE t_customer_credit
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER version;

ALTER TABLE t_customer_credit
ADD INDEX idx_t_customer_credit_tenant (tenant_id);

-- 2. credit_operation_log 表添加 tenant_id
ALTER TABLE t_credit_operation_log
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER remark;

ALTER TABLE t_credit_operation_log
ADD INDEX idx_t_credit_operation_log_tenant (tenant_id);

-- 3. collection_record 表添加 tenant_id
ALTER TABLE t_collection_record
ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER created_at;

ALTER TABLE t_collection_record
ADD INDEX idx_t_collection_record_tenant (tenant_id);
