-- tenant_id 数据隔离迁移脚本
-- 执行时间：2026-06-23
-- 负责人：阿坚

USE liquor_inventory;

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

-- 插入默认租户（用于兼容现有数据）
INSERT INTO tenant (id, name, contact_name, contact_phone, plan, status)
VALUES ('default', '默认租户', '系统管理员', '13800138000', 'basic', 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ============================================================
-- 第2步：为所有表添加 tenant_id 字段
-- ============================================================

-- 系统配置表
ALTER TABLE IF EXISTS sys_config ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS sys_user ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS sys_role ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS sys_permission ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS sys_user_role ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS sys_role_permission ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 门店相关
ALTER TABLE IF EXISTS store ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 商品相关
ALTER TABLE IF EXISTS product_category ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS product_spu ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS product_sku ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS product_price ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS sku_price ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 供应商相关
ALTER TABLE IF EXISTS supplier ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS supplier_contact ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 客户相关
ALTER TABLE IF EXISTS member ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS customer_price_binding ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS customer_credit ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 库存相关
ALTER TABLE IF EXISTS inventory_balance ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS inventory_batch ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS inventory_ledger ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 价格相关
ALTER TABLE IF EXISTS price_level ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS price_change_log ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 预警相关
ALTER TABLE IF EXISTS alert_rule ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS alert_record ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS expiry_alert_config ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS expiry_alert_record ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 溯源相关
ALTER TABLE IF EXISTS trace_config ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS trace_code ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS trace_event_log ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS trace_scan_log ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS recall_record ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 门店控制相关
ALTER TABLE IF EXISTS store_control_config ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS store_status_log ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 销售相关
ALTER TABLE IF EXISTS sale_bill ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS sale_bill_item ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS sale_return ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS sale_return_item ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS sale_payment ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 采购相关
ALTER TABLE IF EXISTS purchase_order ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS purchase_order_item ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS purchase_in_stock ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS purchase_in_stock_item ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS purchase_return ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS purchase_return_item ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS purchase_payment ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 结算对账相关
ALTER TABLE IF EXISTS supplier_statement ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS supplier_statement_item ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS customer_statement ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS customer_payment ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS receivable_account ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 支付相关
ALTER TABLE IF EXISTS payment_order ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS refund_order ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS hold_order ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 小程序相关
ALTER TABLE IF EXISTS miniapp_order ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS miniapp_order_item ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 分享收款相关
ALTER TABLE IF EXISTS collection_link ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS collection_view_log ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS collection_record ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 信用相关
ALTER TABLE IF EXISTS credit_operation_log ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 通知相关
ALTER TABLE IF EXISTS notification ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 日志相关
ALTER TABLE IF EXISTS operation_log ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS product_price_log ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 审批流程相关（新增）
ALTER TABLE IF EXISTS approval_rule ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS approval_instance ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS approval_task ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS approval_log ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS approval_approver ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE IF EXISTS approval_notification ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- 每日结算
ALTER TABLE IF EXISTS daily_settlement ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;

-- ============================================================
-- 第3步：为所有表添加 tenant_id 索引
-- ============================================================

ALTER TABLE IF EXISTS sys_config ADD INDEX IF NOT EXISTS idx_sys_config_tenant (tenant_id);
ALTER TABLE IF EXISTS sys_user ADD INDEX IF NOT EXISTS idx_sys_user_tenant (tenant_id);
ALTER TABLE IF EXISTS sys_role ADD INDEX IF NOT EXISTS idx_sys_role_tenant (tenant_id);
ALTER TABLE IF EXISTS sys_permission ADD INDEX IF NOT EXISTS idx_sys_permission_tenant (tenant_id);
ALTER TABLE IF EXISTS sys_user_role ADD INDEX IF NOT EXISTS idx_sys_user_role_tenant (tenant_id);
ALTER TABLE IF EXISTS sys_role_permission ADD INDEX IF NOT EXISTS idx_sys_role_permission_tenant (tenant_id);
ALTER TABLE IF EXISTS store ADD INDEX IF NOT EXISTS idx_store_tenant (tenant_id);
ALTER TABLE IF EXISTS product_category ADD INDEX IF NOT EXISTS idx_product_category_tenant (tenant_id);
ALTER TABLE IF EXISTS product_spu ADD INDEX IF NOT EXISTS idx_product_spu_tenant (tenant_id);
ALTER TABLE IF EXISTS product_sku ADD INDEX IF NOT EXISTS idx_product_sku_tenant (tenant_id);
ALTER TABLE IF EXISTS product_price ADD INDEX IF NOT EXISTS idx_product_price_tenant (tenant_id);
ALTER TABLE IF EXISTS sku_price ADD INDEX IF NOT EXISTS idx_sku_price_tenant (tenant_id);
ALTER TABLE IF EXISTS supplier ADD INDEX IF NOT EXISTS idx_supplier_tenant (tenant_id);
ALTER TABLE IF EXISTS supplier_contact ADD INDEX IF NOT EXISTS idx_supplier_contact_tenant (tenant_id);
ALTER TABLE IF EXISTS member ADD INDEX IF NOT EXISTS idx_member_tenant (tenant_id);
ALTER TABLE IF EXISTS customer_price_binding ADD INDEX IF NOT EXISTS idx_customer_price_binding_tenant (tenant_id);
ALTER TABLE IF EXISTS customer_credit ADD INDEX IF NOT EXISTS idx_customer_credit_tenant (tenant_id);
ALTER TABLE IF EXISTS inventory_balance ADD INDEX IF NOT EXISTS idx_inventory_balance_tenant (tenant_id);
ALTER TABLE IF EXISTS inventory_batch ADD INDEX IF NOT EXISTS idx_inventory_batch_tenant (tenant_id);
ALTER TABLE IF EXISTS inventory_ledger ADD INDEX IF NOT EXISTS idx_inventory_ledger_tenant (tenant_id);
ALTER TABLE IF EXISTS price_level ADD INDEX IF NOT EXISTS idx_price_level_tenant (tenant_id);
ALTER TABLE IF EXISTS price_change_log ADD INDEX IF NOT EXISTS idx_price_change_log_tenant (tenant_id);
ALTER TABLE IF EXISTS alert_rule ADD INDEX IF NOT EXISTS idx_alert_rule_tenant (tenant_id);
ALTER TABLE IF EXISTS alert_record ADD INDEX IF NOT EXISTS idx_alert_record_tenant (tenant_id);
ALTER TABLE IF EXISTS expiry_alert_config ADD INDEX IF NOT EXISTS idx_expiry_alert_config_tenant (tenant_id);
ALTER TABLE IF EXISTS expiry_alert_record ADD INDEX IF NOT EXISTS idx_expiry_alert_record_tenant (tenant_id);
ALTER TABLE IF EXISTS trace_config ADD INDEX IF NOT EXISTS idx_trace_config_tenant (tenant_id);
ALTER TABLE IF EXISTS trace_code ADD INDEX IF NOT EXISTS idx_trace_code_tenant (tenant_id);
ALTER TABLE IF EXISTS trace_event_log ADD INDEX IF NOT EXISTS idx_trace_event_log_tenant (tenant_id);
ALTER TABLE IF EXISTS trace_scan_log ADD INDEX IF NOT EXISTS idx_trace_scan_log_tenant (tenant_id);
ALTER TABLE IF EXISTS recall_record ADD INDEX IF NOT EXISTS idx_recall_record_tenant (tenant_id);
ALTER TABLE IF EXISTS store_control_config ADD INDEX IF NOT EXISTS idx_store_control_config_tenant (tenant_id);
ALTER TABLE IF EXISTS store_status_log ADD INDEX IF NOT EXISTS idx_store_status_log_tenant (tenant_id);
ALTER TABLE IF EXISTS sale_bill ADD INDEX IF NOT EXISTS idx_sale_bill_tenant (tenant_id);
ALTER TABLE IF EXISTS sale_bill_item ADD INDEX IF NOT EXISTS idx_sale_bill_item_tenant (tenant_id);
ALTER TABLE IF EXISTS sale_return ADD INDEX IF NOT EXISTS idx_sale_return_tenant (tenant_id);
ALTER TABLE IF EXISTS sale_return_item ADD INDEX IF NOT EXISTS idx_sale_return_item_tenant (tenant_id);
ALTER TABLE IF EXISTS sale_payment ADD INDEX IF NOT EXISTS idx_sale_payment_tenant (tenant_id);
ALTER TABLE IF EXISTS purchase_order ADD INDEX IF NOT EXISTS idx_purchase_order_tenant (tenant_id);
ALTER TABLE IF EXISTS purchase_order_item ADD INDEX IF NOT EXISTS idx_purchase_order_item_tenant (tenant_id);
ALTER TABLE IF EXISTS purchase_in_stock ADD INDEX IF NOT EXISTS idx_purchase_in_stock_tenant (tenant_id);
ALTER TABLE IF EXISTS purchase_in_stock_item ADD INDEX IF NOT EXISTS idx_purchase_in_stock_item_tenant (tenant_id);
ALTER TABLE IF EXISTS purchase_return ADD INDEX IF NOT EXISTS idx_purchase_return_tenant (tenant_id);
ALTER TABLE IF EXISTS purchase_return_item ADD INDEX IF NOT EXISTS idx_purchase_return_item_tenant (tenant_id);
ALTER TABLE IF EXISTS purchase_payment ADD INDEX IF NOT EXISTS idx_purchase_payment_tenant (tenant_id);
ALTER TABLE IF EXISTS supplier_statement ADD INDEX IF NOT EXISTS idx_supplier_statement_tenant (tenant_id);
ALTER TABLE IF EXISTS supplier_statement_item ADD INDEX IF NOT EXISTS idx_supplier_statement_item_tenant (tenant_id);
ALTER TABLE IF EXISTS customer_statement ADD INDEX IF NOT EXISTS idx_customer_statement_tenant (tenant_id);
ALTER TABLE IF EXISTS customer_payment ADD INDEX IF NOT EXISTS idx_customer_payment_tenant (tenant_id);
ALTER TABLE IF EXISTS receivable_account ADD INDEX IF NOT EXISTS idx_receivable_account_tenant (tenant_id);
ALTER TABLE IF EXISTS payment_order ADD INDEX IF NOT EXISTS idx_payment_order_tenant (tenant_id);
ALTER TABLE IF EXISTS refund_order ADD INDEX IF NOT EXISTS idx_refund_order_tenant (tenant_id);
ALTER TABLE IF EXISTS hold_order ADD INDEX IF NOT EXISTS idx_hold_order_tenant (tenant_id);
ALTER TABLE IF EXISTS miniapp_order ADD INDEX IF NOT EXISTS idx_miniapp_order_tenant (tenant_id);
ALTER TABLE IF EXISTS miniapp_order_item ADD INDEX IF NOT EXISTS idx_miniapp_order_item_tenant (tenant_id);
ALTER TABLE IF EXISTS collection_link ADD INDEX IF NOT EXISTS idx_collection_link_tenant (tenant_id);
ALTER TABLE IF EXISTS collection_view_log ADD INDEX IF NOT EXISTS idx_collection_view_log_tenant (tenant_id);
ALTER TABLE IF EXISTS collection_record ADD INDEX IF NOT EXISTS idx_collection_record_tenant (tenant_id);
ALTER TABLE IF EXISTS credit_operation_log ADD INDEX IF NOT EXISTS idx_credit_operation_log_tenant (tenant_id);
ALTER TABLE IF EXISTS notification ADD INDEX IF NOT EXISTS idx_notification_tenant (tenant_id);
ALTER TABLE IF EXISTS operation_log ADD INDEX IF NOT EXISTS idx_operation_log_tenant (tenant_id);
ALTER TABLE IF EXISTS product_price_log ADD INDEX IF NOT EXISTS idx_product_price_log_tenant (tenant_id);
ALTER TABLE IF EXISTS approval_rule ADD INDEX IF NOT EXISTS idx_approval_rule_tenant (tenant_id);
ALTER TABLE IF EXISTS approval_instance ADD INDEX IF NOT EXISTS idx_approval_instance_tenant (tenant_id);
ALTER TABLE IF EXISTS approval_task ADD INDEX IF NOT EXISTS idx_approval_task_tenant (tenant_id);
ALTER TABLE IF EXISTS approval_log ADD INDEX IF NOT EXISTS idx_approval_log_tenant (tenant_id);
ALTER TABLE IF EXISTS approval_approver ADD INDEX IF NOT EXISTS idx_approval_approver_tenant (tenant_id);
ALTER TABLE IF EXISTS approval_notification ADD INDEX IF NOT EXISTS idx_approval_notification_tenant (tenant_id);
ALTER TABLE IF EXISTS daily_settlement ADD INDEX IF NOT EXISTS idx_daily_settlement_tenant (tenant_id);

-- ============================================================
-- 第4步：更新 sys_user 表的租户关系（默认租户）
-- ============================================================
UPDATE sys_user SET tenant_id = 'default';

-- ============================================================
-- 第5步：更新 store 表的租户关系（默认租户）
-- ============================================================
UPDATE store SET tenant_id = 'default';

SELECT 'tenant_id 数据隔离迁移脚本执行完成' AS result;