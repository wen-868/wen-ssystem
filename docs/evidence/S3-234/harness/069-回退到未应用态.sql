-- S3-234 · 069 两遍取证的夹具复位脚本（**只对本地夹具库执行，绝不进生产**）
-- 目的：把夹具库的「069 结果态」回退成"未应用"（无列 / 无外键 / 无索引），
--   这样才能观察到"第一遍真的建（有变更）+ 第二遍整句跳过（零变更）"两侧。
-- 三条语句都带 information_schema 守卫 ⇒ 本脚本自身可重复执行。
SET @s3234_fk_pre = (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND CONSTRAINT_NAME = 'fk_product_spu_brand');
SET @s3234_ddl_pre = IF(@s3234_fk_pre > 0, 'ALTER TABLE t_product_spu DROP FOREIGN KEY fk_product_spu_brand', 'SELECT ''S3-234 复位：本库已无该外键'' AS s3234_reset_fk');
PREPARE s3234_pre_stmt FROM @s3234_ddl_pre;
EXECUTE s3234_pre_stmt;
DEALLOCATE PREPARE s3234_pre_stmt;

SET @s3234_idx_pre = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND INDEX_NAME = 'idx_product_spu_brand_id');
SET @s3234_ddl_pre = IF(@s3234_idx_pre > 0, 'ALTER TABLE t_product_spu DROP INDEX idx_product_spu_brand_id', 'SELECT ''S3-234 复位：本库已无该索引'' AS s3234_reset_idx');
PREPARE s3234_pre_stmt FROM @s3234_ddl_pre;
EXECUTE s3234_pre_stmt;
DEALLOCATE PREPARE s3234_pre_stmt;

SET @s3234_col_pre = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND COLUMN_NAME = 'brand_id');
SET @s3234_ddl_pre = IF(@s3234_col_pre > 0, 'ALTER TABLE t_product_spu DROP COLUMN brand_id', 'SELECT ''S3-234 复位：本库已无该列'' AS s3234_reset_col');
PREPARE s3234_pre_stmt FROM @s3234_ddl_pre;
EXECUTE s3234_pre_stmt;
DEALLOCATE PREPARE s3234_pre_stmt;

-- 复位后自证（三个读数应全为 0）
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND COLUMN_NAME = 'brand_id') AS pre_col,
  (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND CONSTRAINT_NAME = 'fk_product_spu_brand') AS pre_fk,
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND INDEX_NAME = 'idx_product_spu_brand_id') AS pre_idx,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND COLUMN_NAME = 'brand') AS pre_brand_col;
