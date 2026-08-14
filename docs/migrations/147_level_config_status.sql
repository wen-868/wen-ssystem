ALTER TABLE t_level_config ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active' COMMENT '状态：active/disabled' AFTER discount_rate;

-- 编号: 147, 描述: t_level_config 增加状态字段（R100-02 会员等级删除/启停）
-- 创建人: 阿澈, 日期: 2026-08-15
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
-- 幂等: migration.ts safeExec 对 "Duplicate column name" 错误做模式匹配跳过，可重复执行。
