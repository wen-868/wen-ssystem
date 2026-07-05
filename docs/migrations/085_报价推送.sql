-- 编号: 085, 描述: 报价推送, 创建人: 阿坚, 日期: 2026-07-05
-- 执行时间：2026-06-27
-- 负责人：阿坚

USE liquor_inventory;

-- 报价单主表
DROP TABLE IF EXISTS customer_quote_item;
DROP TABLE IF EXISTS customer_quote_push_log;
DROP TABLE IF EXISTS customer_quote;

CREATE TABLE customer_quote (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '报价单ID',
  quote_no VARCHAR(32) NOT NULL COMMENT '报价单号',
  title VARCHAR(200) NOT NULL COMMENT '报价单标题',
  customer_id BIGINT UNSIGNED NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(100) NOT NULL COMMENT '客户名称（冗余）',
  customer_phone VARCHAR(20) DEFAULT NULL COMMENT '客户电话（冗余）',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE有效/CANCELLED已取消/EXPIRED已过期',
  valid_days INT NOT NULL DEFAULT 7 COMMENT '有效期(天)',
  expire_at DATETIME NOT NULL COMMENT '过期时间',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '总金额',
  total_sku INT NOT NULL DEFAULT 0 COMMENT 'SKU数量',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  view_count INT NOT NULL DEFAULT 0 COMMENT '浏览次数',
  created_by BIGINT UNSIGNED NOT NULL COMMENT '创建人ID',
  share_token VARCHAR(64) DEFAULT NULL COMMENT '分享令牌',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_quote_no (quote_no, tenant_id),
  UNIQUE KEY uk_share_token (share_token),
  KEY idx_customer_id (customer_id, tenant_id),
  KEY idx_status (status, tenant_id),
  KEY idx_created_at (created_at, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户报价单';

-- 报价单明细表
CREATE TABLE customer_quote_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '明细ID',
  quote_id BIGINT UNSIGNED NOT NULL COMMENT '报价单ID',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(200) NOT NULL COMMENT 'SKU名称（冗余）',
  quote_price DECIMAL(12,2) NOT NULL COMMENT '报价',
  min_qty INT NOT NULL DEFAULT 1 COMMENT '最小起订量',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_quote_id (quote_id, tenant_id),
  KEY idx_sku_id (sku_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价单明细';

-- 报价推送日志表
CREATE TABLE customer_quote_push_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  quote_id BIGINT UNSIGNED NOT NULL COMMENT '报价单ID',
  channel VARCHAR(20) NOT NULL COMMENT '推送渠道：sms/miniapp/email',
  content VARCHAR(500) DEFAULT NULL COMMENT '推送内容',
  target VARCHAR(100) DEFAULT NULL COMMENT '推送目标（手机号/OpenID/邮箱）',
  status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' COMMENT '状态：SUCCESS成功/FAILED失败',
  error_msg VARCHAR(500) DEFAULT NULL COMMENT '错误信息',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_quote_id (quote_id, tenant_id),
  KEY idx_created_at (created_at, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价推送日志';

-- 批量价格调整日志增加 batch_no 字段（如果不存在）
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'product_price_log'
    AND COLUMN_NAME = 'batch_no'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE product_price_log ADD COLUMN batch_no VARCHAR(32) DEFAULT NULL COMMENT ''批量调整批次号'' AFTER action_type, ADD INDEX idx_batch_no (batch_no, tenant_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 批量价格调整日志增加 change_reason 字段
SET @col2_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'product_price_log'
    AND COLUMN_NAME = 'change_reason'
);
SET @sql2 = IF(@col2_exists = 0,
  'ALTER TABLE product_price_log ADD COLUMN change_reason VARCHAR(255) DEFAULT NULL COMMENT ''变更原因'' AFTER action_type',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SELECT '一键报价推送数据库表创建完成' AS result;