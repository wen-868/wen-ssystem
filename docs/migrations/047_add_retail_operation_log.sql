-- 编号: 047, 描述: 添加零售操作日志表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_retail_operation_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module VARCHAR(32) NOT NULL COMMENT '模块（shop/category/product/order/delivery）',
  action VARCHAR(32) NOT NULL COMMENT '操作类型',
  target_id VARCHAR(64) NOT NULL COMMENT '目标ID',
  target_type VARCHAR(32) NOT NULL COMMENT '目标类型',
  user_id INT COMMENT '操作人ID',
  user_name VARCHAR(64) COMMENT '操作人姓名',
  detail VARCHAR(500) COMMENT '操作详情',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_module (module),
  INDEX idx_target (target_id, target_type),
  INDEX idx_tenant (tenant_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='即时零售操作日志表';