-- 编号: 032, 描述: 添加租户模块访问表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS tenant_module_access (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL COMMENT '租户ID',
  module_code VARCHAR(64) NOT NULL COMMENT '模块编码（如：sales/purchase/inventory/marketing）',
  module_name VARCHAR(128) NOT NULL COMMENT '模块名称',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  granted_by VARCHAR(32) NOT NULL DEFAULT 'PLAN' COMMENT '授权方式（PLAN/MANUAL/ADDON）',
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  expire_at DATETIME COMMENT '过期时间（NULL表示永久）',
  remark VARCHAR(255) COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_tenant_module (tenant_id, module_code),
  INDEX idx_tenant_module_tenant (tenant_id),
  INDEX idx_tenant_module_enabled (enabled),
  
  FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户模块访问权限表';