-- 编号: 087, 描述: 报表汇总表, 创建人: 阿坚, 日期: 2026-07-05
-- ============================================
-- 报表数据汇总表
-- 每日聚合数据，用于加速报表查询
-- ============================================

-- 1. 销售日报汇总
CREATE TABLE IF NOT EXISTS `t_report_sales_daily` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` VARCHAR(32) NOT NULL COMMENT '租户ID',
  `store_id` BIGINT NOT NULL COMMENT '门店ID',
  `report_date` DATE NOT NULL COMMENT '报表日期',
  `order_count` INT NOT NULL DEFAULT 0 COMMENT '订单数',
  `customer_count` INT NOT NULL DEFAULT 0 COMMENT '下单客户数',
  `new_customer_count` INT NOT NULL DEFAULT 0 COMMENT '新客户数',
  `goods_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
  `receivable_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应收金额',
  `received_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已收金额',
  `unreceived_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '未收金额',
  `refund_count` INT NOT NULL DEFAULT 0 COMMENT '退款笔数',
  `refund_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '退款金额',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_tenant_store_date` (`tenant_id`, `store_id`, `report_date`),
  KEY `idx_report_date` (`report_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='销售日报汇总';

-- 2. 收款统计汇总
CREATE TABLE IF NOT EXISTS `t_report_collection_stats` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` VARCHAR(32) NOT NULL COMMENT '租户ID',
  `store_id` BIGINT NOT NULL COMMENT '门店ID',
  `report_date` DATE NOT NULL COMMENT '报表日期',
  `total_links` INT NOT NULL DEFAULT 0 COMMENT '生成链接数',
  `paid_links` INT NOT NULL DEFAULT 0 COMMENT '已付链接数',
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '链接总金额',
  `paid_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已付金额',
  `wechat_links` INT NOT NULL DEFAULT 0 COMMENT '微信渠道链接数',
  `alipay_links` INT NOT NULL DEFAULT 0 COMMENT '支付宝渠道链接数',
  `other_channel_links` INT NOT NULL DEFAULT 0 COMMENT '其他渠道链接数',
  `avg_pay_cycle_hours` DECIMAL(8,2) DEFAULT NULL COMMENT '平均付款周期(小时)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_tenant_store_date` (`tenant_id`, `store_id`, `report_date`),
  KEY `idx_report_date` (`report_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收款统计汇总';

-- 3. 商品销售汇总
CREATE TABLE IF NOT EXISTS `t_report_product_sales` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` VARCHAR(32) NOT NULL COMMENT '租户ID',
  `store_id` BIGINT NOT NULL COMMENT '门店ID',
  `report_date` DATE NOT NULL COMMENT '报表日期',
  `sku_id` BIGINT NOT NULL COMMENT 'SKU ID',
  `sku_name` VARCHAR(200) DEFAULT NULL COMMENT 'SKU名称',
  `category_name` VARCHAR(100) DEFAULT NULL COMMENT '商品分类',
  `sale_bottle_qty` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '销售瓶数',
  `sale_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '销售金额',
  `order_count` INT NOT NULL DEFAULT 0 COMMENT '订单数(含此SKU)',
  `rank_in_store` INT DEFAULT NULL COMMENT '门店内排名',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_tenant_store_date_sku` (`tenant_id`, `store_id`, `report_date`, `sku_id`),
  KEY `idx_report_date` (`report_date`),
  KEY `idx_sku_id` (`sku_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品销售汇总';

-- 4. 客户统计汇总
CREATE TABLE IF NOT EXISTS `t_report_customer_stats` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` VARCHAR(32) NOT NULL COMMENT '租户ID',
  `store_id` BIGINT NOT NULL COMMENT '门店ID',
  `report_date` DATE NOT NULL COMMENT '报表日期',
  `total_customers` INT NOT NULL DEFAULT 0 COMMENT '累计客户数',
  `new_customers` INT NOT NULL DEFAULT 0 COMMENT '新增客户数',
  `active_customers` INT NOT NULL DEFAULT 0 COMMENT '活跃客户数(当月有下单)',
  `repurchase_customers` INT NOT NULL DEFAULT 0 COMMENT '复购客户数',
  `lost_customers` INT NOT NULL DEFAULT 0 COMMENT '流失客户数(90天未下单)',
  `avg_order_value` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '平均客单价',
  `total_revenue` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '总营收',
  `repurchase_rate` DECIMAL(5,2) DEFAULT NULL COMMENT '复购率(%)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_tenant_store_date` (`tenant_id`, `store_id`, `report_date`),
  KEY `idx_report_date` (`report_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户统计汇总';

-- 5. 库存日报汇总
CREATE TABLE IF NOT EXISTS `t_report_inventory_daily` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` VARCHAR(32) NOT NULL COMMENT '租户ID',
  `store_id` BIGINT NOT NULL COMMENT '门店ID',
  `report_date` DATE NOT NULL COMMENT '报表日期',
  `total_sku_count` INT NOT NULL DEFAULT 0 COMMENT 'SKU品种数',
  `total_physical_qty` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '实物库存总量',
  `total_available_qty` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '可用库存总量',
  `total_locked_qty` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '锁定库存总量',
  `total_value` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '库存总价值',
  `low_stock_sku_count` INT NOT NULL DEFAULT 0 COMMENT '低库存SKU数',
  `zero_stock_sku_count` INT NOT NULL DEFAULT 0 COMMENT '零库存SKU数',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_tenant_store_date` (`tenant_id`, `store_id`, `report_date`),
  KEY `idx_report_date` (`report_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='库存日报汇总';