-- ============================================================
-- 迁移：销售单据分享法律凭证完整性增强
-- 日期：2026-07-02
-- 说明：
--   1. sale_bill_item 增加 unit/barcode/spec 快照字段
--   2. sale_bill 增加 store_name/store_address/store_contact 法律凭证字段
--   3. collection_link 增加 display_config/document_title 自定义显示配置
-- 注意：ADD COLUMN IF NOT EXISTS 为 MariaDB 语法，MySQL 8.0 请使用
--       add_tenant_id.sql 中的 add_column_if_not_exists 存储过程替代
-- ============================================================

-- 1. sale_bill_item 增加快照字段
ALTER TABLE sale_bill_item
  ADD COLUMN IF NOT EXISTS unit VARCHAR(16) NOT NULL DEFAULT '瓶' COMMENT '单位快照（瓶/箱）' AFTER price_type,
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(128) DEFAULT NULL COMMENT '条形码快照' AFTER unit,
  ADD COLUMN IF NOT EXISTS spec VARCHAR(128) DEFAULT NULL COMMENT '规格描述快照（如：500ml/瓶）' AFTER barcode;

-- 2. sale_bill 增加门店法律凭证字段
ALTER TABLE sale_bill
  ADD COLUMN IF NOT EXISTS store_name VARCHAR(128) DEFAULT NULL COMMENT '门店名称快照' AFTER store_id,
  ADD COLUMN IF NOT EXISTS store_address VARCHAR(255) DEFAULT NULL COMMENT '门店地址快照' AFTER store_name,
  ADD COLUMN IF NOT EXISTS store_contact VARCHAR(64) DEFAULT NULL COMMENT '门店联系方式快照' AFTER store_address;

-- 3. collection_link 增加自定义显示配置
ALTER TABLE collection_link
  ADD COLUMN IF NOT EXISTS display_config JSON DEFAULT NULL COMMENT '显示字段配置，如{"showBarcode":true,"showUnit":true,"showSpec":true,"showTax":false}' AFTER tax_amount,
  ADD COLUMN IF NOT EXISTS document_title VARCHAR(128) DEFAULT '销售单' COMMENT '单据标题' AFTER display_config;