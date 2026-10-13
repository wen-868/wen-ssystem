-- 编号: 075, 描述: 合规凭证字段, 创建人: 阿坚, 日期: 2026-07-05
-- ============================================================
-- 迁移：销售单据分享法律凭证完整性增强
-- 日期：2026-07-02
-- 说明：
--   1. sale_bill_item 增加 unit/barcode/spec 快照字段
--   2. sale_bill 增加 store_name/store_address/store_contact 法律凭证字段
--   3. collection_link 增加 display_config/document_title 自定义显示配置
-- 依赖：需先执行 add_tenant_id.sql 中的 add_column_if_not_exists 存储过程
-- MySQL 8.0 兼容版本
-- ============================================================
-- S3-190（原收口第 53 项）：本文件 8 条补列语句原先传的表名缺 t_ 前缀
--   （sale_bill_item 的 unit/barcode/spec、sale_bill 的 store_name/store_address/store_contact、
--    collection_link 的 display_config/document_title）⇒ 恒 ER_NO_SUCH_TABLE，从未生效。
--   本次**只补表名前缀**（sale_bill_item ⇒ t_sale_bill_item 等）：列定义/守卫条件/动态 SQL 一字未改；
--   下方每条 "原 CALL" 注释保留的是 S3-186 改前原文（含缺前缀的表名）。

-- S3-186：原 CALL add_column_if_not_exists('sale_bill_item', 'unit', "VARCHAR(16) NOT NULL DEFAULT '瓶' COMMENT '单位快照（瓶/箱）'");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill_item', @s3186_name = 'unit';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(16) NOT NULL DEFAULT ''瓶'' COMMENT ''单位快照（瓶/箱）'''), 'SELECT ''跳过 t_sale_bill_item.unit'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('sale_bill_item', 'barcode', "VARCHAR(128) DEFAULT NULL COMMENT '条形码快照'");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill_item', @s3186_name = 'barcode';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(128) DEFAULT NULL COMMENT ''条形码快照'''), 'SELECT ''跳过 t_sale_bill_item.barcode'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('sale_bill_item', 'spec', "VARCHAR(128) DEFAULT NULL COMMENT '规格描述快照（如：500ml/瓶）'");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill_item', @s3186_name = 'spec';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(128) DEFAULT NULL COMMENT ''规格描述快照（如：500ml/瓶）'''), 'SELECT ''跳过 t_sale_bill_item.spec'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- S3-186：原 CALL add_column_if_not_exists('sale_bill', 'store_name', "VARCHAR(128) DEFAULT NULL COMMENT '门店名称快照'");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill', @s3186_name = 'store_name';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(128) DEFAULT NULL COMMENT ''门店名称快照'''), 'SELECT ''跳过 t_sale_bill.store_name'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('sale_bill', 'store_address', "VARCHAR(255) DEFAULT NULL COMMENT '门店地址快照'");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill', @s3186_name = 'store_address';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(255) DEFAULT NULL COMMENT ''门店地址快照'''), 'SELECT ''跳过 t_sale_bill.store_address'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('sale_bill', 'store_contact', "VARCHAR(64) DEFAULT NULL COMMENT '门店联系方式快照'");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill', @s3186_name = 'store_contact';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(64) DEFAULT NULL COMMENT ''门店联系方式快照'''), 'SELECT ''跳过 t_sale_bill.store_contact'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

-- S3-186：原 CALL add_column_if_not_exists('collection_link', 'display_config', "JSON DEFAULT NULL COMMENT '显示字段配置'");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_collection_link', @s3186_name = 'display_config';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'JSON DEFAULT NULL COMMENT ''显示字段配置'''), 'SELECT ''跳过 t_collection_link.display_config'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('collection_link', 'document_title', "VARCHAR(128) DEFAULT '销售单' COMMENT '单据标题'");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_collection_link', @s3186_name = 'document_title';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(128) DEFAULT ''销售单'' COMMENT ''单据标题'''), 'SELECT ''跳过 t_collection_link.document_title'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
