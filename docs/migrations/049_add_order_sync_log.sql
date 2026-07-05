-- 编号: 049, 描述: 添加订单同步日志表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS miniapp_order_sync_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(64) NOT NULL COMMENT '订单号',
  platform VARCHAR(32) NOT NULL COMMENT '平台',
  sync_type VARCHAR(32) NOT NULL COMMENT '同步类型：STATUS/SKU/PRICE/STOCK',
  sync_direction VARCHAR(32) NOT NULL COMMENT '方向：PUSH_TO_PLATFORM/PULL_FROM_PLATFORM',
  request_data JSON DEFAULT NULL COMMENT '请求数据',
  response_data JSON DEFAULT NULL COMMENT '响应数据',
  status VARCHAR(32) NOT NULL COMMENT '状态：SUCCESS/FAILED',
  error_msg VARCHAR(512) DEFAULT NULL COMMENT '错误信息',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_order_no (order_no),
  INDEX idx_platform (platform),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序订单同步日志表';