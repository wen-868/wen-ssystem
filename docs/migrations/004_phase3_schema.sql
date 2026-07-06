-- 编号: 004, 描述: 第3阶段数据库建表, 创建人: 阿坚, 日期: 2026-07-06

-- ============================================
-- 智享酒水库存系统 - 第 3 阶段 报表与预警
-- 新增：预警记录表、预警规则表
-- ============================================

USE liquor_inventory;

SET FOREIGN_KEY_CHECKS = 0;

-- ========== 预警管理 ==========

DROP TABLE IF EXISTS alert_rule;
DROP TABLE IF EXISTS alert_record;

CREATE TABLE alert_rule (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '预警规则ID',
  rule_code VARCHAR(64) NOT NULL COMMENT '规则编码',
  rule_name VARCHAR(128) NOT NULL COMMENT '规则名称',
  rule_type VARCHAR(32) NOT NULL COMMENT '规则类型：STOCK_LOW(安全库存)/EXPIRY(保质期)/CREDIT(信用额度)/OVERDUE(回款逾期)/STOCK_OVERSTOCK(库存积压)',
  enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用：1启用，0停用',
  threshold_value DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '阈值',
  threshold_unit VARCHAR(32) NOT NULL DEFAULT 'DAYS' COMMENT '阈值单位：DAYS(天)/PERCENT(百分比)/BOTTLES(瓶)/AMOUNT(金额)',
  extra_config JSON DEFAULT NULL COMMENT '额外配置（JSON格式）',
  description VARCHAR(255) DEFAULT NULL COMMENT '规则描述',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_alert_rule_code (rule_code),
  KEY idx_alert_rule_type (rule_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警规则表';

CREATE TABLE alert_record (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '预警记录ID',
  alert_no VARCHAR(64) NOT NULL COMMENT '预警编号',
  rule_id BIGINT UNSIGNED NOT NULL COMMENT '预警规则ID',
  rule_type VARCHAR(32) NOT NULL COMMENT '预警类型：STOCK_LOW/EXPIRY/CREDIT/OVERDUE/STOCK_OVERSTOCK',
  alert_level VARCHAR(16) NOT NULL DEFAULT 'WARNING' COMMENT '预警级别：INFO/WARNING/CRITICAL',
  title VARCHAR(255) NOT NULL COMMENT '预警标题',
  description TEXT DEFAULT NULL COMMENT '预警描述',
  biz_type VARCHAR(64) DEFAULT NULL COMMENT '业务对象类型：SKU/CUSTOMER/SUPPLIER/BILL',
  biz_id BIGINT UNSIGNED DEFAULT NULL COMMENT '业务对象ID',
  biz_no VARCHAR(64) DEFAULT NULL COMMENT '业务对象编号',
  current_value DECIMAL(12,2) DEFAULT NULL COMMENT '当前值',
  threshold_value DECIMAL(12,2) DEFAULT NULL COMMENT '阈值',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING(待处理)/HANDLED(已处理)/IGNORED(已忽略)',
  handler_id BIGINT UNSIGNED DEFAULT NULL COMMENT '处理人ID',
  handler_name VARCHAR(64) DEFAULT NULL COMMENT '处理人姓名',
  handle_time DATETIME DEFAULT NULL COMMENT '处理时间',
  handle_remark VARCHAR(255) DEFAULT NULL COMMENT '处理备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_alert_record_no (alert_no),
  KEY idx_alert_record_rule (rule_id, rule_type),
  KEY idx_alert_record_status (status),
  KEY idx_alert_record_biz (biz_type, biz_id),
  KEY idx_alert_record_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警记录表';

-- ========== 默认预警规则 ==========

INSERT INTO alert_rule (rule_code, rule_name, rule_type, enabled, threshold_value, threshold_unit, extra_config, description) VALUES
('STOCK_LOW', '安全库存预警', 'STOCK_LOW', 1, 0, 'BOTTLES', '{"use_warning_threshold": true}', '商品可用库存低于安全库存值时触发预警'),
('EXPIRY_90', '保质期预警-90天', 'EXPIRY', 1, 90, 'DAYS', NULL, '商品有效期在90天内到期时触发预警'),
('EXPIRY_30', '保质期预警-30天', 'EXPIRY', 1, 30, 'DAYS', NULL, '商品有效期在30天内到期时触发预警'),
('EXPIRY_7', '保质期预警-7天', 'EXPIRY', 1, 7, 'DAYS', NULL, '商品有效期在7天内到期时触发预警'),
('CREDIT_LIMIT', '信用额度预警', 'CREDIT', 1, 90, 'PERCENT', NULL, '客户欠款达到信用额度的90%时触发预警'),
('PAYMENT_OVERDUE', '回款逾期预警', 'OVERDUE', 1, 0, 'DAYS', NULL, '超过账期未回款时触发预警'),
('STOCK_OVERSTOCK', '库存积压预警', 'STOCK_OVERSTOCK', 1, 180, 'DAYS', NULL, '库龄超过180天的库存触发预警');

SET FOREIGN_KEY_CHECKS = 1;
