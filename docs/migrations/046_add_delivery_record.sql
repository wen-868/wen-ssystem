-- 编号: 046, 描述: 添加配送记录表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS delivery_record (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL COMMENT '订单ID',
  delivery_no VARCHAR(32) COMMENT '配送单号',
  delivery_type VARCHAR(16) NOT NULL COMMENT '配送类型',
  rider_name VARCHAR(64) COMMENT '骑手姓名',
  rider_phone VARCHAR(20) COMMENT '骑手电话',
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态（PENDING/ASSIGNED/PICKED_UP/DELIVERING/COMPLETED）',
  picked_up_at DATETIME COMMENT '取货时间',
  delivered_at DATETIME COMMENT '送达时间',
  delivery_latitude DECIMAL(10,6) COMMENT '骑手纬度',
  delivery_longitude DECIMAL(10,6) COMMENT '骑手经度',
  remark VARCHAR(500) COMMENT '备注',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_order (order_id),
  INDEX idx_delivery_no (delivery_no),
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status),
  KEY idx_delivery_record_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配送记录表';