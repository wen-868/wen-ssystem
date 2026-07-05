-- 编号: 030, 描述: 添加订阅计划表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS subscription_plan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plan_code VARCHAR(32) NOT NULL UNIQUE COMMENT '套餐编码（如：BASIC/STANDARD/PROFESSIONAL）',
  plan_name VARCHAR(64) NOT NULL COMMENT '套餐名称',
  plan_type VARCHAR(32) NOT NULL COMMENT '套餐类型（MONTHLY/YEARLY/PERMANENT）',
  price DECIMAL(10,2) NOT NULL COMMENT '价格',
  original_price DECIMAL(10,2) COMMENT '原价',
  duration_days INT NOT NULL COMMENT '有效天数（如：30/365/9999）',
  max_users INT NOT NULL DEFAULT 5 COMMENT '最大用户数',
  max_stores INT NOT NULL DEFAULT 1 COMMENT '最大门店数',
  max_customers INT NOT NULL DEFAULT 1000 COMMENT '最大客户数',
  max_products INT NOT NULL DEFAULT 500 COMMENT '最大商品数',
  max_storage_mb INT NOT NULL DEFAULT 1024 COMMENT '最大存储空间（MB）',
  features JSON COMMENT '功能特性列表（JSON格式）',
  module_access JSON COMMENT '可访问模块（JSON格式，如：["sales","purchase","inventory"]）',
  description VARCHAR(500) COMMENT '套餐描述',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_plan_code (plan_code),
  INDEX idx_plan_status (status),
  INDEX idx_plan_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订阅套餐表';