-- 编号: 019, 描述: V2版本数据迁移, 创建人: 阿坚, 日期: 2026-07-06

-- ============================================================================
-- 智享酒业进销存系统 - 数据库迁移脚本 v1 -> v2
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. sys_role: 添加 description 字段
ALTER TABLE sys_role ADD COLUMN description VARCHAR(200) DEFAULT NULL COMMENT '角色描述' AFTER role_name;

-- 2. sys_role: 添加 permissions 字段
ALTER TABLE sys_role ADD COLUMN permissions JSON DEFAULT NULL COMMENT '权限列表（JSON格式）' AFTER data_scope;

-- 3. sys_role: data_scope 默认值
ALTER TABLE sys_role ALTER COLUMN data_scope SET DEFAULT 'SELF';

-- 4. member: 添加 settlement_type 字段（旧表可能缺失）
ALTER TABLE member ADD COLUMN settlement_type VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '结算方式：CASH/ACCOUNT' AFTER customer_type;

-- 5. supplier: 添加 settlement_type 字段（旧表可能缺失）
ALTER TABLE supplier ADD COLUMN settlement_type VARCHAR(32) NOT NULL DEFAULT 'MONTHLY' COMMENT '结算方式：CASH/MONTHLY' AFTER credit_level;

SET FOREIGN_KEY_CHECKS = 1;
