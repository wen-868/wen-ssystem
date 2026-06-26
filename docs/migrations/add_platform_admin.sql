-- 平台总后台功能 - 数据库表结构
-- 执行时间：2026-06-27
-- 负责人：阿坚

USE liquor_inventory;

-- 平台管理员表
DROP TABLE IF EXISTS platform_audit_log;
DROP TABLE IF EXISTS platform_config;
DROP TABLE IF EXISTS platform_admin;

CREATE TABLE platform_admin (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '管理员ID',
  username VARCHAR(50) NOT NULL COMMENT '用户名',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  real_name VARCHAR(50) NOT NULL COMMENT '真实姓名',
  phone VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  email VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
  role VARCHAR(20) NOT NULL DEFAULT 'ADMIN' COMMENT '角色：SUPER_ADMIN超级管理员/ADMIN管理员/SUPPORT客服',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE正常/DISABLED禁用',
  last_login_at DATETIME DEFAULT NULL COMMENT '最后登录时间',
  last_login_ip VARCHAR(50) DEFAULT NULL COMMENT '最后登录IP',
  created_by VARCHAR(50) NOT NULL DEFAULT 'system' COMMENT '创建人',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_username (username),
  KEY idx_status (status),
  KEY idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台管理员';

-- 平台配置表
CREATE TABLE platform_config (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  config_key VARCHAR(100) NOT NULL COMMENT '配置键',
  config_value TEXT COMMENT '配置值',
  category VARCHAR(50) NOT NULL DEFAULT 'general' COMMENT '分类：general/sms/payment/email',
  description VARCHAR(255) DEFAULT NULL COMMENT '描述',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  updated_by VARCHAR(50) NOT NULL DEFAULT 'system' COMMENT '更新人',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_config_key (config_key),
  KEY idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台配置';

-- 平台审计日志表
CREATE TABLE platform_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  admin_id BIGINT UNSIGNED DEFAULT NULL COMMENT '管理员ID',
  module VARCHAR(50) NOT NULL COMMENT '模块：tenant/subscription/admin/config',
  action VARCHAR(50) NOT NULL COMMENT '操作：create/update/delete/enable/disable',
  detail TEXT COMMENT '操作详情（JSON）',
  ip_address VARCHAR(50) DEFAULT NULL COMMENT 'IP地址',
  user_agent VARCHAR(500) DEFAULT NULL COMMENT 'UserAgent',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_id (admin_id),
  KEY idx_module (module),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台审计日志';

-- 初始化超级管理员（默认密码：admin123）
INSERT INTO platform_admin (username, password_hash, real_name, phone, role, status, created_by)
VALUES ('superadmin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '超级管理员', '13800000000', 'SUPER_ADMIN', 'ACTIVE', 'system');

-- 初始化默认配置
INSERT INTO platform_config (config_key, config_value, category, description, sort_order) VALUES
('platform_name', '智享酒行 SaaS 平台', 'general', '平台名称', 1),
('platform_logo', '', 'general', '平台Logo', 2),
('default_plan', 'basic', 'general', '默认套餐', 3),
('trial_days', '30', 'general', '免费试用天数', 4),
('max_tenants_per_admin', '100', 'general', '每个管理员最多管理租户数量', 5),
('sms_provider', 'aliyun', 'sms', '短信服务商', 10),
('sms_enabled', 'true', 'sms', '是否启用短信', 11),
('payment_wechat_enabled', 'true', 'payment', '是否启用微信支付', 20),
('payment_alipay_enabled', 'true', 'payment', '是否启用支付宝支付', 21),
('email_smtp_host', '', 'email', 'SMTP服务器', 30),
('email_enabled', 'false', 'email', '是否启用邮件', 31);

SELECT '平台总后台数据库表创建完成' AS result;
