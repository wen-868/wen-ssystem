-- 编号: 062, 描述: 添加报表权限矩阵表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS report_permission_matrix (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  report_code VARCHAR(64) NOT NULL COMMENT '报表编码',
  store_scope VARCHAR(32) NOT NULL DEFAULT 'SELF' COMMENT '门店范围：SELF/CHILDREN/ALL',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_report (role_id, report_code),
  INDEX idx_role (role_id),
  INDEX idx_report (report_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报表权限矩阵表';