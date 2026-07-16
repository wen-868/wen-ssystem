-- 编号: 069, 描述: 商品SPU增加品牌ID, 创建人: 阿坚, 日期: 2026-07-05
-- 日期：2026-07-05
-- 说明：product_spu.brand 是 VARCHAR(128) 存储品牌名，改为 brand_id 引用 brand 表

-- 1. 添加 brand_id 列
ALTER TABLE t_product_spu
  ADD COLUMN brand_id BIGINT UNSIGNED DEFAULT NULL COMMENT '品牌ID' AFTER brand;

-- 2. 迁移现有 brand 字符串到 brand_id
UPDATE t_product_spu p
  JOIN t_brand b ON b.name = p.brand AND b.tenant_id = p.tenant_id
  SET p.brand_id = b.id
  WHERE p.brand IS NOT NULL AND p.brand != '';

-- 3. 添加外键约束
ALTER TABLE t_product_spu
  ADD CONSTRAINT fk_product_spu_brand FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE SET NULL;

-- 4. 添加索引
ALTER TABLE t_product_spu
  ADD INDEX idx_product_spu_brand_id (brand_id);