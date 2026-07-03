-- 收款单
CREATE TABLE IF NOT EXISTS receipt (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  receipt_no VARCHAR(32) NOT NULL COMMENT '收款单号',
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(100) DEFAULT NULL COMMENT '客户名称',
  receipt_type VARCHAR(20) NOT NULL DEFAULT 'SALE' COMMENT '类型: SALE/OTHER',
  amount DECIMAL(12,2) NOT NULL COMMENT '收款金额',
  payment_method VARCHAR(20) DEFAULT NULL COMMENT '付款方式',
  bank_account_id BIGINT DEFAULT NULL COMMENT '银行账户ID',
  received_date DATE DEFAULT NULL COMMENT '收款日期',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/CONFIRMED/VOIDED',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  operator_id BIGINT DEFAULT NULL COMMENT '操作人ID',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_receipt_no (receipt_no, tenant_id),
  INDEX idx_customer (customer_id),
  INDEX idx_status (status),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收款单';

-- 收款核销
CREATE TABLE IF NOT EXISTS receipt_writeoff (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  receipt_id BIGINT NOT NULL COMMENT '收款单ID',
  receivable_id BIGINT NOT NULL COMMENT '应收记录ID',
  writeoff_amount DECIMAL(12,2) NOT NULL COMMENT '核销金额',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_receipt (receipt_id),
  INDEX idx_receivable (receivable_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收款核销';

-- 付款单
CREATE TABLE IF NOT EXISTS payment (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  payment_no VARCHAR(32) NOT NULL COMMENT '付款单号',
  supplier_id BIGINT NOT NULL COMMENT '供应商ID',
  supplier_name VARCHAR(100) DEFAULT NULL COMMENT '供应商名称',
  payment_type VARCHAR(20) NOT NULL DEFAULT 'PURCHASE' COMMENT '类型: PURCHASE/EXPENSE/OTHER',
  amount DECIMAL(12,2) NOT NULL COMMENT '付款金额',
  payment_method VARCHAR(20) DEFAULT NULL COMMENT '付款方式',
  bank_account_id BIGINT DEFAULT NULL COMMENT '银行账户ID',
  paid_date DATE DEFAULT NULL COMMENT '付款日期',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/CONFIRMED/VOIDED',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  operator_id BIGINT DEFAULT NULL COMMENT '操作人ID',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_payment_no (payment_no, tenant_id),
  INDEX idx_supplier (supplier_id),
  INDEX idx_status (status),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='付款单';

-- 付款核销
CREATE TABLE IF NOT EXISTS payment_writeoff (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT NOT NULL COMMENT '付款单ID',
  payable_id BIGINT NOT NULL COMMENT '应付记录ID',
  writeoff_amount DECIMAL(12,2) NOT NULL COMMENT '核销金额',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payment (payment_id),
  INDEX idx_payable (payable_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='付款核销';

-- 应收记录
CREATE TABLE IF NOT EXISTS receivable (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(100) DEFAULT NULL COMMENT '客户名称',
  source_type VARCHAR(20) NOT NULL COMMENT '来源类型: SALE_BILL/OTHER',
  source_no VARCHAR(32) NOT NULL COMMENT '来源单号',
  receivable_amount DECIMAL(12,2) NOT NULL COMMENT '应收金额',
  received_amount DECIMAL(12,2) DEFAULT 0 COMMENT '已收金额',
  balance DECIMAL(12,2) DEFAULT 0 COMMENT '余额',
  due_date DATE DEFAULT NULL COMMENT '到期日',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/PARTIAL/PAID',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer (customer_id),
  INDEX idx_source (source_no),
  INDEX idx_status (status),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='应收记录';

-- 应付记录
CREATE TABLE IF NOT EXISTS payable (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  supplier_id BIGINT NOT NULL COMMENT '供应商ID',
  supplier_name VARCHAR(100) DEFAULT NULL COMMENT '供应商名称',
  source_type VARCHAR(20) NOT NULL COMMENT '来源类型: PURCHASE_ORDER/EXPENSE/OTHER',
  source_no VARCHAR(32) NOT NULL COMMENT '来源单号',
  payable_amount DECIMAL(12,2) NOT NULL COMMENT '应付金额',
  paid_amount DECIMAL(12,2) DEFAULT 0 COMMENT '已付金额',
  balance DECIMAL(12,2) DEFAULT 0 COMMENT '余额',
  due_date DATE DEFAULT NULL COMMENT '到期日',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/PARTIAL/PAID',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_supplier (supplier_id),
  INDEX idx_source (source_no),
  INDEX idx_status (status),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='应付记录';