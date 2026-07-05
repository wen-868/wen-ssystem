-- 编号: 078, 描述: 性能索引, 创建人: 阿坚, 日期: 2026-07-05
-- 日期：2026-06-28
-- 说明：为商品中心相关表添加查询优化索引
-- 不使用 ADD INDEX IF NOT EXISTS，由迁移引擎容错处理

ALTER TABLE product_spu ADD INDEX idx_product_spu_brand (brand);
ALTER TABLE product_spu ADD INDEX idx_product_spu_sort_no (sort_no);
ALTER TABLE product_spu ADD INDEX idx_product_spu_is_new (is_new);
ALTER TABLE product_spu ADD INDEX idx_product_spu_is_recommend (is_recommend);
ALTER TABLE product_spu ADD INDEX idx_product_spu_status_sort (status, sort_no);

ALTER TABLE product_sku ADD INDEX idx_product_sku_volume (volume);
ALTER TABLE product_sku ADD INDEX idx_product_sku_packaging (packaging);

ALTER TABLE product_category ADD INDEX idx_product_category_code (code);