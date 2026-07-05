-- 编号: 066, 描述: 添加推送日志表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS push_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  template_id BIGINT UNSIGNED DEFAULT NULL COMMENT '模板ID',
  push_type VARCHAR(32) NOT NULL COMMENT '推送类型',
  channel VARCHAR(32) NOT NULL COMMENT '渠道',
  title VARCHAR(255) NOT NULL COMMENT '推送标题',
  content TEXT NOT NULL COMMENT '推送内容',
  status VARCHAR(32) NOT NULL COMMENT '状态：SUCCESS/FAILED',
  error_msg VARCHAR(512) DEFAULT NULL COMMENT '错误信息',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推送日志表';