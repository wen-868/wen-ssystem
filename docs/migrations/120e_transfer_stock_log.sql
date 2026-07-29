-- 调拨库存变动日志表
CREATE TABLE IF NOT EXISTS `t_transfer_stock_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `transfer_order_id` BIGINT UNSIGNED NOT NULL COMMENT '调拨单ID',
  `item_id` BIGINT UNSIGNED NOT NULL COMMENT '调拨明细ID',
  `store_id` BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  `sku_id` BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  `direction` VARCHAR(10) NOT NULL COMMENT '方向：OUT=发出 IN=接收',
  `quantity` DECIMAL(12,2) NOT NULL COMMENT '数量',
  `operator_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '操作人ID',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_transfer_order` (`transfer_order_id`),
  KEY `idx_store_sku` (`store_id`, `sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='调拨库存变动日志表';
