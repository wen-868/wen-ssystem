-- 编号: 120, 描述: t_stock_warning 库存预警表（字段对齐 dashboard.service.ts 查询）
-- 创建人: 阿坚, 日期: 2026-07-30
-- 说明: dashboard.service.ts 的 getInventoryWarningList 查询需要 warning_threshold/store_name 两个字段。
--       migration.ts 中的动态建表字段已同步更新，本脚本用于服务器上已存在的旧版 t_stock_warning 表补列。
-- 负责人: 阿坚
-- 规则: 所有建表/加列均使用 IF NOT EXISTS 保护，末尾附验证 SQL

USE liquor_inventory;

-- ============================================================
-- 第1步：正式建表（若服务器上迁移系统未创建则新建）
-- ============================================================
CREATE TABLE IF NOT EXISTS t_stock_warning (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '预警ID',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  sku_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) DEFAULT NULL COMMENT 'SKU名称',
  current_stock INT NOT NULL DEFAULT 0 COMMENT '当前库存',
  warning_threshold INT NOT NULL DEFAULT 0 COMMENT '预警阈值',
  warning_level VARCHAR(32) NOT NULL DEFAULT 'WARNING' COMMENT '预警级别: URGENT/WARNING/INFO',
  store_name VARCHAR(100) DEFAULT NULL COMMENT '门店名称',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/RESOLVED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_stock_warning_sku (sku_id),
  KEY idx_stock_warning_level (warning_level),
  KEY idx_stock_warning_status (status),
  KEY idx_stock_warning_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存预警表';

-- ============================================================
-- 第2步：兼容旧表——为已存在但缺列的 t_stock_warning 补列
--       （防止 migration.ts 已经建过表，但列不齐的情况）
-- ============================================================

-- 条件加列：warning_threshold
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 't_stock_warning'
    AND COLUMN_NAME = 'warning_threshold'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE t_stock_warning ADD COLUMN warning_threshold INT NOT NULL DEFAULT 0 COMMENT ''预警阈值'' AFTER current_stock',
  'SELECT ''warning_threshold 已存在，跳过'' AS step'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 条件加列：store_name
SET @col_exists2 = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 't_stock_warning'
    AND COLUMN_NAME = 'store_name'
);
SET @sql2 = IF(@col_exists2 = 0,
  'ALTER TABLE t_stock_warning ADD COLUMN store_name VARCHAR(100) DEFAULT NULL COMMENT ''门店名称'' AFTER warning_level',
  'SELECT ''store_name 已存在，跳过'' AS step'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 兼容旧表：sku_id 从 NOT NULL -> DEFAULT NULL（允许按门店维度仅记录 SKU 名称的预警）
SET @sku_not_null = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 't_stock_warning'
    AND COLUMN_NAME = 'sku_id'
    AND IS_NULLABLE = 'NO'
);
SET @sql3 = IF(@sku_not_null > 0,
  'ALTER TABLE t_stock_warning MODIFY COLUMN sku_id BIGINT UNSIGNED DEFAULT NULL COMMENT ''SKU ID''',
  'SELECT ''sku_id 已是 DEFAULT NULL，跳过'' AS step'
);
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- ============================================================
-- 第3步：验证 SQL（服务器执行完脚本后，贴这一段 SELECT 核对）
-- ============================================================
-- 验证1：表是否存在 + 列数是否正确（共 11 列）
SELECT
  COUNT(*)                                                    AS total_columns,
  GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION SEPARATOR ',') AS columns_list
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_stock_warning';

-- 验证2：关键列的数据类型/默认值是否正确
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_stock_warning'
  AND COLUMN_NAME IN ('warning_threshold', 'store_name', 'tenant_id', 'sku_id')
ORDER BY ORDINAL_POSITION;

-- 验证3：索引是否齐全（PRIMARY + 4 个 KEY）
SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS cols
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_stock_warning'
GROUP BY INDEX_NAME
ORDER BY INDEX_NAME;

SELECT '120_stock_warning.sql 执行完成（含表创建+2列补齐+索引验证）' AS result;
