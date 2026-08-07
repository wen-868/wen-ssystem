-- 自动生成的缺表补建 SQL（2026-08-07T13:37:18.360Z）
-- 共找到 18 张缺表的 CREATE TABLE，未找到 0 张：
SET NAMES utf8mb4;

-- 6. 即时零售订单商品表（retail_order_item）
CREATE TABLE IF NOT EXISTS t_retail_order_item (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL COMMENT '订单ID',
  product_id INT NOT NULL COMMENT '商品ID',
  product_name VARCHAR(128) NOT NULL COMMENT '商品名称',
  product_image VARCHAR(255) COMMENT '商品图片',
  price DECIMAL(10,2) NOT NULL COMMENT '单价',
  quantity INT NOT NULL COMMENT '数量',
  subtotal DECIMAL(10,2) NOT NULL COMMENT '小计金额',
  
  INDEX idx_order (order_id),
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='即时零售订单商品表';

-- 7. 配送配置表（delivery_config）
CREATE TABLE IF NOT EXISTS t_delivery_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_name VARCHAR(64) NOT NULL COMMENT '配置名称',
  delivery_type VARCHAR(16) NOT NULL COMMENT '配送类型（SELF/PLATFORM/THIRD_PARTY）',
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '配送费',
  free_delivery_amount DECIMAL(10,2) COMMENT '免配送费金额',
  delivery_radius INT COMMENT '配送半径（公里）',
  estimated_time VARCHAR(50) COMMENT '预计配送时间',
  contact_phone VARCHAR(20) COMMENT '联系电话',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配送配置表';

-- 8. 配送记录表（delivery_record）
CREATE TABLE IF NOT EXISTS t_delivery_record (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL COMMENT '订单ID',
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
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配送记录表';

-- 9. 即时零售操作日志表（retail_operation_log）
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

-- 4. 满减规则表（full_reduction_rule）
CREATE TABLE IF NOT EXISTS t_full_reduction_rule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_id INT NOT NULL COMMENT '活动ID',
  threshold_amount DECIMAL(10,2) NOT NULL COMMENT '满足金额阈值',
  reduction_amount DECIMAL(10,2) NOT NULL COMMENT '减免金额',
  is_continuous TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否连续满减（每满X减Y）',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_activity (activity_id)
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
  INDEX idx_product (product_id)
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
  
  INDEX idx_activity (activity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拼团活动表';

-- 8. 拼团参与记录表（group_buy_participant）
CREATE TABLE IF NOT EXISTS t_group_buy_participant (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL COMMENT '拼团记录ID',
  user_id INT NOT NULL COMMENT '用户ID',
  order_no VARCHAR(64) COMMENT '关联订单号',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '参与时间',
  
  INDEX idx_group (group_id),
  INDEX idx_user (user_id)
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

-- 编号: 053, 描述: 添加零售购物车表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_retail_cart (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  box_qty INT NOT NULL DEFAULT 0 COMMENT '箱数',
  bottle_qty INT NOT NULL DEFAULT 0 COMMENT '瓶数',
  checked TINYINT NOT NULL DEFAULT 1 COMMENT '是否选中',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_store_sku (user_id, store_id, sku_id),
  INDEX idx_user (user_id),
  INDEX idx_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='购物车表';

-- 编号: 063, 描述: 添加验证码表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_verification_code (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mobile VARCHAR(20) NOT NULL COMMENT '手机号',
  code VARCHAR(10) NOT NULL COMMENT '验证码',
  type VARCHAR(32) NOT NULL COMMENT '类型：LOGIN/BIND_PHONE/RESET_PASSWORD',
  expires_at DATETIME NOT NULL COMMENT '过期时间',
  used TINYINT NOT NULL DEFAULT 0 COMMENT '是否已使用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mobile_type (mobile, type),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='验证码表';

-- 编号: 064, 描述: 添加推送配置表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_push_config (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  push_type VARCHAR(32) NOT NULL COMMENT '推送类型：ORDER/COLLECTION/MARKETING/SYSTEM',
  enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用',
  quiet_start TIME DEFAULT NULL COMMENT '免打扰开始',
  quiet_end TIME DEFAULT NULL COMMENT '免打扰结束',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_type (user_id, push_type),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推送配置表';

-- 编号: 065, 描述: 添加推送模板表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_push_template (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL COMMENT '模板编码',
  name VARCHAR(128) NOT NULL COMMENT '模板名称',
  push_type VARCHAR(32) NOT NULL COMMENT '推送类型：ORDER/COLLECTION/MARKETING/SYSTEM',
  channel VARCHAR(32) NOT NULL COMMENT '渠道：WECHAT_MP/SMS/APP_PUSH',
  title_template VARCHAR(255) NOT NULL COMMENT '标题模板',
  content_template TEXT NOT NULL COMMENT '内容模板',
  wechat_template_id VARCHAR(128) DEFAULT NULL COMMENT '微信模板ID',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code (code),
  INDEX idx_type (push_type),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推送模板表';

-- 编号: 066, 描述: 添加推送日志表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_push_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  template_id BIGINT UNSIGNED DEFAULT NULL COMMENT '模板ID',
  push_type VARCHAR(32) NOT NULL COMMENT '推送类型',
  channel VARCHAR(32) NOT NULL COMMENT '渠道',
  title VARCHAR(255) NOT NULL COMMENT '推送标题',
  content TEXT NOT NULL COMMENT '推送内容',
  status VARCHAR(32) NOT NULL COMMENT '状态：SUCCESS/FAILED',
  error_msg VARCHAR(512) DEFAULT NULL COMMENT '错误信息',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推送日志表';

CREATE TABLE IF NOT EXISTS t_unit_group_item (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL COMMENT '单位组ID',
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  name VARCHAR(32) NOT NULL COMMENT '单位名称（箱/包/条/合/个）',
  level INT NOT NULL DEFAULT 0 COMMENT '层级（0为最高级，数字越大层级越低）',
  conversion_rate DECIMAL(15,4) NOT NULL DEFAULT 1 COMMENT '换算率（1上级单位=conversion_rate本级单位）',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_group (group_id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_level (group_id, level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='单位层级明细表';

-- ============================================================
-- 第2步：新建菜单权限表
-- ============================================================
CREATE TABLE IF NOT EXISTS t_sys_menu (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '菜单ID',
  parent_id BIGINT UNSIGNED DEFAULT NULL COMMENT '父菜单ID，NULL=顶级菜单',
  menu_code VARCHAR(64) NOT NULL COMMENT '菜单编码，如 sale:order:view',
  menu_name VARCHAR(64) NOT NULL COMMENT '菜单名称',
  menu_type VARCHAR(16) NOT NULL DEFAULT 'MENU' COMMENT '菜单类型：CATALOG(目录)/MENU(菜单)/BUTTON(按钮)',
  path VARCHAR(255) DEFAULT NULL COMMENT '前端路由路径',
  component VARCHAR(255) DEFAULT NULL COMMENT '前端组件路径',
  icon VARCHAR(64) DEFAULT NULL COMMENT '图标',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号',
  visible TINYINT NOT NULL DEFAULT 1 COMMENT '是否可见：1可见，0隐藏',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0禁用',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sys_menu_code_tenant (menu_code, tenant_id),
  KEY idx_sys_menu_parent_id (parent_id),
  KEY idx_sys_menu_sort (sort_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单权限表';

-- 编号: 104, 描述: 平台公告表, 创建人: 阿坚, 日期: 2026-07-13
-- 平台总后台向所有租户/商户发布的全局公告，区别于即时零售公告（retail_announcement）

CREATE TABLE IF NOT EXISTS t_platform_announcement (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL COMMENT '公告标题',
  content TEXT NOT NULL COMMENT '公告内容',
  type VARCHAR(32) NOT NULL DEFAULT 'NOTICE' COMMENT '公告类型：NOTICE/UPDATE/MAINTENANCE/URGENT',
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT/PUBLISHED/OFFLINE',
  top_flag TINYINT NOT NULL DEFAULT 0 COMMENT '是否置顶：1是 0否',
  publish_at DATETIME DEFAULT NULL COMMENT '发布时间',
  offline_at DATETIME DEFAULT NULL COMMENT '下线时间',
  created_by BIGINT DEFAULT NULL COMMENT '创建人（平台管理员ID）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_publish_at (publish_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台公告表';