-- ============================================================================
-- P2级功能：套装与组合品 + 损益处理 - 数据库迁移
-- 版本：113
-- 日期：2026-07-15
-- 说明：新增套装表、套装商品明细表、组合品表、组合品可选项目表、
--       报损单表、报损单明细表、报溢单表、报溢单明细表
-- ============================================================================

-- ========== 套装表 ==========
CREATE TABLE IF NOT EXISTS `product_bundle` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bundle_no` VARCHAR(32) NOT NULL COMMENT '套装编号',
  `bundle_name` VARCHAR(128) NOT NULL COMMENT '套装名称',
  `category_id` INT DEFAULT NULL COMMENT '分类ID',
  `cover_image` VARCHAR(255) DEFAULT NULL COMMENT '封面图',
  `description` TEXT DEFAULT NULL COMMENT '套装描述',
  `original_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '原价（各商品原价之和）',
  `bundle_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '套装价格',
  `cost_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '成本价',
  `status` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '状态：0=下架 1=上架',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `sales_count` INT NOT NULL DEFAULT 0 COMMENT '销量',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bundle_no_tenant` (`bundle_no`, `tenant_id`),
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品套装表';

-- ========== 套装商品明细表 ==========
CREATE TABLE IF NOT EXISTS `product_bundle_item` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bundle_id` INT NOT NULL COMMENT '套装ID',
  `sku_id` INT NOT NULL COMMENT '商品SKU ID',
  `sku_name` VARCHAR(128) NOT NULL COMMENT 'SKU名称',
  `barcode` VARCHAR(64) DEFAULT NULL COMMENT '条码',
  `qty` INT NOT NULL DEFAULT 1 COMMENT '数量',
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '单品价格',
  `subtotal_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '小计价格',
  `cost_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '成本价',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_bundle_id` (`bundle_id`),
  KEY `idx_sku_id` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='套装商品明细表';

-- ========== 组合品表 ==========
CREATE TABLE IF NOT EXISTS `combo_product` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `combo_no` VARCHAR(32) NOT NULL COMMENT '组合品编号',
  `combo_name` VARCHAR(128) NOT NULL COMMENT '组合品名称',
  `combo_type` VARCHAR(20) NOT NULL DEFAULT 'FIXED' COMMENT '组合类型：FIXED=固定组合 OPTIONAL=可选组合',
  `category_id` INT DEFAULT NULL COMMENT '分类ID',
  `cover_image` VARCHAR(255) DEFAULT NULL COMMENT '封面图',
  `description` TEXT DEFAULT NULL COMMENT '描述',
  `base_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '基础价格',
  `min_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '最低价格',
  `max_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '最高价格',
  `status` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '状态：0=停用 1=启用',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_combo_no_tenant` (`combo_no`, `tenant_id`),
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_combo_type` (`combo_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='组合品表';

-- ========== 组合品可选项目表 ==========
CREATE TABLE IF NOT EXISTS `combo_product_option` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `combo_id` INT NOT NULL COMMENT '组合品ID',
  `group_name` VARCHAR(64) NOT NULL COMMENT '选项组名称',
  `sku_id` INT NOT NULL COMMENT '商品SKU ID',
  `sku_name` VARCHAR(128) NOT NULL COMMENT 'SKU名称',
  `barcode` VARCHAR(64) DEFAULT NULL COMMENT '条码',
  `extra_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '加价金额',
  `is_required` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否必选：0=否 1=是',
  `is_default` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否默认选中：0=否 1=是',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_combo_id` (`combo_id`),
  KEY `idx_sku_id` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='组合品可选项目表';

-- ========== 报损单表 ==========
CREATE TABLE IF NOT EXISTS `inventory_loss_order` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `loss_no` VARCHAR(32) NOT NULL COMMENT '报损单号',
  `store_id` INT NOT NULL COMMENT '仓库/门店ID',
  `store_name` VARCHAR(64) DEFAULT NULL COMMENT '仓库/门店名称',
  `loss_type` VARCHAR(32) NOT NULL DEFAULT 'NORMAL' COMMENT '报损类型：NORMAL=正常报损 DAMAGE=破损 EXPIRED=过期 OTHER=其他',
  `total_qty` INT NOT NULL DEFAULT 0 COMMENT '报损总数量',
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '报损总金额',
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT=草稿 PENDING=待审核 APPROVED=已审核 REJECTED=已驳回',
  `reason` VARCHAR(512) DEFAULT NULL COMMENT '报损原因',
  `reject_reason` VARCHAR(512) DEFAULT NULL COMMENT '驳回原因',
  `operator_id` INT DEFAULT NULL COMMENT '制单人ID',
  `operator_name` VARCHAR(64) DEFAULT NULL COMMENT '制单人姓名',
  `auditor_id` INT DEFAULT NULL COMMENT '审核人ID',
  `auditor_name` VARCHAR(64) DEFAULT NULL COMMENT '审核人姓名',
  `audited_at` DATETIME DEFAULT NULL COMMENT '审核时间',
  `remark` VARCHAR(512) DEFAULT NULL COMMENT '备注',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_loss_no_tenant` (`loss_no`, `tenant_id`),
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报损单表';

-- ========== 报损单明细表 ==========
CREATE TABLE IF NOT EXISTS `inventory_loss_order_item` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `loss_order_id` INT NOT NULL COMMENT '报损单ID',
  `loss_no` VARCHAR(32) NOT NULL COMMENT '报损单号',
  `sku_id` INT NOT NULL COMMENT '商品SKU ID',
  `sku_name` VARCHAR(128) NOT NULL COMMENT 'SKU名称',
  `barcode` VARCHAR(64) DEFAULT NULL COMMENT '条码',
  `specification` VARCHAR(128) DEFAULT NULL COMMENT '规格',
  `unit_name` VARCHAR(32) DEFAULT NULL COMMENT '单位',
  `qty` INT NOT NULL DEFAULT 0 COMMENT '报损数量',
  `cost_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '成本单价',
  `subtotal_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '小计金额',
  `loss_reason` VARCHAR(255) DEFAULT NULL COMMENT '报损原因明细',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_loss_order_id` (`loss_order_id`),
  KEY `idx_loss_no` (`loss_no`),
  KEY `idx_sku_id` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报损单明细表';

-- ========== 报溢单表 ==========
CREATE TABLE IF NOT EXISTS `inventory_profit_order` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `profit_no` VARCHAR(32) NOT NULL COMMENT '报溢单号',
  `store_id` INT NOT NULL COMMENT '仓库/门店ID',
  `store_name` VARCHAR(64) DEFAULT NULL COMMENT '仓库/门店名称',
  `profit_type` VARCHAR(32) NOT NULL DEFAULT 'NORMAL' COMMENT '报溢类型：NORMAL=正常报溢 COUNT_DIFF=盘点差异 OTHER=其他',
  `total_qty` INT NOT NULL DEFAULT 0 COMMENT '报溢总数量',
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '报溢总金额',
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT=草稿 PENDING=待审核 APPROVED=已审核 REJECTED=已驳回',
  `reason` VARCHAR(512) DEFAULT NULL COMMENT '报溢原因',
  `reject_reason` VARCHAR(512) DEFAULT NULL COMMENT '驳回原因',
  `operator_id` INT DEFAULT NULL COMMENT '制单人ID',
  `operator_name` VARCHAR(64) DEFAULT NULL COMMENT '制单人姓名',
  `auditor_id` INT DEFAULT NULL COMMENT '审核人ID',
  `auditor_name` VARCHAR(64) DEFAULT NULL COMMENT '审核人姓名',
  `audited_at` DATETIME DEFAULT NULL COMMENT '审核时间',
  `remark` VARCHAR(512) DEFAULT NULL COMMENT '备注',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_profit_no_tenant` (`profit_no`, `tenant_id`),
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报溢单表';

-- ========== 报溢单明细表 ==========
CREATE TABLE IF NOT EXISTS `inventory_profit_order_item` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `profit_order_id` INT NOT NULL COMMENT '报溢单ID',
  `profit_no` VARCHAR(32) NOT NULL COMMENT '报溢单号',
  `sku_id` INT NOT NULL COMMENT '商品SKU ID',
  `sku_name` VARCHAR(128) NOT NULL COMMENT 'SKU名称',
  `barcode` VARCHAR(64) DEFAULT NULL COMMENT '条码',
  `specification` VARCHAR(128) DEFAULT NULL COMMENT '规格',
  `unit_name` VARCHAR(32) DEFAULT NULL COMMENT '单位',
  `qty` INT NOT NULL DEFAULT 0 COMMENT '报溢数量',
  `cost_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '成本单价',
  `subtotal_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '小计金额',
  `profit_reason` VARCHAR(255) DEFAULT NULL COMMENT '报溢原因明细',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_profit_order_id` (`profit_order_id`),
  KEY `idx_profit_no` (`profit_no`),
  KEY `idx_sku_id` (`sku_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报溢单明细表';
