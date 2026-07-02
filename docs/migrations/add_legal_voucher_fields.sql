-- ============================================================
-- 迁移：销售单据分享法律凭证完整性增强
-- 日期：2026-07-02
-- 说明：
--   1. sale_bill_item 增加 unit/barcode/spec 快照字段
--   2. sale_bill 增加 store_name/store_address/store_contact 法律凭证字段
--   3. collection_link 增加 display_config/document_title 自定义显示配置
-- 依赖：需先执行 add_tenant_id.sql 中的 add_column_if_not_exists 存储过程
-- MySQL 8.0 兼容版本
-- ============================================================

CALL add_column_if_not_exists('sale_bill_item', 'unit', "VARCHAR(16) NOT NULL DEFAULT '瓶' COMMENT '单位快照（瓶/箱）'");
CALL add_column_if_not_exists('sale_bill_item', 'barcode', "VARCHAR(128) DEFAULT NULL COMMENT '条形码快照'");
CALL add_column_if_not_exists('sale_bill_item', 'spec', "VARCHAR(128) DEFAULT NULL COMMENT '规格描述快照（如：500ml/瓶）'");

CALL add_column_if_not_exists('sale_bill', 'store_name', "VARCHAR(128) DEFAULT NULL COMMENT '门店名称快照'");
CALL add_column_if_not_exists('sale_bill', 'store_address', "VARCHAR(255) DEFAULT NULL COMMENT '门店地址快照'");
CALL add_column_if_not_exists('sale_bill', 'store_contact', "VARCHAR(64) DEFAULT NULL COMMENT '门店联系方式快照'");

CALL add_column_if_not_exists('collection_link', 'display_config', "JSON DEFAULT NULL COMMENT '显示字段配置'");
CALL add_column_if_not_exists('collection_link', 'document_title', "VARCHAR(128) DEFAULT '销售单' COMMENT '单据标题'");