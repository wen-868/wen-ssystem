CREATE TABLE IF NOT EXISTS t_customer_points (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  total_points INT DEFAULT 0 COMMENT '累计积分',
  available_points INT DEFAULT 0 COMMENT '可用积分',
  frozen_points INT DEFAULT 0 COMMENT '冻结积分',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_customer (customer_id, tenant_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户积分';
CREATE TABLE IF NOT EXISTS t_points_record (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  record_no VARCHAR(32) NOT NULL COMMENT '记录编号',
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  type VARCHAR(20) NOT NULL COMMENT '类型: EARN/REDEEM/EXPIRE/ADJUST',
  points INT NOT NULL COMMENT '积分变动数',
  balance_after INT NOT NULL COMMENT '变动后余额',
  source_type VARCHAR(20) DEFAULT NULL COMMENT '来源类型',
  source_no VARCHAR(32) DEFAULT NULL COMMENT '来源单号',
  remark VARCHAR(200) DEFAULT NULL COMMENT '备注',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer (customer_id),
  INDEX idx_type (type),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分变动记录';
ALTER TABLE t_transfer_order ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT=草稿 PENDING=待审核 APPROVED=已审核 TRANSIT=运输中 RECEIVED=已完成 CANCELLED=已取消' AFTER `to_store_id`;
ALTER TABLE t_transfer_order ADD COLUMN `expected_date` DATE DEFAULT NULL COMMENT '预计到货日期' AFTER `status`;
ALTER TABLE t_transfer_order ADD COLUMN `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '调拨总金额' AFTER `expected_date`;
ALTER TABLE t_transfer_order ADD COLUMN `total_items` INT NOT NULL DEFAULT 0 COMMENT '明细行数' AFTER `total_amount`;
ALTER TABLE t_transfer_order ADD COLUMN `created_by` BIGINT DEFAULT NULL COMMENT '创建人ID' AFTER `total_items`;
ALTER TABLE t_transfer_order ADD COLUMN `approved_by` BIGINT DEFAULT NULL COMMENT '审核人ID' AFTER `created_by`;
ALTER TABLE t_transfer_order ADD COLUMN `approved_at` DATETIME DEFAULT NULL COMMENT '审核时间' AFTER `approved_by`;
ALTER TABLE t_transfer_order ADD COLUMN `shipped_by` BIGINT DEFAULT NULL COMMENT '出库人ID' AFTER `approved_at`;
ALTER TABLE t_transfer_order ADD COLUMN `shipped_at` DATETIME DEFAULT NULL COMMENT '出库时间' AFTER `shipped_by`;
ALTER TABLE t_transfer_order ADD COLUMN `received_by` BIGINT DEFAULT NULL COMMENT '入库人ID' AFTER `shipped_at`;
ALTER TABLE t_transfer_order ADD COLUMN `received_at` DATETIME DEFAULT NULL COMMENT '入库时间' AFTER `received_by`;
ALTER TABLE t_transfer_order ADD COLUMN `cancel_reason` VARCHAR(512) DEFAULT NULL COMMENT '取消原因' AFTER `received_at`;
ALTER TABLE t_transfer_order ADD COLUMN `remark` VARCHAR(512) DEFAULT NULL COMMENT '备注' AFTER `cancel_reason`;
ALTER TABLE t_transfer_order_item ADD COLUMN `transfer_order_id` BIGINT NOT NULL DEFAULT 0 COMMENT '调拨单ID' AFTER `id`;
ALTER TABLE t_transfer_order_item ADD COLUMN `sku_name` VARCHAR(128) NOT NULL DEFAULT '' COMMENT 'SKU名称' AFTER `sku_id`;
ALTER TABLE t_transfer_order_item ADD COLUMN `quantity` INT NOT NULL DEFAULT 0 COMMENT '数量' AFTER `sku_name`;
ALTER TABLE t_transfer_order_item ADD COLUMN `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '小计金额' AFTER `unit_price`;
CREATE INDEX idx_tto_status ON t_transfer_order (status);
CREATE INDEX idx_tto_item_order ON t_transfer_order_item (transfer_order_id);
-- 编号: 163, 描述: 生产库补表补列——071/114 迁移的语句块前带注释行, 启动迁移按分号拆分后以 -- 开头的块被整体丢弃,
-- 导致 t_points_record 表与 t_transfer_order/t_transfer_order_item 的新列在生产从未落地(调拨创建/积分调整/积分流水均 500)。
-- 本文件每条语句顶格书写(不以注释开头), 幂等可重复执行(safeExec 对 ER_DUP_FIELDNAME/表已存在 跳过)。
-- 内容 = 071 的两张积分表 CREATE IF NOT EXISTS + 114 的调拨补列 + 两个查询索引。创建人: 凌舟, 日期: 2026-09-05
