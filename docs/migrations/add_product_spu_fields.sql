-- 商品中心字段补齐（Phase 2）
-- 日期：2026-06-28
-- 说明：补齐 product_spu / product_sku / product_category 缺失字段
-- 依赖：需先执行 add_tenant_id.sql 中的 add_column_if_not_exists 存储过程
-- MySQL 8.0 兼容版本

CALL add_column_if_not_exists('product_spu', 'brand', "VARCHAR(128) DEFAULT NULL COMMENT '品牌'");
CALL add_column_if_not_exists('product_spu', 'unit', "VARCHAR(32) DEFAULT NULL COMMENT '单位'");
CALL add_column_if_not_exists('product_spu', 'specs', "VARCHAR(256) DEFAULT NULL COMMENT '规格'");
CALL add_column_if_not_exists('product_spu', 'sort_no', "INT NOT NULL DEFAULT 0 COMMENT '排序'");
CALL add_column_if_not_exists('product_spu', 'is_new', "TINYINT NOT NULL DEFAULT 0 COMMENT '新品标记'");
CALL add_column_if_not_exists('product_spu', 'is_recommend', "TINYINT NOT NULL DEFAULT 0 COMMENT '推荐标记'");
CALL add_column_if_not_exists('product_spu', 'description', "VARCHAR(512) DEFAULT NULL COMMENT '商品简介'");

CALL add_column_if_not_exists('product_sku', 'volume', "VARCHAR(32) DEFAULT NULL COMMENT '净含量（500ml/1L）'");
CALL add_column_if_not_exists('product_sku', 'packaging', "VARCHAR(32) DEFAULT NULL COMMENT '包装类型（瓶装/罐装/桶装）'");

CALL add_column_if_not_exists('product_category', 'icon', "VARCHAR(256) DEFAULT NULL COMMENT '分类图标'");
CALL add_column_if_not_exists('product_category', 'code', "VARCHAR(64) DEFAULT NULL COMMENT '分类编码'");