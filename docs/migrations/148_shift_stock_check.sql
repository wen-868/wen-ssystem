CREATE TABLE IF NOT EXISTS t_shift (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '交接班ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  shift_no VARCHAR(64) NOT NULL COMMENT '交接班单号',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  operator_id BIGINT DEFAULT NULL COMMENT '操作员ID',
  operator_name VARCHAR(64) DEFAULT NULL COMMENT '操作员姓名',
  start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  end_time DATETIME DEFAULT NULL COMMENT '结束时间',
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN' COMMENT '状态：OPEN/CLOSED',
  opening_cash DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '接班备用金',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_shift_no (shift_no, tenant_id),
  KEY idx_shift_store_status (tenant_id, store_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交接班记录表';

CREATE TABLE IF NOT EXISTS t_shift_stock_check (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '盘点明细ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  shift_no VARCHAR(64) NOT NULL COMMENT '交接班单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  expected_qty DECIMAL(12,3) NOT NULL DEFAULT 0 COMMENT '账面数量',
  actual_qty DECIMAL(12,3) NOT NULL DEFAULT 0 COMMENT '实盘数量',
  diff_qty DECIMAL(12,3) NOT NULL DEFAULT 0 COMMENT '差异数量',
  diff_reason VARCHAR(200) DEFAULT NULL COMMENT '差异原因',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_shift_sku (shift_no, sku_id, tenant_id),
  KEY idx_shift_check_sku (sku_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交接班盘点明细表';

-- 编号: 148, 描述: 交接班记录表 + 交接班盘点明细表（移动端交接班/盘点功能存储）
-- 创建人: 凌舟, 日期: 2026-08-15
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
