-- 编号: 092, 描述: 租户ID, 创建人: 阿坚, 日期: 2026-07-05
-- 执行时间：2026-06-27
-- 负责人：阿坚
-- 修复：将 ALTER TABLE IF EXISTS / ADD COLUMN IF NOT EXISTS / ADD INDEX IF NOT EXISTS
--       改为 MySQL 兼容的存储过程，通过 information_schema 检查列和索引是否存在
-- S3-190（原收口第 53 项）：本文件 12 条补列/补索引语句原先传的表名**缺 t_ 前缀**
--   （sys_config / sys_user / sys_role / sys_permission / sys_user_role / sys_role_permission，各 1 列 + 1 索引），
--   而辅助过程把 tbl_name **原样**拼进 ALTER TABLE（见下方过程体）⇒ 空库恒 ER_NO_SUCH_TABLE，
--   这 12 条从未生效（S3-186 改写时"语义按原样保留"，缺前缀一并被保留）。
--   本次**只补表名前缀**（sys_config ⇒ t_sys_config 等）：列定义/索引定义/守卫条件/动态 SQL 一字未改；
--   下方每条 "原 CALL" 注释保留的是 S3-186 改前原文（含缺前缀的表名）。
-- S3-197（原收口第 60 项②）：第3步「为所有表添加 tenant_id 索引」的索引名与 `migration.ts` 第2步
--   对 TENANT_TABLES 统一建的 `idx_<表名>_tenant`（例：t_sys_config ⇒ idx_t_sys_config_tenant）
--   **双轨命名**⇒ 同一张表同一列上出现两个索引（仅命名不同）。本文件把其中 62 条
--   「规范名与语料名在库内同时存在、纯属重复」的语句的 @s3186_name 统一到规范名 ⇒ 守卫命中"已存在"
--   而跳过，空库上净效果 = **只少了重复项**（详见 docs/evidence/S3-197/README.md §四）。
--   另有 7 条（t_approval_rule/instance/task/log/approver/notification、t_daily_settlement）的规范名
--   此时并不存在（这些表在第2步时尚未建出）⇒ 不是重复项，**原名保留未动**。
--   下方每条 "原 CALL" 注释保留 S3-186 改前原文（索引名含未归一的历史写法），属留档，未改。

USE liquor_inventory;

-- ============================================================
-- 辅助存储过程：条件添加列
-- ============================================================
DROP PROCEDURE IF EXISTS add_column_if_not_exists;
DELIMITER $$
CREATE PROCEDURE add_column_if_not_exists(
  IN tbl_name VARCHAR(128),
  IN col_name VARCHAR(128),
  IN col_def VARCHAR(512)
)
BEGIN
  DECLARE col_count INT DEFAULT 0;
  SELECT COUNT(*) INTO col_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = tbl_name
    AND COLUMN_NAME = col_name;
  IF col_count = 0 THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl_name, '` ADD COLUMN `', col_name, '` ', col_def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- ============================================================
-- 辅助存储过程：条件添加索引
-- ============================================================
DROP PROCEDURE IF EXISTS add_index_if_not_exists;
DELIMITER $$
CREATE PROCEDURE add_index_if_not_exists(
  IN tbl_name VARCHAR(128),
  IN idx_name VARCHAR(128),
  IN idx_def VARCHAR(512)
)
BEGIN
  DECLARE idx_count INT DEFAULT 0;
  SELECT COUNT(*) INTO idx_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = tbl_name
    AND INDEX_NAME = idx_name;
  IF idx_count = 0 THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl_name, '` ADD INDEX `', idx_name, '` ', idx_def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- ============================================================
-- 第1步：新建 tenant 表
-- ============================================================
CREATE TABLE IF NOT EXISTS t_tenant (
  id VARCHAR(36) PRIMARY KEY COMMENT '租户ID（UUID）',
  name VARCHAR(100) NOT NULL COMMENT '租户名称（公司名）',
  contact_name VARCHAR(50) COMMENT '联系人',
  contact_phone VARCHAR(20) COMMENT '联系电话',
  plan VARCHAR(20) DEFAULT 'basic' COMMENT '套餐：basic/professional/enterprise',
  status TINYINT DEFAULT 1 COMMENT '1=正常 0=停用',
  expire_at DATETIME COMMENT '到期时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_status (status),
  INDEX idx_tenant_expire (expire_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户表';

INSERT INTO t_tenant (id, name, contact_name, contact_phone, plan, status)
VALUES ('default', '默认租户', '系统管理员', '13800138000', 'basic', 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ============================================================
-- 第2步：为所有表添加 tenant_id 字段
-- ============================================================

-- 系统配置表
-- S3-186：原 CALL add_column_if_not_exists('sys_config', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_config', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_sys_config.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('sys_user', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_user', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_sys_user.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('sys_role', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_role', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_sys_role.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('sys_permission', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_permission', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_sys_permission.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('sys_user_role', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_user_role', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_sys_user_role.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('sys_role_permission', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_role_permission', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_sys_role_permission.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 门店相关
-- S3-186：原 CALL add_column_if_not_exists('t_store', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_store', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_store.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 商品相关
-- S3-186：原 CALL add_column_if_not_exists('t_product_category', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_product_category', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_product_category.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_product_spu', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_product_spu', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_product_spu.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_product_sku', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_product_sku', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_product_sku.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_product_price', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_product_price', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_product_price.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sku_price', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sku_price', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_sku_price.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 供应商相关
-- S3-186：原 CALL add_column_if_not_exists('t_supplier', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_supplier', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_supplier.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_supplier_contact', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_supplier_contact', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_supplier_contact.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 客户相关
-- S3-186：原 CALL add_column_if_not_exists('t_member', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_member', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_member.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_customer_price_binding', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_customer_price_binding', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_customer_price_binding.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_customer_credit', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_customer_credit', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_customer_credit.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 库存相关
-- S3-186：原 CALL add_column_if_not_exists('t_inventory_balance', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_inventory_balance', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_inventory_balance.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_inventory_batch', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_inventory_batch', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_inventory_batch.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_inventory_ledger', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_inventory_ledger', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_inventory_ledger.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 价格相关
-- S3-186：原 CALL add_column_if_not_exists('t_price_level', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_price_level', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_price_level.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_price_change_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_price_change_log', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_price_change_log.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 预警相关
-- S3-186：原 CALL add_column_if_not_exists('t_alert_rule', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_alert_rule', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_alert_rule.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_alert_record', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_alert_record', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_alert_record.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_expiry_alert_config', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_expiry_alert_config', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_expiry_alert_config.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_expiry_alert_record', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_expiry_alert_record', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_expiry_alert_record.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 溯源相关
-- S3-186：原 CALL add_column_if_not_exists('t_trace_config', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_trace_config', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_trace_config.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_trace_code', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_trace_code', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_trace_code.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_trace_event_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_trace_event_log', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_trace_event_log.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_trace_scan_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_trace_scan_log', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_trace_scan_log.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_recall_record', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_recall_record', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_recall_record.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 门店控制相关
-- S3-186：原 CALL add_column_if_not_exists('t_store_control_config', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_store_control_config', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_store_control_config.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_store_status_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_store_status_log', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_store_status_log.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 销售相关
-- S3-186：原 CALL add_column_if_not_exists('t_sale_bill', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_sale_bill.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sale_bill_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill_item', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_sale_bill_item.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sale_return', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_return', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_sale_return.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sale_return_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_return_item', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_sale_return_item.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sale_payment', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_payment', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_sale_payment.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 采购相关
-- S3-186：原 CALL add_column_if_not_exists('t_purchase_order', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_order', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_purchase_order.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_purchase_order_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_order_item', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_purchase_order_item.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_purchase_in_stock', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_in_stock', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_purchase_in_stock.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_purchase_in_stock_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_in_stock_item', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_purchase_in_stock_item.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_purchase_return', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_return', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_purchase_return.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_purchase_return_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_return_item', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_purchase_return_item.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_purchase_payment', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_payment', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_purchase_payment.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 结算对账相关
-- S3-186：原 CALL add_column_if_not_exists('t_supplier_statement', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_supplier_statement', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_supplier_statement.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_supplier_statement_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_supplier_statement_item', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_supplier_statement_item.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_customer_statement', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_customer_statement', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_customer_statement.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_customer_payment', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_customer_payment', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_customer_payment.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_receivable_account', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_receivable_account', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_receivable_account.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 支付相关
-- S3-186：原 CALL add_column_if_not_exists('t_payment_order', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_payment_order', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_payment_order.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_refund_order', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_refund_order', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_refund_order.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_hold_order', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_hold_order', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_hold_order.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 小程序相关
-- S3-186：原 CALL add_column_if_not_exists('t_miniapp_order', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_miniapp_order', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_miniapp_order.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_miniapp_order_item', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_miniapp_order_item', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_miniapp_order_item.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 分享收款相关
-- S3-186：原 CALL add_column_if_not_exists('t_collection_link', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_collection_link', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_collection_link.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_collection_view_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_collection_view_log', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_collection_view_log.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_collection_record', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_collection_record', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_collection_record.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 信用相关
-- S3-186：原 CALL add_column_if_not_exists('t_credit_operation_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_credit_operation_log', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_credit_operation_log.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 通知相关
-- S3-186：原 CALL add_column_if_not_exists('t_notification', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_notification', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_notification.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 日志相关
-- S3-186：原 CALL add_column_if_not_exists('t_operation_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_operation_log', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_operation_log.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_product_price_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_product_price_log', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_product_price_log.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 审批流程相关
-- S3-186：原 CALL add_column_if_not_exists('t_approval_rule', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_approval_rule', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_approval_rule.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_approval_instance', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_approval_instance', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_approval_instance.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_approval_task', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_approval_task', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_approval_task.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_approval_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_approval_log', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_approval_log.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_approval_approver', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_approval_approver', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_approval_approver.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_approval_notification', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_approval_notification', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_approval_notification.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- 每日结算
-- S3-186：原 CALL add_column_if_not_exists('t_daily_settlement', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_daily_settlement', @s3186_name = 'tenant_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(36) NOT NULL DEFAULT ''default'' COMMENT ''租户ID'' AFTER id'), 'SELECT ''跳过 t_daily_settlement.tenant_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- ============================================================
-- 第3步：为所有表添加 tenant_id 索引
-- ============================================================

-- S3-186：原 CALL add_index_if_not_exists('sys_config', 'idx_sys_config_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_config', @s3186_name = 'idx_t_sys_config_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_sys_config.idx_t_sys_config_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('sys_user', 'idx_sys_user_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_user', @s3186_name = 'idx_t_sys_user_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_sys_user.idx_t_sys_user_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('sys_role', 'idx_sys_role_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_role', @s3186_name = 'idx_t_sys_role_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_sys_role.idx_t_sys_role_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('sys_permission', 'idx_sys_permission_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_permission', @s3186_name = 'idx_t_sys_permission_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_sys_permission.idx_t_sys_permission_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('sys_user_role', 'idx_sys_user_role_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_user_role', @s3186_name = 'idx_t_sys_user_role_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_sys_user_role.idx_t_sys_user_role_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('sys_role_permission', 'idx_sys_role_permission_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_role_permission', @s3186_name = 'idx_t_sys_role_permission_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_sys_role_permission.idx_t_sys_role_permission_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_store', 'idx_store_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_store', @s3186_name = 'idx_t_store_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_store.idx_t_store_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_product_category', 'idx_product_category_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_product_category', @s3186_name = 'idx_t_product_category_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_product_category.idx_t_product_category_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_product_spu', 'idx_product_spu_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_product_spu', @s3186_name = 'idx_t_product_spu_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_product_spu.idx_t_product_spu_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_product_sku', 'idx_product_sku_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_product_sku', @s3186_name = 'idx_t_product_sku_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_product_sku.idx_t_product_sku_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_product_price', 'idx_product_price_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_product_price', @s3186_name = 'idx_t_product_price_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_product_price.idx_t_product_price_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_sku_price', 'idx_sku_price_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sku_price', @s3186_name = 'idx_t_sku_price_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_sku_price.idx_t_sku_price_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_supplier', 'idx_supplier_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_supplier', @s3186_name = 'idx_t_supplier_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_supplier.idx_t_supplier_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_supplier_contact', 'idx_supplier_contact_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_supplier_contact', @s3186_name = 'idx_t_supplier_contact_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_supplier_contact.idx_t_supplier_contact_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_member', 'idx_member_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_member', @s3186_name = 'idx_t_member_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_member.idx_t_member_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_customer_price_binding', 'idx_customer_price_binding_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_customer_price_binding', @s3186_name = 'idx_t_customer_price_binding_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_customer_price_binding.idx_t_customer_price_binding_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_customer_credit', 'idx_customer_credit_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_customer_credit', @s3186_name = 'idx_t_customer_credit_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_customer_credit.idx_t_customer_credit_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_inventory_balance', 'idx_inventory_balance_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_inventory_balance', @s3186_name = 'idx_t_inventory_balance_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_inventory_balance.idx_t_inventory_balance_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_inventory_batch', 'idx_inventory_batch_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_inventory_batch', @s3186_name = 'idx_t_inventory_batch_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_inventory_batch.idx_t_inventory_batch_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_inventory_ledger', 'idx_inventory_ledger_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_inventory_ledger', @s3186_name = 'idx_t_inventory_ledger_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_inventory_ledger.idx_t_inventory_ledger_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_price_level', 'idx_price_level_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_price_level', @s3186_name = 'idx_t_price_level_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_price_level.idx_t_price_level_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_price_change_log', 'idx_price_change_log_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_price_change_log', @s3186_name = 'idx_t_price_change_log_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_price_change_log.idx_t_price_change_log_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_alert_rule', 'idx_alert_rule_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_alert_rule', @s3186_name = 'idx_t_alert_rule_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_alert_rule.idx_t_alert_rule_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_alert_record', 'idx_alert_record_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_alert_record', @s3186_name = 'idx_t_alert_record_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_alert_record.idx_t_alert_record_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_expiry_alert_config', 'idx_expiry_alert_config_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_expiry_alert_config', @s3186_name = 'idx_t_expiry_alert_config_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_expiry_alert_config.idx_t_expiry_alert_config_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_expiry_alert_record', 'idx_expiry_alert_record_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_expiry_alert_record', @s3186_name = 'idx_t_expiry_alert_record_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_expiry_alert_record.idx_t_expiry_alert_record_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_trace_config', 'idx_trace_config_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_trace_config', @s3186_name = 'idx_t_trace_config_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_trace_config.idx_t_trace_config_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_trace_code', 'idx_trace_code_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_trace_code', @s3186_name = 'idx_t_trace_code_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_trace_code.idx_t_trace_code_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_trace_event_log', 'idx_trace_event_log_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_trace_event_log', @s3186_name = 'idx_t_trace_event_log_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_trace_event_log.idx_t_trace_event_log_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_trace_scan_log', 'idx_trace_scan_log_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_trace_scan_log', @s3186_name = 'idx_t_trace_scan_log_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_trace_scan_log.idx_t_trace_scan_log_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_recall_record', 'idx_recall_record_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_recall_record', @s3186_name = 'idx_t_recall_record_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_recall_record.idx_t_recall_record_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_store_control_config', 'idx_store_control_config_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_store_control_config', @s3186_name = 'idx_t_store_control_config_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_store_control_config.idx_t_store_control_config_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_store_status_log', 'idx_store_status_log_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_store_status_log', @s3186_name = 'idx_t_store_status_log_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_store_status_log.idx_t_store_status_log_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_sale_bill', 'idx_sale_bill_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill', @s3186_name = 'idx_t_sale_bill_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_sale_bill.idx_t_sale_bill_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_sale_bill_item', 'idx_sale_bill_item_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill_item', @s3186_name = 'idx_t_sale_bill_item_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_sale_bill_item.idx_t_sale_bill_item_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_sale_return', 'idx_sale_return_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_return', @s3186_name = 'idx_t_sale_return_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_sale_return.idx_t_sale_return_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_sale_return_item', 'idx_sale_return_item_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_return_item', @s3186_name = 'idx_t_sale_return_item_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_sale_return_item.idx_t_sale_return_item_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_sale_payment', 'idx_sale_payment_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_payment', @s3186_name = 'idx_t_sale_payment_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_sale_payment.idx_t_sale_payment_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_purchase_order', 'idx_purchase_order_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_order', @s3186_name = 'idx_t_purchase_order_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_purchase_order.idx_t_purchase_order_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_purchase_order_item', 'idx_purchase_order_item_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_order_item', @s3186_name = 'idx_t_purchase_order_item_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_purchase_order_item.idx_t_purchase_order_item_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_purchase_in_stock', 'idx_purchase_in_stock_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_in_stock', @s3186_name = 'idx_t_purchase_in_stock_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_purchase_in_stock.idx_t_purchase_in_stock_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_purchase_in_stock_item', 'idx_purchase_in_stock_item_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_in_stock_item', @s3186_name = 'idx_t_purchase_in_stock_item_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_purchase_in_stock_item.idx_t_purchase_in_stock_item_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_purchase_return', 'idx_purchase_return_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_return', @s3186_name = 'idx_t_purchase_return_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_purchase_return.idx_t_purchase_return_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_purchase_return_item', 'idx_purchase_return_item_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_return_item', @s3186_name = 'idx_t_purchase_return_item_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_purchase_return_item.idx_t_purchase_return_item_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_purchase_payment', 'idx_purchase_payment_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_payment', @s3186_name = 'idx_t_purchase_payment_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_purchase_payment.idx_t_purchase_payment_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_supplier_statement', 'idx_supplier_statement_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_supplier_statement', @s3186_name = 'idx_t_supplier_statement_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_supplier_statement.idx_t_supplier_statement_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_supplier_statement_item', 'idx_supplier_statement_item_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_supplier_statement_item', @s3186_name = 'idx_t_supplier_statement_item_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_supplier_statement_item.idx_t_supplier_statement_item_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_customer_statement', 'idx_customer_statement_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_customer_statement', @s3186_name = 'idx_t_customer_statement_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_customer_statement.idx_t_customer_statement_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_customer_payment', 'idx_customer_payment_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_customer_payment', @s3186_name = 'idx_t_customer_payment_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_customer_payment.idx_t_customer_payment_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_receivable_account', 'idx_receivable_account_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_receivable_account', @s3186_name = 'idx_t_receivable_account_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_receivable_account.idx_t_receivable_account_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_payment_order', 'idx_payment_order_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_payment_order', @s3186_name = 'idx_t_payment_order_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_payment_order.idx_t_payment_order_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_refund_order', 'idx_refund_order_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_refund_order', @s3186_name = 'idx_t_refund_order_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_refund_order.idx_t_refund_order_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_hold_order', 'idx_hold_order_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_hold_order', @s3186_name = 'idx_t_hold_order_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_hold_order.idx_t_hold_order_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_miniapp_order', 'idx_miniapp_order_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_miniapp_order', @s3186_name = 'idx_t_miniapp_order_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_miniapp_order.idx_t_miniapp_order_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_miniapp_order_item', 'idx_miniapp_order_item_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_miniapp_order_item', @s3186_name = 'idx_t_miniapp_order_item_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_miniapp_order_item.idx_t_miniapp_order_item_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_collection_link', 'idx_collection_link_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_collection_link', @s3186_name = 'idx_t_collection_link_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_collection_link.idx_t_collection_link_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_collection_view_log', 'idx_collection_view_log_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_collection_view_log', @s3186_name = 'idx_t_collection_view_log_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_collection_view_log.idx_t_collection_view_log_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_collection_record', 'idx_collection_record_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_collection_record', @s3186_name = 'idx_t_collection_record_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_collection_record.idx_t_collection_record_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_credit_operation_log', 'idx_credit_operation_log_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_credit_operation_log', @s3186_name = 'idx_t_credit_operation_log_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_credit_operation_log.idx_t_credit_operation_log_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_notification', 'idx_notification_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_notification', @s3186_name = 'idx_t_notification_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_notification.idx_t_notification_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_operation_log', 'idx_operation_log_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_operation_log', @s3186_name = 'idx_t_operation_log_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_operation_log.idx_t_operation_log_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_product_price_log', 'idx_product_price_log_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_product_price_log', @s3186_name = 'idx_t_product_price_log_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_product_price_log.idx_t_product_price_log_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_approval_rule', 'idx_approval_rule_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_approval_rule', @s3186_name = 'idx_approval_rule_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_approval_rule.idx_approval_rule_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_approval_instance', 'idx_approval_instance_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_approval_instance', @s3186_name = 'idx_approval_instance_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_approval_instance.idx_approval_instance_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_approval_task', 'idx_approval_task_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_approval_task', @s3186_name = 'idx_approval_task_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_approval_task.idx_approval_task_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_approval_log', 'idx_approval_log_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_approval_log', @s3186_name = 'idx_approval_log_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_approval_log.idx_approval_log_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_approval_approver', 'idx_approval_approver_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_approval_approver', @s3186_name = 'idx_approval_approver_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_approval_approver.idx_approval_approver_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_approval_notification', 'idx_approval_notification_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_approval_notification', @s3186_name = 'idx_approval_notification_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_approval_notification.idx_approval_notification_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_index_if_not_exists('t_daily_settlement', 'idx_daily_settlement_tenant', '(tenant_id)');（改为不依赖存储过程的幂等写法：守卫 information_schema.STATISTICS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_daily_settlement', @s3186_name = 'idx_daily_settlement_tenant';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD INDEX `', @s3186_name, '` ', '(tenant_id)'), 'SELECT ''跳过 t_daily_settlement.idx_daily_settlement_tenant'' AS result') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND INDEX_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- ============================================================
-- 第4步：更新 sys_user 表的租户关系（默认租户）
-- ============================================================
UPDATE t_sys_user SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = '';

-- ============================================================
-- 第5步：更新 store 表的租户关系（默认租户）
-- ============================================================
UPDATE t_store SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = '';

-- 清理存储过程
DROP PROCEDURE IF EXISTS add_column_if_not_exists;
DROP PROCEDURE IF EXISTS add_index_if_not_exists;

SELECT 'tenant_id 数据隔离迁移脚本执行完成（MySQL 8.0+ 兼容版）' AS result;
