
-- 智享营销系统 第 2 阶段 数据库建表脚本
-- 适用数据库：MySQL 8.x
-- 覆盖模块：供应商管理、采购订单、销售退货、客户对账/收款、库存预警
-- 依赖：phase1_schema.sql（已建好 sys_user / store / member / product_sku / inventory_balance / inventory_ledger 等表）

USE liquor_inventory;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. 供应商管理 (supplier)
-- ============================================================

DROP TABLE IF EXISTS supplier;
CREATE TABLE supplier (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '供应商ID',
  supplier_code VARCHAR(64) NOT NULL COMMENT '供应商编码，系统自动生成：SUP+YYYYMMDD+4位序号',
  supplier_name VARCHAR(128) NOT NULL COMMENT '供应商名称',
  contact_name VARCHAR(64) DEFAULT NULL COMMENT '联系人',
  contact_phone VARCHAR(32) DEFAULT NULL COMMENT '联系电话',
  address VARCHAR(255) DEFAULT NULL COMMENT '地址',
  tax_no VARCHAR(64) DEFAULT NULL COMMENT '税号',
  bank_name VARCHAR(128) DEFAULT NULL COMMENT '开户银行',
  bank_account VARCHAR(64) DEFAULT NULL COMMENT '银行账号',
  credit_limit DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '信用额度',
  credit_days INT NOT NULL DEFAULT 30 COMMENT '账期（天）',
  settlement_cycle VARCHAR(32) NOT NULL DEFAULT 'MONTHLY' COMMENT '结算周期：WEEKLY/MONTHLY/QUARTERLY',
  supplier_type VARCHAR(32) NOT NULL DEFAULT 'BRAND' COMMENT '供应商类型：BRAND/AGENT/WHOLESALER/OTHER',
  level_code VARCHAR(32) DEFAULT NULL COMMENT '等级：A/B/C',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/INACTIVE/BLACKLIST',
  created_by BIGINT UNSIGNED DEFAULT NULL COMMENT '创建人',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_supplier_code (supplier_code),
  KEY idx_supplier_name (supplier_name),
  KEY idx_supplier_status (status),
  KEY idx_supplier_type (supplier_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商表';

DROP TABLE IF EXISTS supplier_contact;
CREATE TABLE supplier_contact (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  contact_name VARCHAR(64) NOT NULL COMMENT '联系人姓名',
  contact_role VARCHAR(32) DEFAULT NULL COMMENT '角色：SALES/ACCOUNTANT/MANAGER',
  contact_phone VARCHAR(32) DEFAULT NULL,
  contact_email VARCHAR(128) DEFAULT NULL,
  is_primary TINYINT NOT NULL DEFAULT 0 COMMENT '是否主要联系人',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_supplier_contact_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商联系人表';

-- ============================================================
-- 2. 采购订单 (purchase_order)
-- ============================================================

DROP TABLE IF EXISTS purchase_order_item;
DROP TABLE IF EXISTS purchase_order;

CREATE TABLE purchase_order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '采购订单ID',
  order_no VARCHAR(64) NOT NULL COMMENT '采购单号，规则：PO+YYYYMMDD+5位序号',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '收货门店',
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  supplier_code VARCHAR(64) NOT NULL COMMENT '供应商编码快照',
  supplier_name VARCHAR(128) NOT NULL COMMENT '供应商名称快照',
  order_type VARCHAR(32) NOT NULL DEFAULT 'PURCHASE' COMMENT '订单类型：PURCHASE/RETURN/EXCHANGE',
  order_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '订单状态：DRAFT/SUBMITTED/AUDITED/INBOUND_PARTIAL/INBOUND_COMPLETED/CANCELLED',
  pay_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID' COMMENT '付款状态：UNPAID/PARTIAL/PAID',
  goods_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额（含税合计）',
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '税额合计',
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
  payable_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '应付金额',
  paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '已付金额',
  currency VARCHAR(16) NOT NULL DEFAULT 'CNY' COMMENT '币种',
  expect_date DATE DEFAULT NULL COMMENT '预计到货日期',
  inbound_date DATETIME DEFAULT NULL COMMENT '实际入库时间',
  auditor_id BIGINT UNSIGNED DEFAULT NULL COMMENT '审核人',
  audit_time DATETIME DEFAULT NULL COMMENT '审核时间',
  audit_remark VARCHAR(255) DEFAULT NULL COMMENT '审核备注',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '创建人',
  remark VARCHAR(255) DEFAULT NULL,
  internal_remark VARCHAR(255) DEFAULT NULL,
  cancel_reason VARCHAR(255) DEFAULT NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_purchase_order_no (order_no),
  KEY idx_purchase_order_supplier (supplier_id),
  KEY idx_purchase_order_store_status (store_id, order_status),
  KEY idx_purchase_order_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单表';

CREATE TABLE purchase_order_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(64) NOT NULL COMMENT '采购单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_code VARCHAR(64) NOT NULL COMMENT 'SKU编码快照',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称快照',
  purchase_box_qty INT NOT NULL DEFAULT 0 COMMENT '采购箱数',
  purchase_bottle_qty INT NOT NULL DEFAULT 0 COMMENT '采购瓶数',
  box_ratio INT NOT NULL DEFAULT 1 COMMENT '箱瓶比例快照',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '采购单价（按瓶）',
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0.1300 COMMENT '税率',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  subtotal_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '小计 = unit_price * (box_qty*box_ratio + bottle_qty)',
  inbound_box_qty INT NOT NULL DEFAULT 0 COMMENT '已入库箱数',
  inbound_bottle_qty INT NOT NULL DEFAULT 0 COMMENT '已入库瓶数',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_purchase_order_item_order (order_no),
  KEY idx_purchase_order_item_sku (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单明细表';

-- ============================================================
-- 3. 销售退货 (sales_return)
-- ============================================================

DROP TABLE IF EXISTS sales_return_item;
DROP TABLE IF EXISTS sales_return;

CREATE TABLE sales_return (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '退货单ID',
  return_no VARCHAR(64) NOT NULL COMMENT '退货单号，规则：RET+YYYYMMDD+5位序号',
  source_type VARCHAR(32) NOT NULL COMMENT '来源类型：MINIAPP_ORDER/SALE_BILL',
  source_no VARCHAR(64) NOT NULL COMMENT '来源单号',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  customer_id BIGINT UNSIGNED DEFAULT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) DEFAULT NULL,
  customer_mobile VARCHAR(20) DEFAULT NULL,
  return_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT/SUBMITTED/AUDITED/INBOUND/COMPLETED/CANCELLED',
  refund_status VARCHAR(32) NOT NULL DEFAULT 'UNREFUNDED' COMMENT '退款状态：UNREFUNDED/PARTIAL/REFUNDED',
  return_reason VARCHAR(255) DEFAULT NULL COMMENT '退货原因',
  goods_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '退货商品金额',
  refund_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '应退金额',
  actual_refund_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '实退金额',
  stock_rollback_flag TINYINT NOT NULL DEFAULT 0 COMMENT '是否已回滚库存：0否/1是',
  auditor_id BIGINT UNSIGNED DEFAULT NULL,
  audit_time DATETIME DEFAULT NULL,
  audit_remark VARCHAR(255) DEFAULT NULL,
  stock_in_time DATETIME DEFAULT NULL COMMENT '入库时间',
  refund_time DATETIME DEFAULT NULL COMMENT '退款时间',
  operator_id BIGINT UNSIGNED NOT NULL,
  remark VARCHAR(255) DEFAULT NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sales_return_no (return_no),
  KEY idx_sales_return_source (source_type, source_no),
  KEY idx_sales_return_store_status (store_id, return_status),
  KEY idx_sales_return_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售退货单表';

CREATE TABLE sales_return_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  return_no VARCHAR(64) NOT NULL COMMENT '退货单号',
  source_item_id BIGINT UNSIGNED DEFAULT NULL COMMENT '原订单/销售单明细ID',
  sku_id BIGINT UNSIGNED NOT NULL,
  sku_code VARCHAR(64) NOT NULL,
  sku_name VARCHAR(128) NOT NULL,
  return_box_qty INT NOT NULL DEFAULT 0,
  return_bottle_qty INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL COMMENT '退货单价（按瓶）',
  subtotal_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '小计',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sales_return_item_return (return_no),
  KEY idx_sales_return_item_sku (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售退货明细表';

-- ============================================================
-- 4. 客户对账/收款 (customer_statement)
-- ============================================================

DROP TABLE IF EXISTS customer_statement_item;
DROP TABLE IF EXISTS customer_statement_payment;
DROP TABLE IF EXISTS customer_statement;

CREATE TABLE customer_statement (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '对账ID',
  statement_no VARCHAR(64) NOT NULL COMMENT '对账单号：STMT+YYYYMM+客户ID+3位序号',
  customer_id BIGINT UNSIGNED NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) DEFAULT NULL,
  customer_mobile VARCHAR(20) DEFAULT NULL,
  period_start DATE NOT NULL COMMENT '账期开始',
  period_end DATE NOT NULL COMMENT '账期结束',
  statement_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT/CONFIRMED/SETTLED/CANCELLED',
  collection_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID' COMMENT '收款状态：UNPAID/PARTIAL/PAID',
  opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '期初余额（欠款为正）',
  sales_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '本期销售金额',
  return_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '本期退货金额',
  collection_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '本期收款金额',
  closing_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '期末余额',
  due_date DATE DEFAULT NULL COMMENT '到期收款日',
  confirm_time DATETIME DEFAULT NULL,
  confirmed_by BIGINT UNSIGNED DEFAULT NULL,
  operator_id BIGINT UNSIGNED NOT NULL,
  remark VARCHAR(255) DEFAULT NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_customer_statement_no (statement_no),
  KEY idx_customer_statement_customer (customer_id),
  KEY idx_customer_statement_period (period_start, period_end),
  KEY idx_customer_statement_status (statement_status, collection_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户对账单表';

CREATE TABLE customer_statement_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  statement_no VARCHAR(64) NOT NULL,
  item_type VARCHAR(32) NOT NULL COMMENT '明细类型：SALE_BILL/RETURN/COLLECTION/OPENING/ADJUST',
  biz_no VARCHAR(64) NOT NULL COMMENT '关联单号（销售单号/退货单号/收款单号）',
  biz_date DATE NOT NULL COMMENT '业务日期',
  debit_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '借方金额（客户欠款增加）',
  credit_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '贷方金额（客户欠款减少）',
  balance_after DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '该笔后余额',
  remark VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_customer_statement_item_statement (statement_no),
  KEY idx_customer_statement_item_biz (item_type, biz_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户对账明细表';

CREATE TABLE customer_statement_payment (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_no VARCHAR(64) NOT NULL COMMENT '收款单号：CPAY+YYYYMMDD+5位序号',
  statement_no VARCHAR(64) NOT NULL COMMENT '对账单号',
  customer_id BIGINT UNSIGNED NOT NULL,
  pay_amount DECIMAL(14,2) NOT NULL COMMENT '本次收款金额',
  pay_method VARCHAR(32) NOT NULL COMMENT '收款方式：CASH/BANK_TRANSFER/WECHAT/ALIPAY/CHECK',
  pay_date DATE NOT NULL COMMENT '收款日期',
  pay_ref VARCHAR(128) DEFAULT NULL COMMENT '银行交易号/支票号',
  related_bill_no VARCHAR(64) DEFAULT NULL COMMENT '关联销售单号（可选）',
  operator_id BIGINT UNSIGNED NOT NULL,
  remark VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_customer_statement_payment_no (payment_no),
  KEY idx_customer_statement_payment_statement (statement_no),
  KEY idx_customer_statement_payment_customer (customer_id),
  KEY idx_customer_statement_payment_date (pay_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户对账收款记录表';

-- ============================================================
-- 5. 库存预警 (inventory_warning)
-- ============================================================

DROP TABLE IF EXISTS inventory_warning_rule;
DROP TABLE IF EXISTS inventory_warning_event;

CREATE TABLE inventory_warning_rule (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rule_type VARCHAR(32) NOT NULL COMMENT '规则类型：LOW_STOCK/NEGATIVE_STOCK/ABNORMAL_MOVEMENT/EXPIRY',
  scope_type VARCHAR(32) NOT NULL DEFAULT 'ALL' COMMENT '适用范围：ALL/SKU/CATEGORY/STORE',
  scope_value VARCHAR(128) DEFAULT NULL COMMENT '范围值（SKU ID或分类ID）',
  store_id BIGINT UNSIGNED DEFAULT NULL COMMENT '门店，空表示全部门店',
  threshold INT DEFAULT NULL COMMENT '低库存阈值（单位瓶）',
  threshold_days INT DEFAULT NULL COMMENT '临期天数阈值',
  alert_level VARCHAR(32) NOT NULL DEFAULT 'WARNING' COMMENT '预警级别：INFO/WARNING/CRITICAL',
  notify_channels JSON DEFAULT NULL COMMENT '通知渠道：IN_APP/SMS/EMAIL/FEISHU',
  notify_user_ids JSON DEFAULT NULL COMMENT '通知接收人列表',
  enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用',
  operator_id BIGINT UNSIGNED DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_warning_rule_type (rule_type, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存预警规则表';

CREATE TABLE inventory_warning_event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_no VARCHAR(64) NOT NULL COMMENT '事件号：WARN+YYYYMMDDHHMMSS+3位序号',
  rule_id BIGINT UNSIGNED DEFAULT NULL COMMENT '触发规则ID',
  rule_type VARCHAR(32) NOT NULL,
  alert_level VARCHAR(32) NOT NULL,
  store_id BIGINT UNSIGNED DEFAULT NULL,
  sku_id BIGINT UNSIGNED DEFAULT NULL,
  sku_code VARCHAR(64) DEFAULT NULL,
  sku_name VARCHAR(128) DEFAULT NULL,
  current_value INT DEFAULT NULL COMMENT '当前值（如当前库存）',
  threshold_value INT DEFAULT NULL COMMENT '阈值',
  event_title VARCHAR(255) NOT NULL COMMENT '事件标题',
  event_detail TEXT DEFAULT NULL COMMENT '事件详情（JSON）',
  event_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/ACKNOWLEDGED/RESOLVED/IGNORED',
  acknowledged_by BIGINT UNSIGNED DEFAULT NULL COMMENT '确认人',
  acknowledged_at DATETIME DEFAULT NULL COMMENT '确认时间',
  ack_remark VARCHAR(255) DEFAULT NULL,
  resolved_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventory_warning_event_no (event_no),
  KEY idx_inventory_warning_event_store_sku (store_id, sku_id),
  KEY idx_inventory_warning_event_status (event_status, alert_level),
  KEY idx_inventory_warning_event_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存预警事件表';

-- ============================================================
-- 初始数据：默认库存预警规则
-- ============================================================
INSERT INTO inventory_warning_rule (rule_type, scope_type, threshold, threshold_days, alert_level, enabled) VALUES
('LOW_STOCK', 'ALL', 5, NULL, 'WARNING', 1),
('NEGATIVE_STOCK', 'ALL', 0, NULL, 'CRITICAL', 1),
('ABNORMAL_MOVEMENT', 'ALL', NULL, NULL, 'WARNING', 1);

SET FOREIGN_KEY_CHECKS = 1;
