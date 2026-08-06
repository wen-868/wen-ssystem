-- 编号: 123, 描述: 客户表补充「联系人」字段, 创建人: 阿坚, 日期: 2026-08-06
-- ============================================================
-- R83-01：客户四要素「联系人」全链路补齐（数据库部分）
-- 说明：
--   1. t_member 新增 contact 列（VARCHAR(64)），置于 name 之后
--   2. 使用 092 号脚本定义的 add_column_if_not_exists 存储过程做 IF NOT EXISTS 保护，
--      可重复执行（存储过程按 migration.ts 文件名顺序在 092 阶段已创建）
--   3. 末尾附验证 SQL（information_schema 核对列存在与定义）
-- 注意：表名必须显式传 t_member（存储过程不做前缀转换）
-- ============================================================

USE liquor_inventory;

CALL add_column_if_not_exists('t_member', 'contact', "VARCHAR(64) DEFAULT NULL COMMENT '联系人' AFTER name");

-- ============================================================
-- 验证1：contact 列是否已存在及其定义
-- ============================================================
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_member' AND COLUMN_NAME = 'contact';

SELECT '123_member_contact.sql 执行完成（t_member.contact 已确保存在）' AS result;
