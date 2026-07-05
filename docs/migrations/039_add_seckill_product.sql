-- 编号: 039, 描述: 添加秒杀商品表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS seckill_product (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_id INT NOT NULL COMMENT '活动ID',
  product_id INT NOT NULL COMMENT '商品ID',
  seckill_price DECIMAL(10,2) NOT NULL COMMENT '秒杀价格',
  original_price DECIMAL(10,2) NOT NULL COMMENT '原价',
  total_stock INT NOT NULL COMMENT '秒杀总库存',
  available_stock INT NOT NULL COMMENT '剩余库存',
  limit_per_user INT NOT NULL DEFAULT 1 COMMENT '每人限购数量',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_activity_product (activity_id, product_id),
  INDEX idx_activity (activity_id),
  INDEX idx_product (product_id),
  FOREIGN KEY (activity_id) REFERENCES promotion_activity(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='秒杀商品表';