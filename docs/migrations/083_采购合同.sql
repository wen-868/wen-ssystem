-- 编号: 083, 描述: 采购合同, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_purchase_contract (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  contract_no VARCHAR(32) NOT NULL COMMENT '合同编号',
  supplier_id BIGINT NOT NULL COMMENT '供应商ID',
  contract_name VARCHAR(200) NOT NULL COMMENT '合同名称',
  contract_type VARCHAR(20) NOT NULL DEFAULT 'PURCHASE' COMMENT '类型: PURCHASE/FRAMEWORK',
  total_amount DECIMAL(12,2) DEFAULT 0 COMMENT '合同总金额',
  paid_amount DECIMAL(12,2) DEFAULT 0 COMMENT '已付金额',
  sign_date DATE DEFAULT NULL COMMENT '签订日期',
  start_date DATE DEFAULT NULL COMMENT '开始日期',
  end_date DATE DEFAULT NULL COMMENT '结束日期',
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/SIGNED/EXECUTING/COMPLETED/TERMINATED',
  file_url VARCHAR(500) DEFAULT NULL COMMENT '合同文件URL',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_contract_no (contract_no, tenant_id),
  INDEX idx_supplier (supplier_id),
  INDEX idx_status (status),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购合同';