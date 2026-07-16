-- 编号: 094, 描述: 调拨订单表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_transfer_order (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  transfer_no VARCHAR(32) NOT NULL COMMENT '调拨编号',
  from_store_id BIGINT NOT NULL COMMENT '调出门店ID',
  to_store_id BIGINT NOT NULL COMMENT '调入门店ID',
  transfer_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/SHIPPED/RECEIVED',
  goods_amount DECIMAL(12,2) DEFAULT 0 COMMENT '调拨金额',
  operator_id BIGINT DEFAULT NULL COMMENT '操作人ID',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_transfer_no (transfer_no, tenant_id),
  INDEX idx_from_store (from_store_id),
  INDEX idx_to_store (to_store_id),
  INDEX idx_status (transfer_status),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='调拨单';

-- 调拨单明细
CREATE TABLE IF NOT EXISTS t_transfer_order_item (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  transfer_no VARCHAR(32) NOT NULL COMMENT '调拨编号',
  sku_id BIGINT NOT NULL COMMENT 'SKU ID',
  box_qty INT DEFAULT 0 COMMENT '箱数',
  bottle_qty INT DEFAULT 0 COMMENT '瓶数',
  total_bottle_qty INT NOT NULL DEFAULT 0 COMMENT '总瓶数',
  unit_price DECIMAL(12,2) DEFAULT 0 COMMENT '单价',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  INDEX idx_transfer_no (transfer_no),
  INDEX idx_sku (sku_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='调拨单明细';