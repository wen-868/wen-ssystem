-- 编号: 033, 描述: 添加订阅操作日志表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_subscription_operation_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL COMMENT '订阅ID',
  operation_type VARCHAR(32) NOT NULL COMMENT '操作类型（CREATE/RENEW/UPGRADE/DOWNGRADE/CANCEL/SUSPEND/RESUME）',
  old_plan_id INT COMMENT '原套餐ID',
  new_plan_id INT COMMENT '新套餐ID',
  old_end_date DATE COMMENT '原结束日期',
  new_end_date DATE COMMENT '新结束日期',
  amount DECIMAL(10,2) COMMENT '涉及金额',
  operator_id INT COMMENT '操作人ID',
  operator_name VARCHAR(64) COMMENT '操作人姓名',
  remark VARCHAR(500) COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_log_subscription (subscription_id),
  INDEX idx_log_operation (operation_type),
  INDEX idx_log_created (created_at),
  
  FOREIGN KEY (subscription_id) REFERENCES subscription(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订阅操作日志表';