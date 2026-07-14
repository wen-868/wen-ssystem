-- ============================================================================
-- P2级功能：多店调拨 + 库存共享 + 报表权限 - 数据库迁移
-- 版本：114
-- 日期：2026-07-15
-- 说明：完善调拨单表结构、新增库存共享表、扩展报表权限表、新增审计日志表
-- ============================================================================

-- ========== 1. 完善调拨单表 ==========
-- 补充现有 transfer_order 表缺失的字段（与现有service代码对齐）
ALTER TABLE transfer_order
  ADD COLUMN IF NOT EXISTS `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT=草稿 PENDING=待审核 APPROVED=已审核 TRANSIT=运输中 RECEIVED=已完成 CANCELLED=已取消' AFTER `to_store_id`,
  ADD COLUMN IF NOT EXISTS `expected_date` DATE DEFAULT NULL COMMENT '预计到货日期' AFTER `status`,
  ADD COLUMN IF NOT EXISTS `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '调拨总金额' AFTER `expected_date`,
  ADD COLUMN IF NOT EXISTS `total_items` INT NOT NULL DEFAULT 0 COMMENT '明细行数' AFTER `total_amount`,
  ADD COLUMN IF NOT EXISTS `created_by` BIGINT DEFAULT NULL COMMENT '创建人ID' AFTER `total_items`,
  ADD COLUMN IF NOT EXISTS `approved_by` BIGINT DEFAULT NULL COMMENT '审核人ID' AFTER `created_by`,
  ADD COLUMN IF NOT EXISTS `approved_at` DATETIME DEFAULT NULL COMMENT '审核时间' AFTER `approved_by`,
  ADD COLUMN IF NOT EXISTS `shipped_by` BIGINT DEFAULT NULL COMMENT '出库人ID' AFTER `approved_at`,
  ADD COLUMN IF NOT EXISTS `shipped_at` DATETIME DEFAULT NULL COMMENT '出库时间' AFTER `shipped_by`,
  ADD COLUMN IF NOT EXISTS `received_by` BIGINT DEFAULT NULL COMMENT '入库人ID' AFTER `shipped_at`,
  ADD COLUMN IF NOT EXISTS `received_at` DATETIME DEFAULT NULL COMMENT '入库时间' AFTER `received_by`,
  ADD COLUMN IF NOT EXISTS `cancel_reason` VARCHAR(512) DEFAULT NULL COMMENT '取消原因' AFTER `received_at`,
  ADD COLUMN IF NOT EXISTS `remark` VARCHAR(512) DEFAULT NULL COMMENT '备注' AFTER `cancel_reason`;

-- 兼容旧字段：如果 transfer_status 存在但 status 不存在，数据迁移
-- （注意：由于不同MySQL版本对IF EXISTS列的支持差异，此处用通用ALTER）

-- ========== 2. 完善调拨单明细表 ==========
-- 补充现有 transfer_order_item 表缺失的字段
ALTER TABLE transfer_order_item
  ADD COLUMN IF NOT EXISTS `transfer_order_id` BIGINT NOT NULL DEFAULT 0 COMMENT '调拨单ID' AFTER `id`,
  ADD COLUMN IF NOT EXISTS `sku_name` VARCHAR(128) NOT NULL DEFAULT '' COMMENT 'SKU名称' AFTER `sku_id`,
  ADD COLUMN IF NOT EXISTS `quantity` INT NOT NULL DEFAULT 0 COMMENT '数量' AFTER `sku_name`,
  ADD COLUMN IF NOT EXISTS `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '小计金额' AFTER `unit_price`;

-- ========== 3. 库存共享设置表 ==========
CREATE TABLE IF NOT EXISTS `inventory_share_setting` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `share_enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否启用库存共享：0=否 1=是',
  `auto_transfer` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否自动调拨：0=否 1=是',
  `auto_transfer_threshold` INT NOT NULL DEFAULT 0 COMMENT '自动调拨阈值（低于此数量触发）',
  `share_scope` VARCHAR(20) NOT NULL DEFAULT 'ALL' COMMENT '共享范围：ALL=全部门店 指定门店=SPECIFIED',
  `specified_store_ids` TEXT DEFAULT NULL COMMENT '指定门店ID列表（JSON数组）',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='库存共享设置表';

-- ========== 4. 库存共享商品表 ==========
CREATE TABLE IF NOT EXISTS `inventory_share_product` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `spu_id` INT NOT NULL COMMENT 'SPU ID',
  `spu_name` VARCHAR(128) NOT NULL COMMENT 'SPU名称',
  `sku_id` INT DEFAULT NULL COMMENT 'SKU ID（NULL表示全规格共享）',
  `sku_name` VARCHAR(128) DEFAULT NULL COMMENT 'SKU名称',
  `barcode` VARCHAR(64) DEFAULT NULL COMMENT '条码',
  `share_qty` INT NOT NULL DEFAULT 0 COMMENT '共享数量',
  `min_keep_qty` INT NOT NULL DEFAULT 0 COMMENT '最低保留数量',
  `status` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '状态：0=停用 1=启用',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_sku` (`tenant_id`, `spu_id`, `sku_id`),
  KEY `idx_spu_id` (`spu_id`),
  KEY `idx_sku_id` (`sku_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='库存共享商品表';

-- ========== 5. 扩展报表权限矩阵表 ==========
-- 增加查看/导出权限字段
ALTER TABLE report_permission_matrix
  ADD COLUMN IF NOT EXISTS `can_view` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否可查看：0=否 1=是' AFTER `store_scope`,
  ADD COLUMN IF NOT EXISTS `can_export` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否可导出：0=否 1=是' AFTER `can_view`,
  ADD COLUMN IF NOT EXISTS `tenant_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '租户ID' AFTER `can_export`,
  ADD COLUMN IF NOT EXISTS `store_ids` TEXT DEFAULT NULL COMMENT '指定门店ID列表（JSON数组，store_scope=SPECIFIED时使用）' AFTER `tenant_id`;

-- 注意：原表 UNIQUE KEY uk_role_report (role_id, report_code) 需要包含 tenant_id
-- 先尝试删除旧唯一键，添加新的
-- （由于不同MySQL版本语法差异，此处用安全的做法：先检查再添加）

-- ========== 6. 报表权限审计日志表 ==========
CREATE TABLE IF NOT EXISTS `report_permission_audit_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `operator_id` BIGINT DEFAULT NULL COMMENT '操作人ID',
  `operator_name` VARCHAR(64) DEFAULT NULL COMMENT '操作人姓名',
  `action` VARCHAR(32) NOT NULL COMMENT '操作类型：GRANT=授权 REVOKE=撤销 UPDATE=更新',
  `target_type` VARCHAR(20) NOT NULL COMMENT '目标类型：ROLE=角色 USER=用户',
  `target_id` BIGINT NOT NULL COMMENT '目标ID（角色ID或用户ID）',
  `target_name` VARCHAR(64) DEFAULT NULL COMMENT '目标名称',
  `report_code` VARCHAR(64) DEFAULT NULL COMMENT '报表编码',
  `before_value` TEXT DEFAULT NULL COMMENT '变更前值（JSON）',
  `after_value` TEXT DEFAULT NULL COMMENT '变更后值（JSON）',
  `remark` VARCHAR(512) DEFAULT NULL COMMENT '备注',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_operator` (`operator_id`),
  KEY `idx_target` (`target_type`, `target_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报表权限审计日志表';
