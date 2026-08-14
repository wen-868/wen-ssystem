CREATE TABLE IF NOT EXISTS t_price_review (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '核价单ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  review_no VARCHAR(64) NOT NULL COMMENT '核价单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  spu_id BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  product_name VARCHAR(128) NOT NULL COMMENT '商品名称',
  sku_name VARCHAR(128) DEFAULT NULL COMMENT 'SKU名称',
  spec VARCHAR(256) DEFAULT NULL COMMENT '规格',
  current_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '当前售价',
  suggested_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '建议售价',
  reason VARCHAR(500) DEFAULT NULL COMMENT '核价原因',
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/APPROVED/REJECTED',
  created_by BIGINT DEFAULT NULL COMMENT '提交人ID',
  created_by_name VARCHAR(64) DEFAULT NULL COMMENT '提交人姓名',
  reviewed_by BIGINT DEFAULT NULL COMMENT '核价人ID',
  reviewed_by_name VARCHAR(64) DEFAULT NULL COMMENT '核价人姓名',
  reviewed_at DATETIME DEFAULT NULL COMMENT '核价时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_price_review_no (review_no, tenant_id),
  KEY idx_price_review_status (tenant_id, status),
  KEY idx_price_review_sku (sku_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='建议核价单表';

-- 编号: 146, 描述: 建议核价单表（移动端「建议核价」功能存储）
-- 创建人: 凌舟, 日期: 2026-08-14
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
