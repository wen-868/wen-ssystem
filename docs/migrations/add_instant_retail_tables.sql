-- ============================================
-- 即时零售模块 Phase 11 新增表
-- 平台配置 | 平台订单 | 商品映射 | 门店配置 | 零售分类 | 零售商品 | 零售订单 | 订单明细 | Banner
-- ============================================

-- 1. 平台配置表
CREATE TABLE IF NOT EXISTS `platform_config` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `platform` VARCHAR(20) NOT NULL COMMENT '平台: JD/MEITUAN/ELEME',
  `store_id` BIGINT DEFAULT NULL COMMENT '门店ID',
  `app_key` VARCHAR(100) DEFAULT NULL COMMENT '应用Key',
  `app_secret` VARCHAR(200) DEFAULT NULL COMMENT '应用密钥',
  `merchant_id` VARCHAR(100) DEFAULT NULL COMMENT '商家ID',
  `access_token` VARCHAR(500) DEFAULT NULL COMMENT '访问令牌',
  `refresh_token` VARCHAR(500) DEFAULT NULL COMMENT '刷新令牌',
  `token_expire_at` DATETIME DEFAULT NULL COMMENT '令牌过期时间',
  `enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `config_json` JSON DEFAULT NULL COMMENT '扩展配置JSON',
  `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_platform_store_tenant` (`platform`, `store_id`, `tenant_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台配置表';

-- 2. 平台订单表
CREATE TABLE IF NOT EXISTS `platform_order` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `platform_order_id` VARCHAR(64) NOT NULL COMMENT '平台订单号',
  `platform` VARCHAR(20) NOT NULL COMMENT '平台: JD/MEITUAN/ELEME',
  `store_id` BIGINT DEFAULT NULL COMMENT '门店ID',
  `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING' COMMENT '订单状态',
  `order_data_json` JSON DEFAULT NULL COMMENT '平台原始订单数据',
  `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_platform_order` (`platform_order_id`),
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_platform` (`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台订单表';

-- 3. 平台商品映射表
CREATE TABLE IF NOT EXISTS `platform_product_map` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `platform` VARCHAR(20) NOT NULL COMMENT '平台: JD/MEITUAN/ELEME',
  `store_id` BIGINT NOT NULL COMMENT '门店ID',
  `local_sku_id` BIGINT NOT NULL COMMENT '本地SKU ID',
  `platform_sku_id` VARCHAR(64) DEFAULT NULL COMMENT '平台SKU ID',
  `platform_spu_id` VARCHAR(64) DEFAULT NULL COMMENT '平台SPU ID',
  `sync_status` VARCHAR(20) NOT NULL DEFAULT 'UNSYNCED' COMMENT '同步状态: UNSYNCED/PENDING/SYNCED/FAILED',
  `sync_msg` VARCHAR(500) DEFAULT NULL COMMENT '同步消息',
  `synced_at` DATETIME DEFAULT NULL COMMENT '同步时间',
  `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_platform_local_sku` (`platform`, `store_id`, `local_sku_id`, `tenant_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_sync_status` (`sync_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台商品映射表';

-- 4. 零售门店配置表
CREATE TABLE IF NOT EXISTS `retail_shop_config` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL COMMENT '门店ID',
  `shop_name` VARCHAR(100) NOT NULL COMMENT '店铺名称',
  `shop_logo` VARCHAR(500) DEFAULT NULL COMMENT '店铺Logo',
  `shop_description` VARCHAR(500) DEFAULT NULL COMMENT '店铺描述',
  `contact_phone` VARCHAR(20) DEFAULT NULL COMMENT '联系电话',
  `business_hours` VARCHAR(100) DEFAULT NULL COMMENT '营业时间',
  `delivery_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否支持配送',
  `pickup_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否支持自提',
  `min_order_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT '起送金额',
  `delivery_fee` DECIMAL(10,2) DEFAULT 0.00 COMMENT '配送费',
  `delivery_radius` DECIMAL(10,2) DEFAULT NULL COMMENT '配送半径(km)',
  `estimated_delivery_time` VARCHAR(50) DEFAULT NULL COMMENT '预计配送时间',
  `announcement` VARCHAR(500) DEFAULT NULL COMMENT '公告',
  `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN' COMMENT '状态: OPEN/CLOSED/MAINTENANCE',
  `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_store_tenant` (`store_id`, `tenant_id`),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='零售门店配置表';

-- 5. 零售分类表
CREATE TABLE IF NOT EXISTS `retail_category` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `category_name` VARCHAR(100) NOT NULL COMMENT '分类名称',
  `category_icon` VARCHAR(500) DEFAULT NULL COMMENT '分类图标',
  `parent_id` BIGINT DEFAULT NULL COMMENT '父分类ID',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `status` VARCHAR(20) NOT NULL DEFAULT 'ON' COMMENT '状态: ON/OFF',
  `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `store_id` BIGINT DEFAULT NULL COMMENT '门店ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='零售分类表';

-- 6. 零售商品表
CREATE TABLE IF NOT EXISTS `retail_product` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `product_id` BIGINT NOT NULL COMMENT '本地商品ID',
  `sku_id` BIGINT DEFAULT NULL COMMENT '本地SKU ID',
  `category_id` BIGINT DEFAULT NULL COMMENT '零售分类ID',
  `retail_price` DECIMAL(10,2) NOT NULL COMMENT '零售价',
  `original_price` DECIMAL(10,2) DEFAULT NULL COMMENT '原价',
  `stock` INT NOT NULL DEFAULT 0 COMMENT '库存',
  `sales_count` INT NOT NULL DEFAULT 0 COMMENT '销量',
  `is_recommended` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否推荐',
  `is_hot` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否热销',
  `is_new` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否新品',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `status` VARCHAR(20) NOT NULL DEFAULT 'ON' COMMENT '状态: ON/OFF',
  `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `store_id` BIGINT DEFAULT NULL COMMENT '门店ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenant_store` (`tenant_id`, `store_id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_status` (`status`),
  KEY `idx_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='零售商品表';

-- 7. 零售订单表
CREATE TABLE IF NOT EXISTS `retail_order` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `order_no` VARCHAR(32) NOT NULL COMMENT '订单号',
  `user_id` BIGINT DEFAULT NULL COMMENT '用户ID',
  `store_id` BIGINT DEFAULT NULL COMMENT '门店ID',
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '商品总额',
  `discount_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
  `delivery_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '配送费',
  `pay_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '实付金额',
  `delivery_type` VARCHAR(20) NOT NULL DEFAULT 'DELIVERY' COMMENT '配送类型: DELIVERY/PICKUP',
  `delivery_address` VARCHAR(500) DEFAULT NULL COMMENT '配送地址',
  `receiver_name` VARCHAR(50) DEFAULT NULL COMMENT '收货人姓名',
  `receiver_phone` VARCHAR(20) DEFAULT NULL COMMENT '收货人电话',
  `receiver_latitude` DECIMAL(10,7) DEFAULT NULL COMMENT '收货纬度',
  `receiver_longitude` DECIMAL(10,7) DEFAULT NULL COMMENT '收货经度',
  `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
  `payment_status` VARCHAR(20) NOT NULL DEFAULT 'UNPAID' COMMENT '支付状态',
  `payment_method` VARCHAR(30) DEFAULT NULL COMMENT '支付方式',
  `payment_time` DATETIME DEFAULT NULL COMMENT '支付时间',
  `transaction_no` VARCHAR(64) DEFAULT NULL COMMENT '支付流水号',
  `order_status` VARCHAR(30) NOT NULL DEFAULT 'PENDING' COMMENT '订单状态',
  `cancel_reason` VARCHAR(500) DEFAULT NULL COMMENT '取消原因',
  `platform` VARCHAR(20) DEFAULT NULL COMMENT '来源平台',
  `platform_order_id` VARCHAR(64) DEFAULT NULL COMMENT '平台订单号',
  `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_tenant_store` (`tenant_id`, `store_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_order_status` (`order_status`),
  KEY `idx_payment_status` (`payment_status`),
  KEY `idx_platform_order` (`platform_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='零售订单表';

-- 8. 零售订单明细表
CREATE TABLE IF NOT EXISTS `retail_order_item` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT NOT NULL COMMENT '订单ID',
  `product_id` BIGINT NOT NULL COMMENT '商品ID',
  `sku_id` BIGINT DEFAULT NULL COMMENT 'SKU ID',
  `product_name` VARCHAR(200) NOT NULL COMMENT '商品名称',
  `product_image` VARCHAR(500) DEFAULT NULL COMMENT '商品图片',
  `price` DECIMAL(10,2) NOT NULL COMMENT '单价',
  `quantity` INT NOT NULL DEFAULT 1 COMMENT '数量',
  `subtotal` DECIMAL(10,2) NOT NULL COMMENT '小计',
  `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_order_id` (`order_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  CONSTRAINT `fk_retail_order_item_order` FOREIGN KEY (`order_id`) REFERENCES `retail_order` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='零售订单明细表';

-- 9. 零售Banner表
CREATE TABLE IF NOT EXISTS `retail_banner` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `banner_title` VARCHAR(100) DEFAULT NULL COMMENT 'Banner标题',
  `banner_image` VARCHAR(500) NOT NULL COMMENT 'Banner图片',
  `link_type` VARCHAR(20) DEFAULT NULL COMMENT '跳转类型: PRODUCT/CATEGORY/URL/NONE',
  `link_value` VARCHAR(500) DEFAULT NULL COMMENT '跳转值',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `status` VARCHAR(20) NOT NULL DEFAULT 'ON' COMMENT '状态: ON/OFF',
  `start_time` DATETIME DEFAULT NULL COMMENT '开始时间',
  `end_time` DATETIME DEFAULT NULL COMMENT '结束时间',
  `store_id` BIGINT DEFAULT NULL COMMENT '门店ID',
  `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='零售Banner表';

-- 10. 零售评价表
CREATE TABLE IF NOT EXISTS `retail_review` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT NOT NULL COMMENT '订单ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `product_id` BIGINT DEFAULT NULL COMMENT '商品ID',
  `platform` VARCHAR(20) DEFAULT NULL COMMENT '来源平台',
  `platform_review_id` VARCHAR(64) DEFAULT NULL COMMENT '平台评价ID',
  `rating` DECIMAL(2,1) NOT NULL COMMENT '评分',
  `review_content` VARCHAR(1000) DEFAULT NULL COMMENT '评价内容',
  `review_images` JSON DEFAULT NULL COMMENT '评价图片',
  `review_tags` JSON DEFAULT NULL COMMENT '评价标签',
  `reply` VARCHAR(1000) DEFAULT NULL COMMENT '商家回复',
  `reply_at` DATETIME DEFAULT NULL COMMENT '回复时间',
  `is_anonymous` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否匿名',
  `status` VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED' COMMENT '状态',
  `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_platform_review` (`platform_review_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='零售评价表';