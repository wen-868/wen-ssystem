-- 编号: 091, 描述: 储值卡, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_store_value_card (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  card_no VARCHAR(32) NOT NULL COMMENT '卡号',
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(100) DEFAULT NULL COMMENT '客户姓名',
  balance DECIMAL(12,2) DEFAULT 0 COMMENT '当前余额',
  total_recharge DECIMAL(12,2) DEFAULT 0 COMMENT '累计充值',
  total_consume DECIMAL(12,2) DEFAULT 0 COMMENT '累计消费',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/FROZEN/CANCELLED',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_card_no (card_no, tenant_id),
  INDEX idx_customer (customer_id),
  INDEX idx_status (status),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='储值卡';

-- 储值卡交易记录
CREATE TABLE IF NOT EXISTS t_store_value_transaction (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  trans_no VARCHAR(32) NOT NULL COMMENT '交易编号',
  card_no VARCHAR(32) NOT NULL COMMENT '卡号',
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  type VARCHAR(20) NOT NULL COMMENT '类型: RECHARGE/CONSUME/REFUND/ADJUST',
  amount DECIMAL(12,2) NOT NULL COMMENT '金额',
  balance_after DECIMAL(12,2) NOT NULL COMMENT '交易后余额',
  pay_method VARCHAR(20) DEFAULT NULL COMMENT '支付方式',
  source_no VARCHAR(32) DEFAULT NULL COMMENT '来源单号',
  remark VARCHAR(200) DEFAULT NULL COMMENT '备注',
  operator_id BIGINT DEFAULT NULL COMMENT '操作人ID',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_card_no (card_no),
  INDEX idx_customer (customer_id),
  INDEX idx_type (type),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='储值卡交易记录';