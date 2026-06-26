-- tenant_id 数据隔离迁移脚本 (MySQL 兼容版)
-- 执行时间：2026-06-23
-- 负责人：阿坚
-- 说明：MySQL 不支持 ALTER TABLE ... ADD COLUMN IF NOT EXISTS / ADD INDEX IF NOT EXISTS
--      本脚本通过存储过程实现条件添加字段和索引

USE liquor_inventory;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_not_exists$$
DROP PROCEDURE IF EXISTS add_index_if_not_exists$$

CREATE PROCEDURE add_column_if_not_exists(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_column_def TEXT
)
BEGIN
    DECLARE col_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO col_exists
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_column_name;

    IF col_exists = 0 THEN
        SET @sql = CONCAT(
            'ALTER TABLE ', p_table_name,
            ' ADD COLUMN ', p_column_name, ' ', p_column_def
        );
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

CREATE PROCEDURE add_index_if_not_exists(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64),
    IN p_index_columns TEXT
)
BEGIN
    DECLARE idx_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO idx_exists
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name;

    IF idx_exists = 0 THEN
        SET @sql = CONCAT(
            'ALTER TABLE ', p_table_name,
            ' ADD INDEX ', p_index_name, ' (', p_index_columns, ')'
        );
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

-- ============================================================
-- 第1步：新建 tenant 表
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant (
  id VARCHAR(36) PRIMARY KEY COMMENT '租户ID（UUID）',
  name VARCHAR(100) NOT NULL COMMENT '租户名称（公司名）',
  contact_name VARCHAR(50) COMMENT '联系人',
  contact_phone VARCHAR(20) COMMENT '联系电话',
  plan VARCHAR(20) DEFAULT 'basic' COMMENT '套餐：basic/professional/enterprise',
  status TINYINT DEFAULT 1 COMMENT '1=正常 0=停用',
  expire_at DATETIME COMMENT '到期时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_status (status),
  INDEX idx_tenant_expire (expire_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户表';

INSERT INTO tenant (id, name, contact_name, contact_phone, plan, status)
VALUES ('default', '默认租户', '系统管理员', '13800138000', 'basic', 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ============================================================
-- 第2步：为所有表添加 tenant_id 字段
-- ============================================================

CALL add_column_if_not_exists('sys_config', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('sys_user', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('sys_role', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('sys_permission', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('sys_user_role', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('sys_role_permission', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('store', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('product_category', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('product_spu', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('product_sku', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('product_price', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('sku_price', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('supplier', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('supplier_contact', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('member', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('customer_price_binding', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('customer_credit', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('inventory_balance', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('inventory_batch', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('inventory_ledger', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('price_level', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('price_change_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('alert_rule', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('alert_record', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('expiry_alert_config', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('expiry_alert_record', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('trace_config', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('trace_code', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('trace_event_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('trace_scan_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('recall_record', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('store_control_config', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('store_status_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('sale_bill', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('sale_bill_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('sale_return', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('sale_return_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('sale_payment', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('purchase_order', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('purchase_order_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('purchase_in_stock', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('purchase_in_stock_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('purchase_return', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('purchase_return_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('purchase_payment', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('supplier_statement', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('supplier_statement_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('customer_statement', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('customer_payment', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('receivable_account', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('payment_order', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('refund_order', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('hold_order', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('miniapp_order', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('miniapp_order_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('collection_link', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('collection_view_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('collection_record', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('credit_operation_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('notification', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('operation_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('product_price_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('approval_rule', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('approval_instance', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('approval_task', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('approval_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('approval_approver', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('approval_notification', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

CALL add_column_if_not_exists('daily_settlement', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

-- ============================================================
-- 第3步：为所有表添加 tenant_id 索引
-- ============================================================

CALL add_index_if_not_exists('sys_config', 'idx_sys_config_tenant', 'tenant_id');
CALL add_index_if_not_exists('sys_user', 'idx_sys_user_tenant', 'tenant_id');
CALL add_index_if_not_exists('sys_role', 'idx_sys_role_tenant', 'tenant_id');
CALL add_index_if_not_exists('sys_permission', 'idx_sys_permission_tenant', 'tenant_id');
CALL add_index_if_not_exists('sys_user_role', 'idx_sys_user_role_tenant', 'tenant_id');
CALL add_index_if_not_exists('sys_role_permission', 'idx_sys_role_permission_tenant', 'tenant_id');
CALL add_index_if_not_exists('store', 'idx_store_tenant', 'tenant_id');
CALL add_index_if_not_exists('product_category', 'idx_product_category_tenant', 'tenant_id');
CALL add_index_if_not_exists('product_spu', 'idx_product_spu_tenant', 'tenant_id');
CALL add_index_if_not_exists('product_sku', 'idx_product_sku_tenant', 'tenant_id');
CALL add_index_if_not_exists('product_price', 'idx_product_price_tenant', 'tenant_id');
CALL add_index_if_not_exists('sku_price', 'idx_sku_price_tenant', 'tenant_id');
CALL add_index_if_not_exists('supplier', 'idx_supplier_tenant', 'tenant_id');
CALL add_index_if_not_exists('supplier_contact', 'idx_supplier_contact_tenant', 'tenant_id');
CALL add_index_if_not_exists('member', 'idx_member_tenant', 'tenant_id');
CALL add_index_if_not_exists('customer_price_binding', 'idx_customer_price_binding_tenant', 'tenant_id');
CALL add_index_if_not_exists('customer_credit', 'idx_customer_credit_tenant', 'tenant_id');
CALL add_index_if_not_exists('inventory_balance', 'idx_inventory_balance_tenant', 'tenant_id');
CALL add_index_if_not_exists('inventory_batch', 'idx_inventory_batch_tenant', 'tenant_id');
CALL add_index_if_not_exists('inventory_ledger', 'idx_inventory_ledger_tenant', 'tenant_id');
CALL add_index_if_not_exists('price_level', 'idx_price_level_tenant', 'tenant_id');
CALL add_index_if_not_exists('price_change_log', 'idx_price_change_log_tenant', 'tenant_id');
CALL add_index_if_not_exists('alert_rule', 'idx_alert_rule_tenant', 'tenant_id');
CALL add_index_if_not_exists('alert_record', 'idx_alert_record_tenant', 'tenant_id');
CALL add_index_if_not_exists('expiry_alert_config', 'idx_expiry_alert_config_tenant', 'tenant_id');
CALL add_index_if_not_exists('expiry_alert_record', 'idx_expiry_alert_record_tenant', 'tenant_id');
CALL add_index_if_not_exists('trace_config', 'idx_trace_config_tenant', 'tenant_id');
CALL add_index_if_not_exists('trace_code', 'idx_trace_code_tenant', 'tenant_id');
CALL add_index_if_not_exists('trace_event_log', 'idx_trace_event_log_tenant', 'tenant_id');
CALL add_index_if_not_exists('trace_scan_log', 'idx_trace_scan_log_tenant', 'tenant_id');
CALL add_index_if_not_exists('recall_record', 'idx_recall_record_tenant', 'tenant_id');
CALL add_index_if_not_exists('store_control_config', 'idx_store_control_config_tenant', 'tenant_id');
CALL add_index_if_not_exists('store_status_log', 'idx_store_status_log_tenant', 'tenant_id');
CALL add_index_if_not_exists('sale_bill', 'idx_sale_bill_tenant', 'tenant_id');
CALL add_index_if_not_exists('sale_bill_item', 'idx_sale_bill_item_tenant', 'tenant_id');
CALL add_index_if_not_exists('sale_return', 'idx_sale_return_tenant', 'tenant_id');
CALL add_index_if_not_exists('sale_return_item', 'idx_sale_return_item_tenant', 'tenant_id');
CALL add_index_if_not_exists('sale_payment', 'idx_sale_payment_tenant', 'tenant_id');
CALL add_index_if_not_exists('purchase_order', 'idx_purchase_order_tenant', 'tenant_id');
CALL add_index_if_not_exists('purchase_order_item', 'idx_purchase_order_item_tenant', 'tenant_id');
CALL add_index_if_not_exists('purchase_in_stock', 'idx_purchase_in_stock_tenant', 'tenant_id');
CALL add_index_if_not_exists('purchase_in_stock_item', 'idx_purchase_in_stock_item_tenant', 'tenant_id');
CALL add_index_if_not_exists('purchase_return', 'idx_purchase_return_tenant', 'tenant_id');
CALL add_index_if_not_exists('purchase_return_item', 'idx_purchase_return_item_tenant', 'tenant_id');
CALL add_index_if_not_exists('purchase_payment', 'idx_purchase_payment_tenant', 'tenant_id');
CALL add_index_if_not_exists('supplier_statement', 'idx_supplier_statement_tenant', 'tenant_id');
CALL add_index_if_not_exists('supplier_statement_item', 'idx_supplier_statement_item_tenant', 'tenant_id');
CALL add_index_if_not_exists('customer_statement', 'idx_customer_statement_tenant', 'tenant_id');
CALL add_index_if_not_exists('customer_payment', 'idx_customer_payment_tenant', 'tenant_id');
CALL add_index_if_not_exists('receivable_account', 'idx_receivable_account_tenant', 'tenant_id');
CALL add_index_if_not_exists('payment_order', 'idx_payment_order_tenant', 'tenant_id');
CALL add_index_if_not_exists('refund_order', 'idx_refund_order_tenant', 'tenant_id');
CALL add_index_if_not_exists('hold_order', 'idx_hold_order_tenant', 'tenant_id');
CALL add_index_if_not_exists('miniapp_order', 'idx_miniapp_order_tenant', 'tenant_id');
CALL add_index_if_not_exists('miniapp_order_item', 'idx_miniapp_order_item_tenant', 'tenant_id');
CALL add_index_if_not_exists('collection_link', 'idx_collection_link_tenant', 'tenant_id');
CALL add_index_if_not_exists('collection_view_log', 'idx_collection_view_log_tenant', 'tenant_id');
CALL add_index_if_not_exists('collection_record', 'idx_collection_record_tenant', 'tenant_id');
CALL add_index_if_not_exists('credit_operation_log', 'idx_credit_operation_log_tenant', 'tenant_id');
CALL add_index_if_not_exists('notification', 'idx_notification_tenant', 'tenant_id');
CALL add_index_if_not_exists('operation_log', 'idx_operation_log_tenant', 'tenant_id');
CALL add_index_if_not_exists('product_price_log', 'idx_product_price_log_tenant', 'tenant_id');
CALL add_index_if_not_exists('approval_rule', 'idx_approval_rule_tenant', 'tenant_id');
CALL add_index_if_not_exists('approval_instance', 'idx_approval_instance_tenant', 'tenant_id');
CALL add_index_if_not_exists('approval_task', 'idx_approval_task_tenant', 'tenant_id');
CALL add_index_if_not_exists('approval_log', 'idx_approval_log_tenant', 'tenant_id');
CALL add_index_if_not_exists('approval_approver', 'idx_approval_approver_tenant', 'tenant_id');
CALL add_index_if_not_exists('approval_notification', 'idx_approval_notification_tenant', 'tenant_id');
CALL add_index_if_not_exists('daily_settlement', 'idx_daily_settlement_tenant', 'tenant_id');

-- ============================================================
-- 第4步：更新 sys_user 表的租户关系（默认租户）
-- ============================================================
UPDATE sys_user SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = '';

-- ============================================================
-- 第5步：更新 store 表的租户关系（默认租户）
-- ============================================================
UPDATE store SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = '';

-- ============================================================
-- 清理临时存储过程
-- ============================================================
DROP PROCEDURE IF EXISTS add_column_if_not_exists;
DROP PROCEDURE IF EXISTS add_index_if_not_exists;

SELECT 'tenant_id 数据隔离迁移脚本执行完成' AS result;
