-- 编号: 018, 描述: 营销功能相关表, 创建人: 阿坚, 日期: 2026-07-06

-- ============================================================
-- 第四阶段：营销模块 - 数据库表设计
-- 任务ID: P3-01
-- 创建时间: 2026-06-23
-- ============================================================

-- 1. 优惠券模板表（coupon_template）
CREATE TABLE IF NOT EXISTS t_coupon_template (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_code VARCHAR(32) NOT NULL UNIQUE COMMENT '模板编码',
  template_name VARCHAR(128) NOT NULL COMMENT '模板名称',
  coupon_type VARCHAR(32) NOT NULL COMMENT '优惠券类型（AMOUNT/DISCOUNT/GIFT）',
  coupon_value DECIMAL(10,2) NOT NULL COMMENT '优惠值（金额/折扣率）',
  min_purchase DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '最低消费金额',
  max_discount DECIMAL(10,2) COMMENT '最大优惠金额（折扣券用）',
  applicable_scope VARCHAR(32) NOT NULL DEFAULT 'ALL' COMMENT '适用范围（ALL/CATEGORY/PRODUCT/STORE）',
  applicable_ids JSON COMMENT '适用范围ID列表（商品ID/分类ID/门店ID）',
  total_quantity INT NOT NULL DEFAULT 0 COMMENT '发行总量（0表示不限量）',
  issued_quantity INT NOT NULL DEFAULT 0 COMMENT '已发行数量',
  used_quantity INT NOT NULL DEFAULT 0 COMMENT '已使用数量',
  per_limit INT NOT NULL DEFAULT 1 COMMENT '每人限领数量',
  valid_type VARCHAR(32) NOT NULL COMMENT '有效期类型（FIXED/DAYS）',
  valid_start DATETIME COMMENT '固定开始时间',
  valid_end DATETIME COMMENT '固定结束时间',
  valid_days INT COMMENT '领取后有效天数',
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' COMMENT '状态（DRAFT/ACTIVE/PAUSED/EXPIRED/DEPLETED）',
  description VARCHAR(500) COMMENT '使用说明',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_by INT COMMENT '创建人ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_template_code (template_code),
  INDEX idx_template_status (status),
  INDEX idx_template_tenant (tenant_id),
  INDEX idx_template_valid (valid_start, valid_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优惠券模板表';

-- 2. 用户优惠券表（user_coupon）
CREATE TABLE IF NOT EXISTS t_user_coupon (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coupon_no VARCHAR(32) NOT NULL UNIQUE COMMENT '优惠券编号',
  template_id INT NOT NULL COMMENT '模板ID',
  user_id INT NOT NULL COMMENT '用户ID（客户ID）',
  coupon_type VARCHAR(32) NOT NULL COMMENT '优惠券类型',
  coupon_name VARCHAR(128) NOT NULL COMMENT '优惠券名称',
  coupon_value DECIMAL(10,2) NOT NULL COMMENT '优惠值',
  min_purchase DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '最低消费金额',
  max_discount DECIMAL(10,2) COMMENT '最大优惠金额',
  applicable_scope VARCHAR(32) NOT NULL COMMENT '适用范围',
  applicable_ids JSON COMMENT '适用范围ID列表',
  source VARCHAR(32) NOT NULL COMMENT '来源（RECEIVE/SEND/ACTIVITY）',
  status VARCHAR(16) NOT NULL DEFAULT 'UNUSED' COMMENT '状态（UNUSED/USED/EXPIRED/LOCKED）',
  valid_start DATETIME NOT NULL COMMENT '生效时间',
  valid_end DATETIME NOT NULL COMMENT '失效时间',
  used_at DATETIME COMMENT '使用时间',
  used_order_no VARCHAR(64) COMMENT '使用的订单号',
  used_amount DECIMAL(10,2) COMMENT '使用的订单金额',
  discount_amount DECIMAL(10,2) COMMENT '实际优惠金额',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_coupon_no (coupon_no),
  INDEX idx_template (template_id),
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_valid (valid_start, valid_end),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户优惠券表';

-- 3. 促销活动表（promotion_activity）
CREATE TABLE IF NOT EXISTS t_promotion_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_code VARCHAR(32) NOT NULL UNIQUE COMMENT '活动编码',
  activity_name VARCHAR(128) NOT NULL COMMENT '活动名称',
  activity_type VARCHAR(32) NOT NULL COMMENT '活动类型（FULL_REDUCTION/SECKILL/GROUP_BUY/GIFT）',
  activity_desc VARCHAR(500) COMMENT '活动描述',
  start_time DATETIME NOT NULL COMMENT '开始时间',
  end_time DATETIME NOT NULL COMMENT '结束时间',
  applicable_scope VARCHAR(32) NOT NULL DEFAULT 'ALL' COMMENT '适用范围（ALL/CATEGORY/PRODUCT/STORE）',
  applicable_ids JSON COMMENT '适用范围ID列表',
  rules JSON NOT NULL COMMENT '活动规则（JSON格式）',
  max_participants INT DEFAULT 0 COMMENT '最大参与人数（0表示不限制）',
  participant_count INT NOT NULL DEFAULT 0 COMMENT '已参与人数',
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' COMMENT '状态（DRAFT/ACTIVE/PAUSED/ENDED）',
  priority INT NOT NULL DEFAULT 0 COMMENT '优先级（数字越大优先级越高）',
  stackable TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否可与其他活动叠加',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_by INT COMMENT '创建人ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_activity_code (activity_code),
  INDEX idx_activity_type (activity_type),
  INDEX idx_activity_status (status),
  INDEX idx_activity_time (start_time, end_time),
  INDEX idx_activity_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='促销活动表';

-- 4. 满减规则表（full_reduction_rule）
CREATE TABLE IF NOT EXISTS t_full_reduction_rule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_id INT NOT NULL COMMENT '活动ID',
  threshold_amount DECIMAL(10,2) NOT NULL COMMENT '满足金额阈值',
  reduction_amount DECIMAL(10,2) NOT NULL COMMENT '减免金额',
  is_continuous TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否连续满减（每满X减Y）',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_activity (activity_id),
  FOREIGN KEY (activity_id) REFERENCES promotion_activity(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='满减规则表';

-- 5. 秒杀商品表（seckill_product）
CREATE TABLE IF NOT EXISTS t_seckill_product (
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

-- 6. 拼团活动表（group_buy_activity）
CREATE TABLE IF NOT EXISTS t_group_buy_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_id INT NOT NULL COMMENT '活动ID',
  group_size INT NOT NULL COMMENT '成团人数',
  group_price DECIMAL(10,2) NOT NULL COMMENT '拼团价格',
  original_price DECIMAL(10,2) NOT NULL COMMENT '原价',
  time_limit_hours INT NOT NULL DEFAULT 24 COMMENT '成团时限（小时）',
  auto_cancel TINYINT(1) NOT NULL DEFAULT 1 COMMENT '未成团是否自动取消',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_activity (activity_id),
  FOREIGN KEY (activity_id) REFERENCES promotion_activity(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拼团活动表';

-- 7. 拼团记录表（group_buy_record）
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

-- 8. 拼团参与记录表（group_buy_participant）
CREATE TABLE IF NOT EXISTS t_group_buy_participant (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL COMMENT '拼团记录ID',
  user_id INT NOT NULL COMMENT '用户ID',
  order_no VARCHAR(64) COMMENT '关联订单号',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '参与时间',
  
  INDEX idx_group (group_id),
  INDEX idx_user (user_id),
  FOREIGN KEY (group_id) REFERENCES group_buy_record(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拼团参与记录表';

-- 9. 活动叠加规则表（promotion_stack_rule）
CREATE TABLE IF NOT EXISTS t_promotion_stack_rule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_name VARCHAR(128) NOT NULL COMMENT '规则名称',
  priority INT NOT NULL DEFAULT 0 COMMENT '优先级',
  stack_types JSON NOT NULL COMMENT '可叠加的活动类型列表',
  max_discount DECIMAL(10,2) COMMENT '最大优惠金额限制',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_tenant (tenant_id),
  INDEX idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动叠加规则表';

-- 10. 营销操作日志表（marketing_operation_log）
CREATE TABLE IF NOT EXISTS t_marketing_operation_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module VARCHAR(32) NOT NULL COMMENT '模块（coupon/promotion/seckill/group_buy）',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营销操作日志表';
