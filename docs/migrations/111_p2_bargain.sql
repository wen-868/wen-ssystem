-- 编号: 111, 描述: P2级砍价活动, 创建人: 阿坚, 日期: 2026-07-14
-- ============================================
-- P2级功能：社群营销 - 砍价活动
-- ============================================

-- 1. 砍价活动表
CREATE TABLE IF NOT EXISTS `bargain_activity` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `activity_name` VARCHAR(200) NOT NULL COMMENT '活动名称',
  `activity_desc` VARCHAR(500) DEFAULT NULL COMMENT '活动描述',
  `product_id` BIGINT NOT NULL COMMENT '商品SPU ID',
  `sku_id` BIGINT DEFAULT NULL COMMENT 'SKU ID',
  `original_price` DECIMAL(10,2) NOT NULL COMMENT '原价',
  `min_price` DECIMAL(10,2) NOT NULL COMMENT '最低砍到价',
  `total_stock` INT NOT NULL DEFAULT 0 COMMENT '活动总库存',
  `sold_count` INT NOT NULL DEFAULT 0 COMMENT '已售数量',
  `bargain_times` INT NOT NULL DEFAULT 10 COMMENT '砍价次数上限',
  `time_limit_hours` INT NOT NULL DEFAULT 24 COMMENT '砍价时限(小时)',
  `help_min_amount` DECIMAL(10,2) NOT NULL DEFAULT 1.00 COMMENT '每次帮砍最小金额',
  `help_max_amount` DECIMAL(10,2) NOT NULL DEFAULT 10.00 COMMENT '每次帮砍最大金额',
  `start_time` DATETIME NOT NULL COMMENT '开始时间',
  `end_time` DATETIME NOT NULL COMMENT '结束时间',
  `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT/ACTIVE/PAUSED/ENDED',
  `tenant_id` VARCHAR(32) NOT NULL COMMENT '租户ID',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_time_range` (`start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='砍价活动表';

-- 2. 砍价记录表
CREATE TABLE IF NOT EXISTS `bargain_record` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `activity_id` BIGINT UNSIGNED NOT NULL COMMENT '活动ID',
  `initiator_id` BIGINT NOT NULL COMMENT '发起人用户ID',
  `current_price` DECIMAL(10,2) NOT NULL COMMENT '当前价格',
  `bargain_count` INT NOT NULL DEFAULT 0 COMMENT '已砍次数',
  `status` VARCHAR(16) NOT NULL DEFAULT 'ONGOING' COMMENT '状态：ONGOING/SUCCESS/FAILED/EXPIRED',
  `order_id` BIGINT DEFAULT NULL COMMENT '关联订单ID',
  `expires_at` DATETIME NOT NULL COMMENT '过期时间',
  `success_at` DATETIME DEFAULT NULL COMMENT '砍价成功时间',
  `tenant_id` VARCHAR(32) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_activity_id` (`activity_id`),
  KEY `idx_initiator` (`initiator_id`),
  KEY `idx_status` (`status`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='砍价记录表';

-- 3. 帮砍记录表
CREATE TABLE IF NOT EXISTS `bargain_help` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `record_id` BIGINT UNSIGNED NOT NULL COMMENT '砍价记录ID',
  `helper_id` BIGINT NOT NULL COMMENT '帮砍人用户ID',
  `helper_name` VARCHAR(64) DEFAULT NULL COMMENT '帮砍人昵称',
  `bargain_amount` DECIMAL(10,2) NOT NULL COMMENT '砍掉金额',
  `tenant_id` VARCHAR(32) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_record_id` (`record_id`),
  KEY `idx_helper` (`helper_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='帮砍记录表';
