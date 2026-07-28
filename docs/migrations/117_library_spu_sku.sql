-- ============================================================================
-- 编号: 117, 描述: 商品库 SPU+SKU+API Key 建表（平台级共享商品库）, 创建人: 凌舟, 日期: 2026-07-28
-- ============================================================================
-- 背景：系统无平台级共享商品库，商户无法通过扫码自动获取商品基础信息
-- 设计：
--   1. t_library_spu  — 商品库 SPU（商品主档案），不含 category_id（分类不做必填）
--   2. t_library_sku  — 商品库 SKU（条码入口），barcode 唯一索引
--   3. t_library_api_key — Open API 密钥表，外部平台对接用
-- 注意：三张表均不带 tenant_id（平台级数据）
-- ============================================================================

USE liquor_inventory;

-- ----------------------------------------------------------------------------
-- 1. 商品库 SPU 表（商品主档案）
--    一个 SPU 代表一种商品（如"茅台 飞天 53度"）
--    不含 category_id — 分类不做必填，商户用自己的租户级分类
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `t_library_spu` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `spu_code` VARCHAR(32) NOT NULL COMMENT 'SPU 编码（如 SPU20260728001）',
  `name` VARCHAR(256) NOT NULL COMMENT '商品名称（如"茅台 飞天 53度"）',
  `brand_id` BIGINT NOT NULL COMMENT '品牌 ID（关联 t_library_brand）',
  `specs` VARCHAR(256) NOT NULL COMMENT '规格（如"500ml×6瓶/箱"）',
  `unit` VARCHAR(32) DEFAULT NULL COMMENT '基本计量单位（瓶/箱/罐）',
  `main_image` VARCHAR(512) DEFAULT NULL COMMENT '主图 URL',
  `image_urls` JSON DEFAULT NULL COMMENT '轮播图 URL 数组',
  `properties` JSON DEFAULT NULL COMMENT '扩展属性（酒精度/产地/香型/等级/年份/原料）',
  `description` VARCHAR(500) DEFAULT NULL COMMENT '商品简介',
  `detail` TEXT DEFAULT NULL COMMENT '商品详情（富文本 HTML）',
  `suggested_retail_price` DECIMAL(10,2) DEFAULT NULL COMMENT '建议零售价（仅参考）',
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/APPROVED/REJECTED/OFFLINE',
  `source` VARCHAR(32) NOT NULL DEFAULT 'OFFICIAL' COMMENT '数据来源：OFFICIAL/BARCODE_API/ECOMMERCE/MERCHANT/SUPPLIER',
  `submit_count` INT NOT NULL DEFAULT 0 COMMENT '被商户提交次数',
  `hit_count` INT NOT NULL DEFAULT 0 COMMENT '被扫码命中次数',
  `reviewed_by` BIGINT DEFAULT NULL COMMENT '审核人 ID',
  `reviewed_at` DATETIME DEFAULT NULL COMMENT '审核时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_spu_code` (`spu_code`),
  UNIQUE KEY `uk_name_brand_specs` (`name`, `brand_id`, `specs`),
  KEY `idx_brand_id` (`brand_id`),
  KEY `idx_status` (`status`),
  KEY `idx_source` (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品库 SPU 表（平台级，不含 tenant_id，不含 category_id）';

-- ----------------------------------------------------------------------------
-- 2. 商品库 SKU 表（条码入口）
--    一个 SKU 对应一个条码，条码是扫码查询的唯一入口
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `t_library_sku` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `spu_id` BIGINT UNSIGNED NOT NULL COMMENT '所属 SPU ID（关联 t_library_spu）',
  `sku_code` VARCHAR(32) NOT NULL COMMENT 'SKU 编码',
  `barcode` VARCHAR(128) NOT NULL COMMENT '条码（EAN-13/UPC），扫码入口',
  `sku_name` VARCHAR(256) NOT NULL COMMENT 'SKU 名称（如"500ml 光瓶装"）',
  `volume` VARCHAR(64) DEFAULT NULL COMMENT '净含量（如"500ml"）',
  `packaging` VARCHAR(64) DEFAULT NULL COMMENT '包装类型（光瓶/礼盒/罐装/桶装）',
  `base_unit` VARCHAR(32) DEFAULT NULL COMMENT '基础单位（瓶/罐）',
  `box_unit` VARCHAR(32) DEFAULT NULL COMMENT '组合单位（箱）',
  `box_ratio` INT DEFAULT NULL COMMENT '箱瓶比（1箱=N瓶）',
  `sku_image` VARCHAR(512) DEFAULT NULL COMMENT 'SKU 实物图 URL',
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/APPROVED/REJECTED',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_barcode` (`barcode`),
  UNIQUE KEY `uk_sku_code` (`sku_code`),
  KEY `idx_spu_id` (`spu_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品库 SKU 表（条码为扫码唯一入口）';

-- ----------------------------------------------------------------------------
-- 3. Open API 密钥表
--    管理外部平台对接的 API Key，支持 IP 白名单和调用频率限制
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `t_library_api_key` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `app_name` VARCHAR(128) NOT NULL COMMENT '应用名称（如"某某ERP对接"）',
  `api_key` VARCHAR(64) NOT NULL COMMENT 'API Key（如 zk_live_XXXXXX）',
  `api_secret` VARCHAR(256) DEFAULT NULL COMMENT 'API Secret（bcrypt 加密存储）',
  `allowed_ips` JSON DEFAULT NULL COMMENT 'IP 白名单（JSON数组，空=不限）',
  `daily_limit` INT NOT NULL DEFAULT 10000 COMMENT '每日调用次数限制',
  `today_count` INT NOT NULL DEFAULT 0 COMMENT '今日已调用次数（每日0点重置）',
  `last_called_at` DATETIME DEFAULT NULL COMMENT '最后调用时间',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1=启用 0=禁用',
  `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_api_key` (`api_key`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Open API 密钥表（外部平台对接用）';
