-- 核心库存表补 tenant_id 列
-- 注意：不使用 ADD COLUMN IF NOT EXISTS，由迁移引擎容错处理
ALTER TABLE inventory_balance ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT '' AFTER id;
ALTER TABLE inventory_batch ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT '' AFTER id;
ALTER TABLE inventory_ledger ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT '' AFTER id;

-- 为 tenant_id 添加索引
CREATE INDEX idx_tenant_ib ON inventory_balance(tenant_id);
CREATE INDEX idx_tenant_ibat ON inventory_batch(tenant_id);
CREATE INDEX idx_tenant_il ON inventory_ledger(tenant_id);

-- 损益表
CREATE TABLE IF NOT EXISTS inventory_loss_gain (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  lg_no VARCHAR(32) NOT NULL COMMENT '损益编号',
  store_id BIGINT NOT NULL COMMENT '门店ID',
  type VARCHAR(10) NOT NULL COMMENT '类型: LOSS/GAIN',
  sku_id BIGINT NOT NULL COMMENT 'SKU ID',
  qty INT NOT NULL COMMENT '数量',
  cost_price DECIMAL(12,2) DEFAULT 0 COMMENT '成本价',
  amount DECIMAL(12,2) DEFAULT 0 COMMENT '损益金额',
  reason VARCHAR(200) DEFAULT NULL COMMENT '原因',
  operator_id BIGINT DEFAULT NULL COMMENT '操作人ID',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/CONFIRMED',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_lg_no (lg_no, tenant_id),
  INDEX idx_store (store_id),
  INDEX idx_sku (sku_id),
  INDEX idx_type (type),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存损益';