-- 编号: 127, 描述: 订单路由规则与订单异常表（商用化补全，R100）, 创建人: 凌舟, 日期: 2026-08-10
-- 说明: 订单路由/异常页面所需存储，幂等可重复执行
CREATE TABLE IF NOT EXISTS t_order_routing_rule (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '规则ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  rule_name VARCHAR(128) NOT NULL COMMENT '规则名称',
  channel_type VARCHAR(32) NOT NULL COMMENT '渠道类型',
  store_id BIGINT DEFAULT NULL COMMENT '目标门店ID',
  store_name VARCHAR(128) DEFAULT NULL COMMENT '目标门店名称',
  priority INT NOT NULL DEFAULT 0 COMMENT '优先级',
  condition_summary VARCHAR(500) DEFAULT NULL COMMENT '条件摘要',
  action_type VARCHAR(32) NOT NULL DEFAULT 'ASSIGN_STORE' COMMENT '动作类型',
  is_enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rule_tenant_channel (tenant_id, channel_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单路由规则表';

CREATE TABLE IF NOT EXISTS t_order_exception (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '异常ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  exception_no VARCHAR(64) NOT NULL COMMENT '异常编号',
  exception_level VARCHAR(16) NOT NULL DEFAULT 'WARNING' COMMENT '级别：WARNING/ERROR/CRITICAL',
  channel_order_no VARCHAR(64) DEFAULT NULL COMMENT '渠道订单号',
  channel_type VARCHAR(32) DEFAULT NULL COMMENT '渠道类型',
  exception_type VARCHAR(32) NOT NULL DEFAULT 'OTHER' COMMENT '异常类型',
  exception_detail VARCHAR(1000) DEFAULT NULL COMMENT '异常详情',
  handle_status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/PROCESSING/RESOLVED/CLOSED',
  handler_id BIGINT DEFAULT NULL COMMENT '处理人ID',
  handler_name VARCHAR(64) DEFAULT NULL COMMENT '处理人姓名',
  handle_result VARCHAR(1000) DEFAULT NULL COMMENT '处理结果',
  handled_at DATETIME DEFAULT NULL COMMENT '处理时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_exception_no (exception_no, tenant_id),
  KEY idx_exception_status (tenant_id, handle_status),
  KEY idx_exception_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单异常记录表';

CREATE TABLE IF NOT EXISTS t_order_exception_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  exception_id BIGINT NOT NULL COMMENT '异常ID',
  handler_name VARCHAR(64) DEFAULT NULL COMMENT '处理人',
  action VARCHAR(64) NOT NULL COMMENT '动作',
  result VARCHAR(500) DEFAULT NULL COMMENT '结果',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_exception_log (exception_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单异常处理日志表';
