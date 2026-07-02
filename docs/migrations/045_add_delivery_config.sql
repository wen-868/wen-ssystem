-- 来源: phase10_instant_retail.sql
CREATE TABLE IF NOT EXISTS delivery_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_name VARCHAR(64) NOT NULL COMMENT '配置名称',
  delivery_type VARCHAR(16) NOT NULL COMMENT '配送类型（SELF/PLATFORM/THIRD_PARTY）',
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '配送费',
  free_delivery_amount DECIMAL(10,2) COMMENT '免配送费金额',
  delivery_radius INT COMMENT '配送半径（公里）',
  estimated_time VARCHAR(50) COMMENT '预计配送时间',
  contact_phone VARCHAR(20) COMMENT '联系电话',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配送配置表';