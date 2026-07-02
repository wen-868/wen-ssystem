-- 销售提成规则表
CREATE TABLE IF NOT EXISTS sales_commission_rule (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL COMMENT '规则名称',
  rule_type VARCHAR(20) NOT NULL COMMENT '规则类型: FIXED_AMOUNT/FIXED_RATE/TIERED',
  config JSON NOT NULL COMMENT '规则配置 JSON',
  effective_start DATE DEFAULT NULL COMMENT '生效开始日期',
  effective_end DATE DEFAULT NULL COMMENT '生效结束日期',
  status TINYINT DEFAULT 1 COMMENT '状态 1=启用 0=停用',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  tenant_id VARCHAR(36) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售提成规则';

-- 销售提成记录表
CREATE TABLE IF NOT EXISTS sales_commission_record (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  record_no VARCHAR(32) NOT NULL COMMENT '记录编号',
  bill_no VARCHAR(32) NOT NULL COMMENT '销售单号',
  staff_id BIGINT NOT NULL COMMENT '员工ID',
  rule_id BIGINT NOT NULL COMMENT '提成规则ID',
  commission_amount DECIMAL(12,2) NOT NULL COMMENT '提成金额',
  base_amount DECIMAL(12,2) NOT NULL COMMENT '计算基数',
  rate DECIMAL(6,4) DEFAULT NULL COMMENT '提成比例',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/SETTLED/CANCELLED',
  settled_at DATETIME DEFAULT NULL COMMENT '结算时间',
  tenant_id VARCHAR(36) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bill_no (bill_no),
  INDEX idx_staff (staff_id),
  INDEX idx_status (status),
  INDEX idx_tenant (tenant_id),
  UNIQUE KEY uk_record_no (record_no, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售提成记录';