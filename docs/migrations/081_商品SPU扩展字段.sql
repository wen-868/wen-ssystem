-- 编号: 081, 描述: 商品SPU扩展字段, 创建人: 阿坚, 日期: 2026-07-05
-- 日期：2026-06-28
-- 说明：补齐 product_spu / product_sku / product_category 缺失字段
-- 注意：不使用 ADD COLUMN IF NOT EXISTS（需要 MySQL 8.0.32+），由迁移引擎容错处理

ALTER TABLE product_spu ADD COLUMN brand VARCHAR(128) DEFAULT NULL COMMENT '品牌';
ALTER TABLE product_spu ADD COLUMN unit VARCHAR(32) DEFAULT NULL COMMENT '单位';
ALTER TABLE product_spu ADD COLUMN specs VARCHAR(256) DEFAULT NULL COMMENT '规格';
ALTER TABLE product_spu ADD COLUMN sort_no INT NOT NULL DEFAULT 0 COMMENT '排序';
ALTER TABLE product_spu ADD COLUMN is_new TINYINT NOT NULL DEFAULT 0 COMMENT '新品标记';
ALTER TABLE product_spu ADD COLUMN is_recommend TINYINT NOT NULL DEFAULT 0 COMMENT '推荐标记';
ALTER TABLE product_spu ADD COLUMN description VARCHAR(512) DEFAULT NULL COMMENT '商品简介';

ALTER TABLE product_sku ADD COLUMN volume VARCHAR(32) DEFAULT NULL COMMENT '净含量（500ml/1L）';
ALTER TABLE product_sku ADD COLUMN packaging VARCHAR(32) DEFAULT NULL COMMENT '包装类型（瓶装/罐装/桶装）';

ALTER TABLE product_category ADD COLUMN icon VARCHAR(256) DEFAULT NULL COMMENT '分类图标';
ALTER TABLE product_category ADD COLUMN code VARCHAR(64) DEFAULT NULL COMMENT '分类编码';