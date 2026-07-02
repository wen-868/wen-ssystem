-- 盘点单表
CREATE TABLE IF NOT EXISTS stock_check (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  check_no VARCHAR(32) NOT NULL COMMENT '盘点编号',
  store_id BIGINT NOT NULL COMMENT '门店ID',
  check_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/CHECKING/CHECKED/AUDITED',
  total_sku INT DEFAULT 0 COMMENT '盘点SKU总数',
  checked_sku INT DEFAULT 0 COMMENT '已盘点SKU数',
  profit_qty INT DEFAULT 0 COMMENT '盘盈数量',
  loss_qty INT DEFAULT 0 COMMENT '盘亏数量',
  operator_id BIGINT DEFAULT NULL COMMENT '操作人ID',
  auditor_id BIGINT DEFAULT NULL COMMENT '审核人ID',
  audited_at DATETIME DEFAULT NULL COMMENT '审核时间',
  tenant_id VARCHAR(36) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_check_no (check_no, tenant_id),
  INDEX idx_store (store_id),
  INDEX idx_status (check_status),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘点单';

-- 盘点单明细
CREATE TABLE IF NOT EXISTS stock_check_item (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  check_no VARCHAR(32) NOT NULL COMMENT '盘点编号',
  sku_id BIGINT NOT NULL COMMENT 'SKU ID',
  book_qty INT NOT NULL DEFAULT 0 COMMENT '账面数量',
  actual_qty INT DEFAULT NULL COMMENT '实际数量',
  diff_qty INT DEFAULT 0 COMMENT '差异数量',
  diff_reason VARCHAR(200) DEFAULT NULL COMMENT '差异原因',
  cost_price DECIMAL(12,2) DEFAULT 0 COMMENT '成本价',
  tenant_id VARCHAR(36) NOT NULL DEFAULT '',
  INDEX idx_check_no (check_no),
  INDEX idx_sku (sku_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘点单明细';