-- 编号: 107, 描述: 岗位管理表, 创建人: 阿坚, 日期: 2026-07-13

CREATE TABLE IF NOT EXISTS sys_position (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  position_name VARCHAR(100) NOT NULL COMMENT '岗位名称',
  position_code VARCHAR(50) DEFAULT NULL COMMENT '岗位编码',
  department_id BIGINT DEFAULT NULL COMMENT '所属部门ID',
  sort_order INT DEFAULT 0 COMMENT '排序',
  status TINYINT DEFAULT 1 COMMENT '状态: 1启用, 0禁用',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_department_id (department_id),
  INDEX idx_tenant (tenant_id),
  UNIQUE KEY uk_position_code (position_code, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='岗位表';
