-- 编号: 059, 描述: 添加用户会话表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS user_session (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  token VARCHAR(512) NOT NULL COMMENT '会话令牌',
  device_type VARCHAR(32) DEFAULT NULL COMMENT '设备类型：WEB/MINIAPP/IOS/ANDROID',
  device_info VARCHAR(255) DEFAULT NULL COMMENT '设备信息',
  ip VARCHAR(64) DEFAULT NULL COMMENT 'IP地址',
  expires_at DATETIME NOT NULL COMMENT '过期时间',
  last_activity_at DATETIME DEFAULT NULL COMMENT '最后活跃时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_token (token(191)),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户会话表';