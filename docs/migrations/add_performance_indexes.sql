-- 性能索引优化（Phase 2）
-- 日期：2026-06-28
-- 说明：为商品中心相关表添加查询优化索引
-- 依赖：需先执行 add_tenant_id.sql 中的 add_index_if_not_exists 存储过程
-- MySQL 8.0 兼容版本

CALL add_index_if_not_exists('product_spu', 'idx_product_spu_brand', '(brand)');
CALL add_index_if_not_exists('product_spu', 'idx_product_spu_sort_no', '(sort_no)');
CALL add_index_if_not_exists('product_spu', 'idx_product_spu_is_new', '(is_new)');
CALL add_index_if_not_exists('product_spu', 'idx_product_spu_is_recommend', '(is_recommend)');
CALL add_index_if_not_exists('product_spu', 'idx_product_spu_status_sort', '(status, sort_no)');

CALL add_index_if_not_exists('product_sku', 'idx_product_sku_volume', '(volume)');
CALL add_index_if_not_exists('product_sku', 'idx_product_sku_packaging', '(packaging)');

CALL add_index_if_not_exists('product_category', 'idx_product_category_code', '(code)');