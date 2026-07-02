-- 性能索引优化（Phase 2）
-- 日期：2026-06-28
-- 说明：为商品中心相关表添加查询优化索引
-- 注意：ADD INDEX IF NOT EXISTS 为 MariaDB 语法，MySQL 8.0 请使用
--       add_tenant_id.sql 中的 add_index_if_not_exists 存储过程替代

-- product_spu 索引
ALTER TABLE product_spu
  ADD INDEX IF NOT EXISTS idx_product_spu_brand (brand),
  ADD INDEX IF NOT EXISTS idx_product_spu_sort_no (sort_no),
  ADD INDEX IF NOT EXISTS idx_product_spu_is_new (is_new),
  ADD INDEX IF NOT EXISTS idx_product_spu_is_recommend (is_recommend),
  ADD INDEX IF NOT EXISTS idx_product_spu_status_sort (status, sort_no);

-- product_sku 索引
ALTER TABLE product_sku
  ADD INDEX IF NOT EXISTS idx_product_sku_volume (volume),
  ADD INDEX IF NOT EXISTS idx_product_sku_packaging (packaging);

-- product_category 索引
ALTER TABLE product_category
  ADD INDEX IF NOT EXISTS idx_product_category_code (code);