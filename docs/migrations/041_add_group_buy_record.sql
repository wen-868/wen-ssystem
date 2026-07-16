-- 编号: 041, 描述: 添加团购记录表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_group_buy_record (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_no VARCHAR(32) NOT NULL UNIQUE COMMENT '团号',
  activity_id INT NOT NULL COMMENT '活动ID',
  product_id INT NOT NULL COMMENT '商品ID',
  leader_user_id INT NOT NULL COMMENT '团长用户ID',
  group_size INT NOT NULL COMMENT '成团人数',
  current_size INT NOT NULL DEFAULT 1 COMMENT '当前人数',
  group_price DECIMAL(10,2) NOT NULL COMMENT '拼团价格',
  status VARCHAR(16) NOT NULL DEFAULT 'FORMING' COMMENT '状态（FORMING/SUCCESS/FAILED/CANCELLED）',
  expire_at DATETIME NOT NULL COMMENT '过期时间',
  success_at DATETIME COMMENT '成团时间',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_group_no (group_no),
  INDEX idx_activity (activity_id),
  INDEX idx_leader (leader_user_id),
  INDEX idx_status (status),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拼团记录表';