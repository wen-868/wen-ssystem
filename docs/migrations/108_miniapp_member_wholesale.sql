-- 编号: 108, 描述: 小程序会员和批发模块表, 创建人: 阿坚, 日期: 2026-07-14

-- 会员等级配置表
CREATE TABLE IF NOT EXISTS t_member_level (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '等级ID',
  level_code VARCHAR(32) NOT NULL UNIQUE COMMENT '等级编码',
  level_name VARCHAR(64) NOT NULL COMMENT '等级名称',
  level_icon VARCHAR(256) DEFAULT NULL COMMENT '等级图标',
  min_points INT NOT NULL DEFAULT 0 COMMENT '最低积分',
  min_growth INT NOT NULL DEFAULT 0 COMMENT '最低成长值',
  discount_rate DECIMAL(5,2) NOT NULL DEFAULT 100.00 COMMENT '折扣率（%）',
  birthday_gift DECIMAL(10,2) DEFAULT 0 COMMENT '生日礼金额',
  free_shipping_amount DECIMAL(10,2) DEFAULT 0 COMMENT '免邮门槛',
  point_ratio INT NOT NULL DEFAULT 1 COMMENT '积分倍率（消费1元获得积分）',
  description VARCHAR(500) DEFAULT NULL COMMENT '等级权益描述',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用 0禁用',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status),
  INDEX idx_sort (sort_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员等级配置表';

-- 积分明细表（如果不存在）
CREATE TABLE IF NOT EXISTS t_points_record (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  member_id BIGINT UNSIGNED NOT NULL COMMENT '会员ID',
  type VARCHAR(16) NOT NULL COMMENT '类型：EARN-earn/SPEND消费/EXPIRE过期',
  change_points INT NOT NULL COMMENT '变动积分（正=获得，负=消耗）',
  balance_points INT NOT NULL COMMENT '变动后余额',
  source_type VARCHAR(32) NOT NULL COMMENT '来源类型：ORDER/CONSUME/EXCHANGE/SIGNUP/ACTIVITY',
  source_id VARCHAR(64) DEFAULT NULL COMMENT '来源ID',
  remark VARCHAR(256) DEFAULT NULL COMMENT '备注',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_member (member_id),
  INDEX idx_type (type),
  INDEX idx_tenant (tenant_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分明细表';

-- 成长值明细表
CREATE TABLE IF NOT EXISTS t_growth_record (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  member_id BIGINT UNSIGNED NOT NULL COMMENT '会员ID',
  type VARCHAR(16) NOT NULL COMMENT '类型：EARN获得/DEDUCT扣减',
  change_growth INT NOT NULL COMMENT '变动成长值（正=获得，负=扣减）',
  balance_growth INT NOT NULL COMMENT '变动后余额',
  source_type VARCHAR(32) NOT NULL COMMENT '来源类型：ORDER/CONSUME/SIGNUP/ACTIVITY',
  source_id VARCHAR(64) DEFAULT NULL COMMENT '来源ID',
  remark VARCHAR(256) DEFAULT NULL COMMENT '备注',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_member (member_id),
  INDEX idx_type (type),
  INDEX idx_tenant (tenant_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成长值明细表';

-- 会员优惠券表（已有 user_coupon，但为了小程序兼容性，这里创建带 t_ 前缀的版本）
-- 注意：现有 user_coupon 表存在，我们保留它，同时用视图或别名兼容
-- 这里我们直接使用已有的 user_coupon 和 coupon_template 表

-- 批发购物车表
CREATE TABLE IF NOT EXISTS t_wholesale_cart (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '购物车ID',
  member_id BIGINT UNSIGNED NOT NULL COMMENT '会员ID',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  quantity INT NOT NULL DEFAULT 1 COMMENT '数量',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_member_sku (member_id, sku_id, tenant_id),
  INDEX idx_member (member_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='批发购物车表';

-- 批发订单表
CREATE TABLE IF NOT EXISTS t_wholesale_order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单ID',
  order_no VARCHAR(32) NOT NULL UNIQUE COMMENT '订单编号',
  member_id BIGINT UNSIGNED NOT NULL COMMENT '会员ID',
  store_id INT DEFAULT NULL COMMENT '门店ID',
  order_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '订单状态：PENDING待付款/PAID已付款/SHIPPED已发货/COMPLETED已完成/CANCELLED已取消',
  pay_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID' COMMENT '支付状态：UNPAID未支付/PAID已支付/REFUNDED已退款',
  goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '商品金额',
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '优惠金额',
  shipping_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '运费',
  payable_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '应付金额',
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '实付金额',
  receiver_name VARCHAR(64) DEFAULT NULL COMMENT '收货人姓名',
  receiver_mobile VARCHAR(20) DEFAULT NULL COMMENT '收货人手机号',
  receiver_province VARCHAR(64) DEFAULT NULL COMMENT '省',
  receiver_city VARCHAR(64) DEFAULT NULL COMMENT '市',
  receiver_district VARCHAR(64) DEFAULT NULL COMMENT '区',
  receiver_address VARCHAR(256) DEFAULT NULL COMMENT '详细地址',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  coupon_id INT DEFAULT NULL COMMENT '使用的优惠券ID',
  coupon_amount DECIMAL(12,2) DEFAULT 0 COMMENT '优惠券抵扣金额',
  points_used INT DEFAULT 0 COMMENT '使用积分',
  points_amount DECIMAL(12,2) DEFAULT 0 COMMENT '积分抵扣金额',
  paid_at DATETIME DEFAULT NULL COMMENT '支付时间',
  shipped_at DATETIME DEFAULT NULL COMMENT '发货时间',
  completed_at DATETIME DEFAULT NULL COMMENT '完成时间',
  cancelled_at DATETIME DEFAULT NULL COMMENT '取消时间',
  cancel_reason VARCHAR(256) DEFAULT NULL COMMENT '取消原因',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_no (order_no),
  INDEX idx_member (member_id),
  INDEX idx_status (order_status),
  INDEX idx_pay_status (pay_status),
  INDEX idx_tenant (tenant_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='批发订单表';

-- 批发订单项表
CREATE TABLE IF NOT EXISTS t_wholesale_order_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单项ID',
  order_no VARCHAR(32) NOT NULL COMMENT '订单编号',
  spu_id BIGINT UNSIGNED NOT NULL COMMENT 'SPU ID',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(256) NOT NULL COMMENT 'SKU名称',
  sku_image VARCHAR(512) DEFAULT NULL COMMENT 'SKU图片',
  quantity INT NOT NULL COMMENT '数量',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '单价（批发价）',
  subtotal_amount DECIMAL(12,2) NOT NULL COMMENT '小计金额',
  spec_info VARCHAR(256) DEFAULT NULL COMMENT '规格信息',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_order_no (order_no),
  INDEX idx_sku (sku_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='批发订单项表';

-- 新增会员字段：成长值、头像、昵称、性别、生日
ALTER TABLE t_member 
  ADD COLUMN IF NOT EXISTS growth_value INT NOT NULL DEFAULT 0 COMMENT '成长值' AFTER points,
  ADD COLUMN IF NOT EXISTS avatar VARCHAR(512) DEFAULT NULL COMMENT '头像URL' AFTER name,
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(64) DEFAULT NULL COMMENT '昵称' AFTER avatar,
  ADD COLUMN IF NOT EXISTS gender TINYINT DEFAULT 0 COMMENT '性别：0未知 1男 2女' AFTER nickname,
  ADD COLUMN IF NOT EXISTS birthday DATE DEFAULT NULL COMMENT '生日' AFTER gender;

-- 初始化会员等级数据（默认5个等级）
INSERT INTO t_member_level (level_code, level_name, min_points, min_growth, discount_rate, point_ratio, description, sort_no, status, tenant_id)
SELECT 'VIP1', '普通会员', 0, 0, 100.00, 1, '注册即享', 1, 1, t.id
FROM (SELECT DISTINCT tenant_id as id FROM t_member LIMIT 1) t
WHERE NOT EXISTS (SELECT 1 FROM t_member_level ml WHERE ml.tenant_id = t.id AND ml.level_code = 'VIP1');

INSERT INTO t_member_level (level_code, level_name, min_points, min_growth, discount_rate, point_ratio, description, sort_no, status, tenant_id)
SELECT 'VIP2', '银卡会员', 1000, 500, 98.00, 1.5, '享98折优惠', 2, 1, t.id
FROM (SELECT DISTINCT tenant_id as id FROM t_member LIMIT 1) t
WHERE NOT EXISTS (SELECT 1 FROM t_member_level ml WHERE ml.tenant_id = t.id AND ml.level_code = 'VIP2');

INSERT INTO t_member_level (level_code, level_name, min_points, min_growth, discount_rate, point_ratio, description, sort_no, status, tenant_id)
SELECT 'VIP3', '金卡会员', 5000, 2000, 95.00, 2, '享95折优惠', 3, 1, t.id
FROM (SELECT DISTINCT tenant_id as id FROM t_member LIMIT 1) t
WHERE NOT EXISTS (SELECT 1 FROM t_member_level ml WHERE ml.tenant_id = t.id AND ml.level_code = 'VIP3');

INSERT INTO t_member_level (level_code, level_name, min_points, min_growth, discount_rate, point_ratio, description, sort_no, status, tenant_id)
SELECT 'VIP4', '铂金会员', 20000, 8000, 92.00, 2.5, '享92折优惠', 4, 1, t.id
FROM (SELECT DISTINCT tenant_id as id FROM t_member LIMIT 1) t
WHERE NOT EXISTS (SELECT 1 FROM t_member_level ml WHERE ml.tenant_id = t.id AND ml.level_code = 'VIP4');

INSERT INTO t_member_level (level_code, level_name, min_points, min_growth, discount_rate, point_ratio, description, sort_no, status, tenant_id)
SELECT 'VIP5', '钻石会员', 50000, 20000, 88.00, 3, '享88折优惠', 5, 1, t.id
FROM (SELECT DISTINCT tenant_id as id FROM t_member LIMIT 1) t
WHERE NOT EXISTS (SELECT 1 FROM t_member_level ml WHERE ml.tenant_id = t.id AND ml.level_code = 'VIP5');
