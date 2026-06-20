-- ============================================================================
-- 智享酒业进销存系统 - 数据库迁移脚本 v1 -> v2
-- 目标：将旧版数据库结构升级到 v2.0.0（对齐 init_database.sql）
-- 创建日期：2026-06-21
-- 适用数据库：MySQL 5.7+ / MySQL 8.x
-- 安全策略：只添加列和修改列类型，不删除数据、不删除列
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 一、sys_role 表迁移
-- 旧结构：id, role_code, role_name, data_scope(VARCHAR(32) DEFAULT 'STORE'),
--         status(TINYINT DEFAULT 1), created_at, updated_at
-- 新结构：id, role_code, role_name, description(VARCHAR(200)),
--         data_scope(VARCHAR(32) DEFAULT 'SELF'), permissions(JSON),
--         status(VARCHAR(16) DEFAULT 'ACTIVE'), created_at, updated_at
-- ============================================================================

-- 1.1 添加缺失字段 description
ALTER TABLE sys_role
  ADD COLUMN IF NOT EXISTS description VARCHAR(200) DEFAULT NULL COMMENT '角色描述'
  AFTER role_name;

-- 1.2 添加缺失字段 permissions
ALTER TABLE sys_role
  ADD COLUMN IF NOT EXISTS permissions JSON DEFAULT NULL COMMENT '权限列表（JSON格式）'
  AFTER data_scope;

-- 1.3 修改 status 字段类型：TINYINT -> VARCHAR(16)
-- 注意：MySQL MODIFY COLUMN 不支持 IF NOT EXISTS，需要用存储过程或直接执行
-- 先将已有的 tinyint 值 1 转换为 'ACTIVE'，0 转换为 'DISABLED'
ALTER TABLE sys_role
  MODIFY COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED';

-- 1.4 修改 data_scope 默认值：STORE -> SELF（仅影响后续新增行）
ALTER TABLE sys_role
  ALTER COLUMN data_scope SET DEFAULT 'SELF';

-- ============================================================================
-- 二、sys_user 表迁移
-- 旧结构：id, username, password_hash, real_name, mobile, store_id,
--         status(TINYINT DEFAULT 1), last_login_at, created_at, updated_at
-- 新结构：同上，但 status 改为 VARCHAR(16) DEFAULT 'ACTIVE'
-- ============================================================================

-- 2.1 修改 status 字段类型：TINYINT -> VARCHAR(16)
-- 先将已有的 tinyint 值 1 转换为 'ACTIVE'，0 转换为 'DISABLED'
ALTER TABLE sys_user
  MODIFY COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED';

-- ============================================================================
-- 三、数据迁移：将旧 tinyint 状态值转换为新的 VARCHAR 值
-- ============================================================================

-- 3.1 sys_role：将旧值 1 -> 'ACTIVE'，0 -> 'DISABLED'
-- 仅处理仍为数字字符串的行（MODIFY COLUMN 后 MySQL 会自动转换 tinyint 为字符串）
UPDATE sys_role
  SET status = CASE
    WHEN status = '1' THEN 'ACTIVE'
    WHEN status = '0' THEN 'DISABLED'
    ELSE status
  END
  WHERE status IN ('1', '0');

-- 3.2 sys_user：将旧值 1 -> 'ACTIVE'，0 -> 'DISABLED'
UPDATE sys_user
  SET status = CASE
    WHEN status = '1' THEN 'ACTIVE'
    WHEN status = '0' THEN 'DISABLED'
    ELSE status
  END
  WHERE status IN ('1', '0');

-- ============================================================================
-- 四、其他可能存在类似问题的表（status 为 TINYINT）
-- 以下表在 init_database.sql v2.0.0 中 status 仍定义为 TINYINT，
-- 暂不修改。如果后续代码统一使用 VARCHAR 状态值，可取消注释对应语句。
-- ============================================================================

-- 4.1 sys_permission 表
-- ALTER TABLE sys_permission
--   MODIFY COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED';
-- UPDATE sys_permission
--   SET status = CASE WHEN status = '1' THEN 'ACTIVE' WHEN status = '0' THEN 'DISABLED' ELSE status END
--   WHERE status IN ('1', '0');

-- 4.2 product_category 表
-- ALTER TABLE product_category
--   MODIFY COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED';
-- UPDATE product_category
--   SET status = CASE WHEN status = '1' THEN 'ACTIVE' WHEN status = '0' THEN 'DISABLED' ELSE status END
--   WHERE status IN ('1', '0');

-- 4.3 supplier 表
-- ALTER TABLE supplier
--   MODIFY COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED';
-- UPDATE supplier
--   SET status = CASE WHEN status = '1' THEN 'ACTIVE' WHEN status = '0' THEN 'DISABLED' ELSE status END
--   WHERE status IN ('1', '0');

-- 4.4 price_level 表
-- ALTER TABLE price_level
--   MODIFY COLUMN status VARCHAR(16) DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED';
-- UPDATE price_level
--   SET status = CASE WHEN status = '1' THEN 'ACTIVE' WHEN status = '0' THEN 'DISABLED' ELSE status END
--   WHERE status IN ('1', '0');

-- 4.5 trace_config 表
-- ALTER TABLE trace_config
--   MODIFY COLUMN status VARCHAR(16) DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED';
-- UPDATE trace_config
--   SET status = CASE WHEN status = '1' THEN 'ACTIVE' WHEN status = '0' THEN 'DISABLED' ELSE status END
--   WHERE status IN ('1', '0');

-- 4.6 member 表
-- ALTER TABLE member
--   MODIFY COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED';
-- UPDATE member
--   SET status = CASE WHEN status = '1' THEN 'ACTIVE' WHEN status = '0' THEN 'DISABLED' ELSE status END
--   WHERE status IN ('1', '0');

-- 4.7 product_sku 表
-- ALTER TABLE product_sku
--   MODIFY COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED';
-- UPDATE product_sku
--   SET status = CASE WHEN status = '1' THEN 'ACTIVE' WHEN status = '0' THEN 'DISABLED' ELSE status END
--   WHERE status IN ('1', '0');

-- 4.8 sku_price 表
-- ALTER TABLE sku_price
--   MODIFY COLUMN status VARCHAR(16) DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED';
-- UPDATE sku_price
--   SET status = CASE WHEN status = '1' THEN 'ACTIVE' WHEN status = '0' THEN 'DISABLED' ELSE status END
--   WHERE status IN ('1', '0');

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 迁移完成
-- 请在执行后验证：
--   1. SELECT * FROM sys_role LIMIT 5;  -- 确认 description、permissions 字段存在
--   2. SELECT status FROM sys_role;      -- 确认值为 'ACTIVE' 或 'DISABLED'
--   3. SELECT status FROM sys_user;      -- 确认值为 'ACTIVE' 或 'DISABLED'
--   4. SHOW CREATE TABLE sys_role;       -- 确认表结构与 init_database.sql 一致
--   5. SHOW CREATE TABLE sys_user;       -- 确认表结构与 init_database.sql 一致
-- ============================================================================
