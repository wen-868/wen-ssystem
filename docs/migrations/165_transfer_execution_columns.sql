ALTER TABLE t_transfer_order_item ADD COLUMN `transferred_qty` INT NOT NULL DEFAULT 0 COMMENT '已发运数量';
ALTER TABLE t_transfer_order_item ADD COLUMN `received_qty` INT NOT NULL DEFAULT 0 COMMENT '已收货数量';
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
-- 编号: 165, 描述: 调拨执行链补列补表——transfer-execution.service 引用的 transferred_qty/received_qty 列
-- 在任何历史迁移中均未定义, 线上明细表缺列导致 shipQty=NaN, UPDATE 报 DOUBLE out of range 500;
-- 120e 的 t_transfer_stock_log 建表语句因文件头注释被启动迁移丢弃, 表缺失。
-- 顶格书写规避注释丢弃 bug, 幂等可重复执行。创建人: 凌舟, 日期: 2026-09-05
