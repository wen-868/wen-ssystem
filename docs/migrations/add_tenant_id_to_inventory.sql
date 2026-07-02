-- 核心库存表补 tenant_id 列
-- 依赖：需先执行 add_tenant_id.sql 中的 add_column_if_not_exists / add_index_if_not_exists 存储过程
-- MySQL 8.0 兼容版本

CALL add_column_if_not_exists('inventory_balance', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('inventory_batch', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('inventory_ledger', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");

-- 为 tenant_id 添加索引
CALL add_index_if_not_exists('inventory_balance', 'idx_tenant_ib', '(tenant_id)');
CALL add_index_if_not_exists('inventory_batch', 'idx_tenant_ibat', '(tenant_id)');
CALL add_index_if_not_exists('inventory_ledger', 'idx_tenant_il', '(tenant_id)');

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
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_lg_no (lg_no, tenant_id),
  INDEX idx_store (store_id),
  INDEX idx_sku (sku_id),
  INDEX idx_type (type),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存损益';