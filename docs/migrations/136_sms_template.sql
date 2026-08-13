-- 编号: 136, 描述: 短信模板表（真实短信模板管理）, 创建人: Codex, 日期: 2026-08-13
CREATE TABLE IF NOT EXISTS t_sms_template (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '模板ID',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  name VARCHAR(64) NOT NULL COMMENT '模板名称',
  code VARCHAR(64) NOT NULL COMMENT '模板编码（短信服务商模板CODE）',
  content VARCHAR(500) NOT NULL COMMENT '模板内容',
  purpose VARCHAR(32) NOT NULL DEFAULT '' COMMENT '用途：REGISTER_LOGIN/ORDER_NOTICE等',
  status VARCHAR(16) NOT NULL DEFAULT 'ENABLED' COMMENT '状态：ENABLED/DISABLED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sms_template_code (tenant_id, code),
  KEY idx_sms_template_purpose (tenant_id, purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='短信模板表';

-- 默认注册验证码模板（服务商模板CODE需在云平台申请后修改）
INSERT INTO t_sms_template (tenant_id, name, code, content, purpose, status)
VALUES ('default', '注册验证码', 'SMS_REGISTER_CODE', '您的注册验证码为${code}，5分钟内有效，请勿泄露。', 'REGISTER', 'ENABLED')
ON DUPLICATE KEY UPDATE updated_at = NOW();
