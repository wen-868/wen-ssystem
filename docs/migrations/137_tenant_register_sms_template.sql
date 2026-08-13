-- 编号: 137, 描述: 租户注册短信模板种子（注册验证码 + 审核结果通知）, 创建人: Codex, 日期: 2026-08-14

-- 注册验证码模板（用途 TENANT_REGISTER）
INSERT INTO t_sms_template (tenant_id, name, code, content, purpose, status)
VALUES ('default', '租户注册验证码', 'SMS_TENANT_REGISTER_CODE', '您的注册验证码为${code}，5分钟内有效，请勿泄露。', 'TENANT_REGISTER', 'ENABLED')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 审核结果通知模板（用途 TENANT_REGISTER_RESULT）
INSERT INTO t_sms_template (tenant_id, name, code, content, purpose, status)
VALUES ('default', '租户注册审核结果', 'SMS_TENANT_REGISTER_RESULT', '尊敬的${companyName}，您的注册申请已${status}，请使用注册账号登录工作台。', 'TENANT_REGISTER_RESULT', 'ENABLED')
ON DUPLICATE KEY UPDATE updated_at = NOW();
