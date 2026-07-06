-- 编号: 003, 描述: 第2阶段数据库建表, 创建人: 阿坚, 日期: 2026-07-06

-- ============================================
-- 智享酒水库存系统 - 第 2 阶段 业务模块扩展
-- 新增：供应商、采购、快速开单、客户往来账
-- ============================================

USE liquor_inventory;

SET FOREIGN_KEY_CHECKS = 0;

-- ========== 供应商管理 ==========

DROP TABLE IF EXISTS supplier;
DROP TABLE IF EXISTS supplier_contact;

CREATE TABLE supplier (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '供应商ID',
  supplier_code VARCHAR(64) NOT NULL COMMENT '供应商编码',
  name VARCHAR(128) NOT NULL COMMENT '供应商名称',
  short_name VARCHAR(64) DEFAULT NULL COMMENT '简称',
  category VARCHAR(32) DEFAULT NULL COMMENT '类别：酒厂/经销商/批发商',
  province VARCHAR(64) DEFAULT NULL COMMENT '省',
  city VARCHAR(64) DEFAULT NULL COMMENT '市',
  district VARCHAR(64) DEFAULT NULL COMMENT '区',
  address VARCHAR(255) DEFAULT NULL COMMENT '详细地址',
  credit_level VARCHAR(16) DEFAULT 'B' COMMENT '信用等级：A/B/C/D',
  settlement_type VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '结算方式：CASH(现结)/MONTHLY(月结)/QUARTERLY(季结)',
  settlement_day INT DEFAULT NULL COMMENT '结算日（月结时：1-31）',
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0.0000 COMMENT '默认税率',
  bank_name VARCHAR(128) DEFAULT NULL COMMENT '开户银行',
  bank_account VARCHAR(64) DEFAULT NULL COMMENT '银行账号',
  bank_account_name VARCHAR(64) DEFAULT NULL COMMENT '开户名',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0停用',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_supplier_code (supplier_code),
  KEY idx_supplier_name (name),
  KEY idx_supplier_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商表';

CREATE TABLE supplier_contact (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '联系人ID',
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  name VARCHAR(64) NOT NULL COMMENT '联系人姓名',
  mobile VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  phone VARCHAR(32) DEFAULT NULL COMMENT '固定电话',
  email VARCHAR(128) DEFAULT NULL COMMENT '邮箱',
  wechat VARCHAR(64) DEFAULT NULL COMMENT '微信号',
  is_primary TINYINT NOT NULL DEFAULT 0 COMMENT '是否主联系人：1是，0否',
  position VARCHAR(64) DEFAULT NULL COMMENT '职位',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_supplier_contact_supplier_id (supplier_id),
  KEY idx_supplier_contact_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商联系人表';

-- ========== 采购管理 ==========

DROP TABLE IF EXISTS purchase_order;
DROP TABLE IF EXISTS purchase_order_item;
DROP TABLE IF EXISTS purchase_in_stock;
DROP TABLE IF EXISTS purchase_in_stock_item;
DROP TABLE IF EXISTS purchase_return;
DROP TABLE IF EXISTS purchase_return_item;
DROP TABLE IF EXISTS purchase_payment;

CREATE TABLE purchase_order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '采购订单ID',
  order_no VARCHAR(64) NOT NULL COMMENT '采购订单号',
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  supplier_name VARCHAR(128) NOT NULL COMMENT '供应商名称快照',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '入库门店ID',
  order_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '订单状态：DRAFT(草稿)/PENDING(待审核)/APPROVED(已审核)/PARTIAL(部分入库)/COMPLETED(已完成)/CANCELLED(已取消)',
  goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
  payable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应付金额',
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已付金额',
  unpaid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '未付金额',
  expected_date DATE DEFAULT NULL COMMENT '预计到货日期',
  actual_date DATE DEFAULT NULL COMMENT '实际到货日期',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '制单人',
  auditor_id BIGINT UNSIGNED DEFAULT NULL COMMENT '审核人',
  audited_at DATETIME DEFAULT NULL COMMENT '审核时间',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_purchase_order_no (order_no),
  KEY idx_purchase_order_supplier (supplier_id),
  KEY idx_purchase_order_status (order_status),
  KEY idx_purchase_order_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单表';

CREATE TABLE purchase_order_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(64) NOT NULL COMMENT '采购订单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称快照',
  barcode VARCHAR(128) DEFAULT NULL COMMENT '条码快照',
  box_qty INT NOT NULL DEFAULT 0 COMMENT '箱数',
  bottle_qty INT NOT NULL DEFAULT 0 COMMENT '瓶数',
  total_bottle_qty INT NOT NULL COMMENT '合计瓶数',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '采购单价（瓶）',
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0.0000 COMMENT '税率',
  subtotal_amount DECIMAL(12,2) NOT NULL COMMENT '小计金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  total_amount DECIMAL(12,2) NOT NULL COMMENT '含税小计',
  in_stocked_qty INT NOT NULL DEFAULT 0 COMMENT '已入库数量',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_purchase_order_item_order_no (order_no),
  KEY idx_purchase_order_item_sku_id (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单明细表';

CREATE TABLE purchase_in_stock (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '采购入库单ID',
  stock_no VARCHAR(64) NOT NULL COMMENT '入库单号',
  order_no VARCHAR(64) DEFAULT NULL COMMENT '关联采购订单号',
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  supplier_name VARCHAR(128) NOT NULL COMMENT '供应商名称快照',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '入库门店ID',
  stock_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING(待审核)/COMPLETED(已完成)/VOIDED(已作废)',
  goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '合计金额',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '入库人',
  auditor_id BIGINT UNSIGNED DEFAULT NULL COMMENT '审核人',
  audited_at DATETIME DEFAULT NULL COMMENT '审核时间',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_purchase_in_stock_no (stock_no),
  KEY idx_purchase_in_stock_order (order_no),
  KEY idx_purchase_in_stock_supplier (supplier_id),
  KEY idx_purchase_in_stock_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购入库单表';

CREATE TABLE purchase_in_stock_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  stock_no VARCHAR(64) NOT NULL COMMENT '入库单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称快照',
  box_qty INT NOT NULL DEFAULT 0 COMMENT '箱数',
  bottle_qty INT NOT NULL DEFAULT 0 COMMENT '瓶数',
  total_bottle_qty INT NOT NULL COMMENT '合计瓶数',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '入库单价（瓶）',
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0.0000 COMMENT '税率',
  subtotal_amount DECIMAL(12,2) NOT NULL COMMENT '小计金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  total_amount DECIMAL(12,2) NOT NULL COMMENT '含税小计',
  batch_no VARCHAR(64) DEFAULT NULL COMMENT '批次号',
  production_date DATE DEFAULT NULL COMMENT '生产日期',
  expiry_date DATE DEFAULT NULL COMMENT '有效期至',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_purchase_in_stock_item_stock_no (stock_no),
  KEY idx_purchase_in_stock_item_sku_id (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购入库单明细表';

CREATE TABLE purchase_return (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '采购退货单ID',
  return_no VARCHAR(64) NOT NULL COMMENT '退货单号',
  order_no VARCHAR(64) DEFAULT NULL COMMENT '关联采购订单号',
  stock_no VARCHAR(64) DEFAULT NULL COMMENT '关联入库单号',
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  supplier_name VARCHAR(128) NOT NULL COMMENT '供应商名称快照',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '退货门店ID',
  return_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING(待审核)/COMPLETED(已完成)/VOIDED(已作废)',
  goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '合计金额',
  refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应退金额',
  refunded_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已退金额',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '退货人',
  auditor_id BIGINT UNSIGNED DEFAULT NULL COMMENT '审核人',
  audited_at DATETIME DEFAULT NULL COMMENT '审核时间',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_purchase_return_no (return_no),
  KEY idx_purchase_return_supplier (supplier_id),
  KEY idx_purchase_return_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购退货单表';

CREATE TABLE purchase_return_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  return_no VARCHAR(64) NOT NULL COMMENT '退货单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称快照',
  box_qty INT NOT NULL DEFAULT 0 COMMENT '箱数',
  bottle_qty INT NOT NULL DEFAULT 0 COMMENT '瓶数',
  total_bottle_qty INT NOT NULL COMMENT '合计瓶数',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '退货单价（瓶）',
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0.0000 COMMENT '税率',
  subtotal_amount DECIMAL(12,2) NOT NULL COMMENT '小计金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  total_amount DECIMAL(12,2) NOT NULL COMMENT '含税小计',
  reason VARCHAR(255) DEFAULT NULL COMMENT '退货原因',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_purchase_return_item_return_no (return_no),
  KEY idx_purchase_return_item_sku_id (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购退货单明细表';

CREATE TABLE purchase_payment (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '采购付款单ID',
  payment_no VARCHAR(64) NOT NULL COMMENT '付款单号',
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  supplier_name VARCHAR(128) NOT NULL COMMENT '供应商名称快照',
  payment_type VARCHAR(32) NOT NULL DEFAULT 'ORDER' COMMENT '付款类型：ORDER(订单付款)/RETURN(退货退款)/ADVANCE(预付款)',
  source_type VARCHAR(32) DEFAULT NULL COMMENT '来源类型：PURCHASE_ORDER/PURCHASE_RETURN',
  source_no VARCHAR(64) DEFAULT NULL COMMENT '来源单号',
  amount DECIMAL(12,2) NOT NULL COMMENT '付款金额',
  payment_method VARCHAR(32) NOT NULL DEFAULT 'BANK' COMMENT '付款方式：BANK(银行转账)/CASH(现金)/WECHAT(微信)/ALIPAY(支付宝)',
  bank_account VARCHAR(64) DEFAULT NULL COMMENT '收款账号',
  bank_account_name VARCHAR(64) DEFAULT NULL COMMENT '收款人',
  bank_name VARCHAR(128) DEFAULT NULL COMMENT '收款银行',
  voucher_no VARCHAR(64) DEFAULT NULL COMMENT '凭证号',
  payment_date DATE NOT NULL COMMENT '付款日期',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '付款人',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING(待审核)/COMPLETED(已完成)/VOIDED(已作废)',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_purchase_payment_no (payment_no),
  KEY idx_purchase_payment_supplier (supplier_id),
  KEY idx_purchase_payment_source (source_type, source_no),
  KEY idx_purchase_payment_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购付款单表';

-- ========== 客户往来账 ==========

DROP TABLE IF EXISTS customer_statement;
DROP TABLE IF EXISTS customer_payment;

CREATE TABLE customer_statement (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '对账单ID',
  statement_no VARCHAR(64) NOT NULL COMMENT '对账单号',
  customer_id BIGINT UNSIGNED NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) NOT NULL COMMENT '客户名称快照',
  customer_mobile VARCHAR(20) DEFAULT NULL COMMENT '客户手机号快照',
  statement_type VARCHAR(32) NOT NULL DEFAULT 'MONTHLY' COMMENT '对账类型：MONTHLY(月结)/QUARTERLY(季结)/CUSTOM(自定义)',
  start_date DATE NOT NULL COMMENT '对账开始日期',
  end_date DATE NOT NULL COMMENT '对账结束日期',
  opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '期初余额',
  total_sales DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '本期销售',
  total_returns DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '本期退货',
  total_payments DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '本期收款',
  closing_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '期末余额',
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT(草稿)/CONFIRMED(已确认)/PAID(已结清)',
  confirmed_at DATETIME DEFAULT NULL COMMENT '确认时间',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '制单人',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_customer_statement_no (statement_no),
  KEY idx_customer_statement_customer (customer_id),
  KEY idx_customer_statement_period (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户对账单表';

CREATE TABLE customer_payment (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '客户收款单ID',
  receipt_no VARCHAR(64) NOT NULL COMMENT '收款单号',
  customer_id BIGINT UNSIGNED NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) NOT NULL COMMENT '客户名称快照',
  amount DECIMAL(12,2) NOT NULL COMMENT '收款金额',
  payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '收款方式：CASH(现金)/BANK(银行转账)/WECHAT(微信)/ALIPAY(支付宝)/COLLECTION(分享收款)',
  source_type VARCHAR(32) DEFAULT NULL COMMENT '来源类型：SALE_BILL/STATEMENT',
  source_no VARCHAR(64) DEFAULT NULL COMMENT '来源单号',
  voucher_no VARCHAR(64) DEFAULT NULL COMMENT '凭证号',
  payment_date DATE NOT NULL COMMENT '收款日期',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '收款人',
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED' COMMENT '状态：COMPLETED(已完成)/VOIDED(已作废)',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_customer_payment_receipt_no (receipt_no),
  KEY idx_customer_payment_customer (customer_id),
  KEY idx_customer_payment_source (source_type, source_no),
  KEY idx_customer_payment_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户收款单表';

-- ========== 快速开单相关扩展 ==========

-- 销售单扩展字段（赊销支持）
ALTER TABLE sale_bill
  ADD COLUMN IF NOT EXISTS sale_type VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '销售类型：CASH(现销)/CREDIT(赊销)' AFTER customer_type,
  ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL COMMENT '应收截止日期（赊销时）' AFTER collection_status,
  ADD COLUMN IF NOT EXISTS statement_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联对账单ID' AFTER due_date;

-- 销售退货单
DROP TABLE IF EXISTS sale_return;
DROP TABLE IF EXISTS sale_return_item;

CREATE TABLE sale_return (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '销售退货单ID',
  return_no VARCHAR(64) NOT NULL COMMENT '退货单号',
  source_bill_no VARCHAR(64) DEFAULT NULL COMMENT '关联销售单号',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  customer_id BIGINT UNSIGNED DEFAULT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) DEFAULT NULL COMMENT '客户名称快照',
  customer_mobile VARCHAR(20) DEFAULT NULL COMMENT '客户手机号快照',
  return_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING(待审核)/COMPLETED(已完成)/VOIDED(已作废)',
  goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
  refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应退金额',
  refunded_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已退金额',
  refund_method VARCHAR(32) DEFAULT NULL COMMENT '退款方式：CASH(现金)/WECHAT(微信原路退回)/BANK(银行转账)',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '退货人',
  auditor_id BIGINT UNSIGNED DEFAULT NULL COMMENT '审核人',
  audited_at DATETIME DEFAULT NULL COMMENT '审核时间',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sale_return_no (return_no),
  KEY idx_sale_return_source_bill (source_bill_no),
  KEY idx_sale_return_customer (customer_id),
  KEY idx_sale_return_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售退货单表';

CREATE TABLE sale_return_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  return_no VARCHAR(64) NOT NULL COMMENT '退货单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称快照',
  box_qty INT NOT NULL DEFAULT 0 COMMENT '箱数',
  bottle_qty INT NOT NULL DEFAULT 0 COMMENT '瓶数',
  total_bottle_qty INT NOT NULL COMMENT '合计瓶数',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '退货单价（瓶）',
  subtotal_amount DECIMAL(12,2) NOT NULL COMMENT '小计',
  reason VARCHAR(255) DEFAULT NULL COMMENT '退货原因',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sale_return_item_return_no (return_no),
  KEY idx_sale_return_item_sku_id (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售退货单明细表';

-- 销售收款单（线下销售收款）
DROP TABLE IF EXISTS sale_payment;

CREATE TABLE sale_payment (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '销售收款单ID',
  receipt_no VARCHAR(64) NOT NULL COMMENT '收款单号',
  source_type VARCHAR(32) NOT NULL COMMENT '来源类型：SALE_BILL/SALE_RETURN/STATEMENT',
  source_no VARCHAR(64) NOT NULL COMMENT '来源单号',
  customer_id BIGINT UNSIGNED DEFAULT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) DEFAULT NULL COMMENT '客户名称快照',
  amount DECIMAL(12,2) NOT NULL COMMENT '收款金额',
  payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '收款方式：CASH(现金)/WECHAT(微信)/ALIPAY(支付宝)/BANK(银行转账)/COLLECTION(分享收款)',
  voucher_no VARCHAR(64) DEFAULT NULL COMMENT '凭证号',
  payment_date DATE NOT NULL COMMENT '收款日期',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '收款人',
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED' COMMENT '状态：COMPLETED(已完成)/VOIDED(已作废)',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sale_payment_receipt_no (receipt_no),
  KEY idx_sale_payment_source (source_type, source_no),
  KEY idx_sale_payment_customer (customer_id),
  KEY idx_sale_payment_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售收款单表';

SET FOREIGN_KEY_CHECKS = 1;
