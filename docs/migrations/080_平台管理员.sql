-- 编号: 080, 描述: 平台管理员, 创建人: 阿坚, 日期: 2026-07-05
-- ============================================================
-- 平台总后台数据表（幂等版本）
-- 使用 CREATE TABLE IF NOT EXISTS，可安全在生产环境执行
-- ============================================================
-- 注意：此文件由 S3 迁移生成，因历史原因原文件 add_platform_admin.sql
-- 使用了 DROP TABLE IF EXISTS，已修正为幂等语法

-- 平台管理员账号
CREATE TABLE IF NOT EXISTS t_platform_admin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE COMMENT '登录账号',
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt 密码哈希',
  real_name VARCHAR(64) NOT NULL COMMENT '真实姓名',
  email VARCHAR(128) DEFAULT NULL COMMENT '邮箱',
  phone VARCHAR(32) DEFAULT NULL COMMENT '手机号',
  role VARCHAR(32) NOT NULL DEFAULT 'PLATFORM_ADMIN' COMMENT '角色: PLATFORM_ADMIN / PLATFORM_SUPER_ADMIN',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1=启用 0=禁用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台管理员';

-- 平台操作日志
CREATE TABLE IF NOT EXISTS t_platform_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL COMMENT '操作人ID',
  admin_name VARCHAR(64) NOT NULL COMMENT '操作人姓名',
  action VARCHAR(64) NOT NULL COMMENT '操作类型',
  target_type VARCHAR(64) NOT NULL COMMENT '操作对象类型',
  target_id VARCHAR(64) DEFAULT NULL COMMENT '操作对象ID',
  detail JSON DEFAULT NULL COMMENT '操作详情',
  ip VARCHAR(45) DEFAULT NULL COMMENT '操作IP',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_id (admin_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台操作日志';