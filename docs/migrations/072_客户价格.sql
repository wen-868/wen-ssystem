-- 编号: 072, 描述: 客户价格, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_customer_price (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  sku_id BIGINT NOT NULL COMMENT 'SKU ID',
  custom_price DECIMAL(12,2) NOT NULL COMMENT '客户专属价格',
  effective_start DATE DEFAULT NULL COMMENT '生效开始日期',
  effective_end DATE DEFAULT NULL COMMENT '生效结束日期',
  status TINYINT DEFAULT 1 COMMENT '状态 1=启用 0=停用',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_customer_sku (customer_id, sku_id, tenant_id),
  INDEX idx_customer (customer_id),
  INDEX idx_sku (sku_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户专属价格';