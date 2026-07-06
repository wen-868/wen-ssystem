-- 商品SKU表新增字段：酒精度、产地
-- 执行时间：2026-06-21

USE liquor_inventory;

ALTER TABLE product_sku
  ADD COLUMN alcohol_degree DECIMAL(5,2) DEFAULT NULL COMMENT '酒精度(%)' AFTER sku_name,
  ADD COLUMN origin VARCHAR(128) DEFAULT NULL COMMENT '产地' AFTER alcohol_degree;

-- 添加索引以便查询
ALTER TABLE product_sku
  ADD KEY idx_product_sku_origin (origin);
