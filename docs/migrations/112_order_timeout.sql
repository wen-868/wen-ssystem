-- ============================================================================
-- 订单超时自动处理 - 数据库迁移
-- 版本：112
-- 日期：2026-07-15
-- 说明：新增 order_timeout_config（超时配置表）和 order_timeout_log（超时处理日志表）
-- ============================================================================

-- 订单超时配置表
CREATE TABLE IF NOT EXISTS `t_order_timeout_config` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_type` VARCHAR(20) NOT NULL COMMENT '订单类型：SALE=销售单 PURCHASE=采购单',
  `timeout_type` VARCHAR(30) NOT NULL COMMENT '超时类型：WAIT_PAY=待付款 WAIT_ACCEPT=待接单 WAIT_SIGN=待签收 WAIT_CONFIRM=待确认',
  `timeout_minutes` INT NOT NULL COMMENT '超时分钟数',
  `action` VARCHAR(20) NOT NULL COMMENT '超时动作：CANCEL=自动取消 AUTO_ACCEPT=自动接单 AUTO_SIGN=自动签收',
  `enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用：1=启用 0=禁用',
  `description` VARCHAR(255) DEFAULT NULL COMMENT '配置说明',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_enabled` (`tenant_id`, `enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单超时配置表';

-- 订单超时处理日志表
CREATE TABLE IF NOT EXISTS `t_order_timeout_log` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_id` INT NOT NULL COMMENT '订单ID',
  `order_type` VARCHAR(20) NOT NULL COMMENT '订单类型',
  `timeout_type` VARCHAR(30) NOT NULL COMMENT '超时类型',
  `action_taken` VARCHAR(20) NOT NULL COMMENT '执行动作',
  `triggered_at` DATETIME NOT NULL COMMENT '触发时间',
  `handled_at` DATETIME NOT NULL COMMENT '处理时间',
  `result` VARCHAR(10) NOT NULL COMMENT '处理结果：SUCCESS=成功 FAILED=失败',
  `remark` TEXT DEFAULT NULL COMMENT '备注',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_order_timeout` (`order_id`, `timeout_type`),
  KEY `idx_tenant_triggered` (`tenant_id`, `triggered_at`),
  KEY `idx_result` (`result`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单超时处理日志表';
