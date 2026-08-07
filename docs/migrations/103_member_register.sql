ALTER TABLE t_member
ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL COMMENT '密码哈希（自助注册会员）',
ADD COLUMN register_source VARCHAR(32) DEFAULT 'ADMIN' COMMENT '注册来源（ADMIN/SELF_REGISTER/INVITATION）';
-- 说明：MySQL 的 ALTER 不支持条件新增（仅 MariaDB 支持），列已存在时报错由迁移引擎 safeExec 跳过

CREATE TABLE IF NOT EXISTS t_member_sms_code (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  mobile VARCHAR(20) NOT NULL COMMENT '手机号',
  code VARCHAR(8) NOT NULL COMMENT '验证码',
  purpose VARCHAR(32) NOT NULL DEFAULT 'REGISTER' COMMENT '用途（REGISTER/RESET_PASSWORD）',
  expires_at DATETIME NOT NULL COMMENT '过期时间',
  used TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已使用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mobile_code (mobile, code),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员短信验证码表';
