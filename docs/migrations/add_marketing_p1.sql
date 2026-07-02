-- ============================================
-- 营销中心 Phase 10 新增表
-- 限时折扣 | 满赠规则 | 积分商城 | 营销素材库
-- ============================================

-- 1. 限时折扣活动
CREATE TABLE IF NOT EXISTS `limited_discount` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `activity_code` VARCHAR(36) NOT NULL COMMENT '活动编码',
  `activity_name` VARCHAR(100) NOT NULL COMMENT '活动名称',
  `activity_desc` VARCHAR(500) DEFAULT NULL COMMENT '活动描述',
  `discount_type` VARCHAR(20) NOT NULL DEFAULT 'PERCENT' COMMENT '折扣类型: PERCENT/FIXED',
  `discount_value` DECIMAL(10,2) NOT NULL COMMENT '折扣值(百分比/固定金额)',
  `min_purchase` DECIMAL(10,2) DEFAULT 0.00 COMMENT '最低购买金额',
  `applicable_scope` VARCHAR(20) NOT NULL DEFAULT 'ALL' COMMENT '适用范围: ALL/CATEGORY/PRODUCT',
  `applicable_ids` JSON DEFAULT NULL COMMENT '适用范围ID列表',
  `start_time` DATETIME NOT NULL COMMENT '开始时间',
  `end_time` DATETIME NOT NULL COMMENT '结束时间',
  `total_stock` INT NOT NULL DEFAULT 0 COMMENT '活动总库存',
  `available_stock` INT NOT NULL DEFAULT 0 COMMENT '剩余可用库存',
  `limit_per_user` INT DEFAULT NULL COMMENT '每人限购',
  `per_order_limit` INT DEFAULT NULL COMMENT '每单限购',
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/PENDING/ACTIVE/PAUSED/ENDED/SOLD_OUT',
  `participant_count` INT NOT NULL DEFAULT 0 COMMENT '参与人数',
  `total_sales_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '销售总额',
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_time_range` (`start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='限时折扣活动';

-- 1.1 限时折扣参与商品
CREATE TABLE IF NOT EXISTS `limited_discount_product` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `discount_id` BIGINT NOT NULL COMMENT '活动ID',
  `product_id` BIGINT NOT NULL COMMENT '商品ID',
  `sku_id` BIGINT DEFAULT NULL COMMENT 'SKU ID',
  `original_price` DECIMAL(10,2) NOT NULL COMMENT '原价',
  `discount_price` DECIMAL(10,2) NOT NULL COMMENT '折扣价',
  `stock` INT NOT NULL DEFAULT 0 COMMENT '活动库存',
  `sold_count` INT NOT NULL DEFAULT 0 COMMENT '已售数量',
  `tenant_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_discount_id` (`discount_id`),
  KEY `idx_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='限时折扣参与商品';

-- 2. 满赠规则
CREATE TABLE IF NOT EXISTS `gift_rule` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `rule_code` VARCHAR(36) NOT NULL COMMENT '规则编码',
  `rule_name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `rule_desc` VARCHAR(500) DEFAULT NULL COMMENT '规则描述',
  `threshold_type` VARCHAR(20) NOT NULL DEFAULT 'AMOUNT' COMMENT '门槛类型: AMOUNT/QUANTITY/BOTH',
  `threshold_amount` DECIMAL(10,2) DEFAULT NULL COMMENT '满X元',
  `threshold_quantity` INT DEFAULT NULL COMMENT '满X件',
  `applicable_scope` VARCHAR(20) NOT NULL DEFAULT 'ALL' COMMENT '适用范围: ALL/CATEGORY/PRODUCT',
  `applicable_ids` JSON DEFAULT NULL COMMENT '适用范围ID列表',
  `start_time` DATETIME NOT NULL COMMENT '开始时间',
  `end_time` DATETIME NOT NULL COMMENT '结束时间',
  `gift_stock_limit` INT DEFAULT NULL COMMENT '赠品库存上限',
  `remain_gift_stock` INT DEFAULT 0 COMMENT '剩余赠品库存',
  `is_stock_synced` TINYINT(1) DEFAULT 0 COMMENT '是否与商品库存联动',
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/ACTIVE/PAUSED/ENDED/DEPLETED',
  `participant_count` INT NOT NULL DEFAULT 0 COMMENT '参与人数',
  `gift_sent_count` INT NOT NULL DEFAULT 0 COMMENT '赠送件数',
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `created_by` BIGINT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_time_range` (`start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='满赠规则';

-- 2.1 满赠层级
CREATE TABLE IF NOT EXISTS `gift_rule_level` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `rule_id` BIGINT NOT NULL COMMENT '规则ID',
  `threshold_amount` DECIMAL(10,2) DEFAULT NULL COMMENT '门槛金额',
  `gift_product_id` BIGINT NOT NULL COMMENT '赠品商品ID',
  `gift_sku_id` BIGINT DEFAULT NULL COMMENT '赠品SKU ID',
  `gift_quantity` INT NOT NULL DEFAULT 1 COMMENT '赠送数量',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `tenant_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_rule_id` (`rule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='满赠规则层级';

-- 3. 积分商城商品
CREATE TABLE IF NOT EXISTS `points_product` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `product_code` VARCHAR(36) NOT NULL COMMENT '商品编码',
  `product_name` VARCHAR(100) NOT NULL COMMENT '商品名称',
  `product_image` VARCHAR(500) DEFAULT NULL COMMENT '商品图片',
  `product_desc` VARCHAR(500) DEFAULT NULL COMMENT '商品描述',
  `points_required` INT NOT NULL COMMENT '所需积分',
  `stock_total` INT NOT NULL DEFAULT 0 COMMENT '总库存',
  `stock_available` INT NOT NULL DEFAULT 0 COMMENT '可用库存',
  `exchange_limit_per_user` INT DEFAULT NULL COMMENT '每人限兑次数',
  `exchange_limit_total` INT DEFAULT NULL COMMENT '总限兑次数',
  `market_price` DECIMAL(10,2) DEFAULT NULL COMMENT '参考市场价',
  `status` VARCHAR(20) NOT NULL DEFAULT 'ON' COMMENT '状态: ON/OFF',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `tenant_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分商城商品';

-- 3.1 积分兑换记录
CREATE TABLE IF NOT EXISTS `points_exchange_record` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `record_no` VARCHAR(36) NOT NULL COMMENT '兑换编号',
  `product_id` BIGINT NOT NULL COMMENT '商品ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `points_used` INT NOT NULL COMMENT '消耗积分',
  `quantity` INT NOT NULL DEFAULT 1 COMMENT '兑换数量',
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/CONFIRMED/CANCELLED',
  `delivery_type` VARCHAR(20) DEFAULT 'SELF_PICKUP' COMMENT '配送方式: SELF_PICKUP/DELIVERY',
  `delivery_status` VARCHAR(20) DEFAULT NULL COMMENT '配送状态',
  `tenant_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenant_user` (`tenant_id`, `user_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_record_no` (`record_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分兑换记录';

-- 4. 营销素材
CREATE TABLE IF NOT EXISTS `marketing_material` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `material_code` VARCHAR(36) NOT NULL COMMENT '素材编码',
  `material_name` VARCHAR(100) NOT NULL COMMENT '素材名称',
  `material_desc` VARCHAR(500) DEFAULT NULL COMMENT '素材描述',
  `material_type` VARCHAR(20) NOT NULL COMMENT '素材类型: IMAGE/VIDEO/DOCUMENT/HTML',
  `file_url` VARCHAR(500) NOT NULL COMMENT '文件URL',
  `file_size` BIGINT DEFAULT NULL COMMENT '文件大小(字节)',
  `file_format` VARCHAR(20) DEFAULT NULL COMMENT '文件格式',
  `image_width` INT DEFAULT NULL COMMENT '图片宽度',
  `image_height` INT DEFAULT NULL COMMENT '图片高度',
  `category_id` BIGINT DEFAULT NULL COMMENT '分类ID',
  `tags` JSON DEFAULT NULL COMMENT '标签',
  `usage_scene` VARCHAR(50) DEFAULT NULL COMMENT '使用场景: POSTER/COUPON_BG/SECKILL_BG/WECHAT_ARTICLE/OTHER',
  `related_activity_id` BIGINT DEFAULT NULL COMMENT '关联活动ID',
  `related_activity_type` VARCHAR(30) DEFAULT NULL COMMENT '关联活动类型',
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/PUBLISHED/ARCHIVED',
  `download_count` INT NOT NULL DEFAULT 0 COMMENT '下载次数',
  `view_count` INT NOT NULL DEFAULT 0 COMMENT '查看次数',
  `use_count` INT NOT NULL DEFAULT 0 COMMENT '使用次数',
  `tenant_id` VARCHAR(36) NOT NULL,
  `created_by` BIGINT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_type` (`material_type`),
  KEY `idx_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='营销素材';

-- 4.1 素材分类
CREATE TABLE IF NOT EXISTS `material_category` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL COMMENT '分类名称',
  `parent_id` BIGINT DEFAULT NULL COMMENT '父分类ID',
  `sort_order` INT NOT NULL DEFAULT 0,
  `tenant_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='素材分类';