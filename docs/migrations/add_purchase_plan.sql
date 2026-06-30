-- 采购计划表
CREATE TABLE IF NOT EXISTS purchase_plan (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  plan_no VARCHAR(32) NOT NULL COMMENT '计划编号',
  supplier_id BIGINT NOT NULL COMMENT '供应商ID',
  store_id BIGINT NOT NULL COMMENT '门店ID',
  plan_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/CONFIRMED/CONVERTED',
  goods_amount DECIMAL(12,2) DEFAULT 0 COMMENT '计划采购金额',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_plan_no (plan_no, tenant_id),
  INDEX idx_supplier (supplier_id),
  INDEX idx_status (plan_status),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购计划';

-- 采购计划明细
CREATE TABLE IF NOT EXISTS purchase_plan_item (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  plan_no VARCHAR(32) NOT NULL COMMENT '计划编号',
  sku_id BIGINT NOT NULL COMMENT 'SKU ID',
  suggest_qty INT NOT NULL DEFAULT 0 COMMENT '建议采购量',
  current_stock INT NOT NULL DEFAULT 0 COMMENT '当前库存',
  safety_stock INT NOT NULL DEFAULT 0 COMMENT '安全库存',
  monthly_avg_sales DECIMAL(10,2) DEFAULT 0 COMMENT '月均销量',
  in_transit_qty INT DEFAULT 0 COMMENT '在途采购量',
  reason VARCHAR(200) DEFAULT NULL COMMENT '补货原因',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  INDEX idx_plan_no (plan_no),
  INDEX idx_sku (sku_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购计划明细';