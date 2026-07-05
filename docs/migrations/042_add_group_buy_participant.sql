-- 编号: 042, 描述: 添加团购参与者表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS group_buy_participant (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL COMMENT '拼团记录ID',
  user_id INT NOT NULL COMMENT '用户ID',
  order_no VARCHAR(64) COMMENT '关联订单号',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '参与时间',
  
  INDEX idx_group (group_id),
  INDEX idx_user (user_id),
  FOREIGN KEY (group_id) REFERENCES group_buy_record(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拼团参与记录表';