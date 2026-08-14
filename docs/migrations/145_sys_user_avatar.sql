ALTER TABLE t_sys_user ADD COLUMN avatar VARCHAR(512) DEFAULT NULL COMMENT '头像URL' AFTER real_name;

-- 编号: 145, 描述: t_sys_user 增加头像字段（移动端/桌面端头像上传）
-- 创建人: Codex, 日期: 2026-08-14
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
