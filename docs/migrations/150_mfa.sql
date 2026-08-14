ALTER TABLE t_sys_user ADD COLUMN mfa_secret VARCHAR(128) DEFAULT NULL COMMENT 'TOTP 双因素认证 Secret(Base32)' AFTER password_hash;
ALTER TABLE t_sys_user ADD COLUMN mfa_enabled TINYINT NOT NULL DEFAULT 0 COMMENT '双因素认证是否启用：1启用/0未启用' AFTER mfa_secret;

-- 编号: 150, 描述: 双因素认证(MFA)字段(顶级商业软件验收-认证检查项)
-- 创建人: 凌舟, 日期: 2026-08-15
-- 注意: 文件头不写注释(自动迁移按分号拆分,注释污染首条语句被丢弃),说明放文件末尾。
-- 幂等: migration.ts safeExec 对 "Duplicate column name" 错误做模式匹配跳过,可重复执行。
