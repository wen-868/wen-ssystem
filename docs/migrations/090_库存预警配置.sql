-- 编号: 090, 描述: 库存预警配置, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS stock_warning_config (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  store_id BIGINT NOT NULL COMMENT '门店ID',
  sku_id BIGINT NOT NULL COMMENT 'SKU ID',
  min_qty INT NOT NULL DEFAULT 0 COMMENT '最低库存阈值',
  max_qty INT NOT NULL DEFAULT 0 COMMENT '最高库存阈值',
  enabled TINYINT DEFAULT 1 COMMENT '是否启用',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_store_sku (store_id, sku_id, tenant_id),
  INDEX idx_store (store_id),
  INDEX idx_sku (sku_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存预警配置';