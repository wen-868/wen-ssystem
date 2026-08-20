ALTER TABLE t_payment_config MODIFY config_key VARCHAR(64) NOT NULL DEFAULT '' COMMENT '兼容 key-value 旧结构，扁平结构下恒为空';
ALTER TABLE t_payment_config MODIFY config_value TEXT NULL COMMENT '兼容 key-value 旧结构，扁平结构下恒为 NULL';

-- 编号: 143, 描述: t_payment_config 扁平列写入兼容（config_key/config_value 允许空）
-- 创建人: 系统, 日期: 2026-08-14
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
-- 代码 saveChannelConfig 的 INSERT 不写 config_key/config_value（扁平结构），服务器旧表这两列 NOT NULL 无默认值会导致保存报错。
