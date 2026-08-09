-- 编号: 126, 描述: 票据管理表（商用化补全，R100）, 创建人: 凌舟, 日期: 2026-08-10
-- 说明: 票据管理页面（发票/收据/支票/汇票）所需存储，幂等可重复执行
CREATE TABLE IF NOT EXISTS t_bill (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '票据ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  bill_no VARCHAR(64) NOT NULL COMMENT '票据号',
  bill_type VARCHAR(16) NOT NULL DEFAULT 'INVOICE' COMMENT '类型：INVOICE/RECEIPT/CHECK/DRAFT',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '金额',
  issue_date DATE DEFAULT NULL COMMENT '出票日期',
  due_date DATE DEFAULT NULL COMMENT '到期日期',
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/VERIFIED/VOID',
  verified_at DATETIME DEFAULT NULL COMMENT '核销时间',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_bill_no (bill_no, tenant_id),
  KEY idx_bill_tenant_status (tenant_id, status),
  KEY idx_bill_tenant_type (tenant_id, bill_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='票据管理表';
