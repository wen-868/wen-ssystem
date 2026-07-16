-- 编号: 034, 描述: 添加租户管理员表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_tenant_admin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL COMMENT '租户ID',
  user_id INT NOT NULL COMMENT '用户ID（关联sys_user）',
  role VARCHAR(32) NOT NULL DEFAULT 'ADMIN' COMMENT '角色（ADMIN/SUPER_ADMIN）',
  is_primary TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否主管理员',
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_tenant_user (tenant_id, user_id),
  INDEX idx_tenant_admin_tenant (tenant_id),
  INDEX idx_tenant_admin_user (user_id),
  
  FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户管理员表';