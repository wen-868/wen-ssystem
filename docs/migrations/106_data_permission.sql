-- 编号: 106, 描述: 数据权限配置表及角色数据权限关联表, 创建人: 阿坚, 日期: 2026-07-13
-- 用于实现数据权限控制，支持按部门/门店/客户维度的数据隔离

-- 数据权限配置表
CREATE TABLE IF NOT EXISTS t_data_permission (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  permission_name VARCHAR(128) NOT NULL COMMENT '权限名称',
  permission_code VARCHAR(64) NOT NULL COMMENT '权限编码（如 STORE_DATA/DEPARTMENT_DATA）',
  permission_type VARCHAR(32) NOT NULL COMMENT '权限类型：DEPARTMENT(按部门)/STORE(按门店)/CUSTOMER(按客户)/ALL(全部数据)',
  description VARCHAR(255) DEFAULT NULL COMMENT '权限描述',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0禁用',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code_tenant (permission_code, tenant_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据权限配置表';

-- 角色数据权限关联表
CREATE TABLE IF NOT EXISTS t_role_data_permission (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  role_id BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  data_permission_id BIGINT UNSIGNED NOT NULL COMMENT '数据权限ID',
  scope_values JSON DEFAULT NULL COMMENT '数据范围值（如部门ID列表、门店ID列表、客户ID列表）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_data_permission (role_id, data_permission_id),
  INDEX idx_role_id (role_id),
  INDEX idx_data_permission_id (data_permission_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色数据权限关联表';

-- 预置基础数据权限
INSERT INTO t_data_permission (tenant_id, permission_name, permission_code, permission_type, description, status, sort_no) VALUES
  ('', '全部数据', 'DATA_ALL', 'ALL', '可以查看所有数据', 1, 1),
  ('', '按部门', 'DATA_DEPARTMENT', 'DEPARTMENT', '只能查看本部门数据', 1, 2),
  ('', '按门店', 'DATA_STORE', 'STORE', '只能查看本门店数据', 1, 3),
  ('', '按客户', 'DATA_CUSTOMER', 'CUSTOMER', '只能查看归属客户数据', 1, 4);
