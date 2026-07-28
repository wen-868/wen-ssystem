-- ============================================================================
-- 编号: 118, 描述: 商品库品牌表建表+预置数据, 创建人: 凌舟, 日期: 2026-07-28
-- ============================================================================
-- 背景：商品库需要独立的平台级品牌表，与租户级 t_brand 隔离
-- 设计：
--   1. t_library_brand — 扁平结构，含 name/logo/origin_country/sort_no/status
--   2. 预置10个酒水行业常见品牌
-- 注意：不建 t_library_category 表 — 分类不做必填，商户用自己的租户级分类
-- ============================================================================

USE liquor_inventory;

-- ----------------------------------------------------------------------------
-- 商品库品牌表
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `t_library_brand` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` VARCHAR(128) NOT NULL COMMENT '品牌名称（如"茅台集团"）',
  `logo` VARCHAR(512) DEFAULT NULL COMMENT '品牌 LOGO URL',
  `description` VARCHAR(500) DEFAULT NULL COMMENT '品牌简介',
  `origin_country` VARCHAR(64) DEFAULT NULL COMMENT '品牌所属国家/地区',
  `sort_no` INT NOT NULL DEFAULT 0 COMMENT '排序值（越小越靠前）',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1=启用 0=禁用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_status_sort` (`status`, `sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品库品牌表（平台级）';

-- ----------------------------------------------------------------------------
-- 预置品牌数据（10个酒水行业常见品牌）
-- ----------------------------------------------------------------------------
INSERT INTO `t_library_brand` (`id`, `name`, `origin_country`, `sort_no`, `description`) VALUES
  (1,  '茅台集团',   '中国', 1,  '贵州茅台酒股份有限公司，酱香型白酒代表'),
  (2,  '五粮液',     '中国', 2,  '四川省宜宾五粮液集团有限公司，浓香型白酒代表'),
  (3,  '洋河',       '中国', 3,  '江苏洋河酒厂股份有限公司，蓝色经典系列'),
  (4,  '泸州老窖',   '中国', 4,  '泸州老窖股份有限公司，中国最古老的四大名酒之一'),
  (5,  '汾酒',       '中国', 5,  '山西杏花村汾酒集团有限责任公司，清香型白酒代表'),
  (6,  '剑南春',     '中国', 6,  '四川剑南春集团有限责任公司，浓香型白酒'),
  (7,  '郎酒',       '中国', 7,  '四川郎酒集团有限责任公司，酱香型白酒'),
  (8,  '古井贡',     '中国', 8,  '安徽古井贡酒股份有限公司，浓香型白酒'),
  (9,  '青岛啤酒',   '中国', 9,  '青岛啤酒股份有限公司，中国知名啤酒品牌'),
  (10, '雪花啤酒',   '中国', 10, '华润雪花啤酒（中国）有限公司，中国销量最大的啤酒品牌')
ON DUPLICATE KEY UPDATE `updated_at` = CURRENT_TIMESTAMP;
