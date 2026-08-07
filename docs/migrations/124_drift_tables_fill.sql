-- 编号: 124, 描述: R95-06 结构差异清零-代码漂移表补建(26张), 创建人: 阿坚, 日期: 2026-08-07
-- 说明: 补齐 backend/src 实际引用但无 DDL 定义且生产缺失的表（按代码 SQL 列定义，无外键风格）
-- 执行: 服务器执行本文件（CREATE TABLE IF NOT EXISTS，可重复执行）；执行后重跑 scripts/schema-audit.mjs 验证

-- 1. 售后单表
CREATE TABLE IF NOT EXISTS t_aftersale (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '售后单ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  aftersale_no VARCHAR(64) NOT NULL COMMENT '售后单号',
  aftersale_type VARCHAR(32) NOT NULL DEFAULT 'REFUND' COMMENT '售后类型：REFUND/EXCHANGE/RETURN',
  order_id BIGINT DEFAULT NULL COMMENT '关联订单ID',
  order_no VARCHAR(64) DEFAULT NULL COMMENT '关联订单号',
  customer_id BIGINT DEFAULT NULL COMMENT '客户ID',
  store_id BIGINT DEFAULT NULL COMMENT '门店ID',
  reason VARCHAR(500) DEFAULT NULL COMMENT '售后原因',
  reason_detail TEXT COMMENT '原因说明',
  refund_amount DECIMAL(12,2) DEFAULT 0 COMMENT '退款金额',
  exchange_qty INT DEFAULT 0 COMMENT '换货数量',
  exchange_sku_id BIGINT DEFAULT NULL COMMENT '换货SKU ID',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/PROCESSING/APPROVED/REJECTED/COMPLETED/CANCELLED',
  process_remark VARCHAR(500) DEFAULT NULL COMMENT '处理备注',
  processed_by BIGINT DEFAULT NULL COMMENT '处理人ID',
  inspected_by BIGINT DEFAULT NULL COMMENT '验收人ID',
  inspect_result TEXT COMMENT '验收结果',
  inspect_images TEXT COMMENT '验收图片',
  images TEXT COMMENT '图片列表',
  items JSON COMMENT '售后明细（JSON数组）',
  receiver_name VARCHAR(64) DEFAULT NULL COMMENT '收货人姓名',
  receiver_mobile VARCHAR(20) DEFAULT NULL COMMENT '收货人手机号',
  receiver_address VARCHAR(255) DEFAULT NULL COMMENT '收货地址',
  return_logistics_company VARCHAR(64) DEFAULT NULL COMMENT '退货物流公司',
  return_logistics_no VARCHAR(64) DEFAULT NULL COMMENT '退货物流单号',
  customer_comment TEXT COMMENT '客户评价',
  satisfaction INT DEFAULT NULL COMMENT '满意度评分',
  deadline DATETIME DEFAULT NULL COMMENT '处理截止时间',
  version INT NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_aftersale_no (aftersale_no),
  KEY idx_aftersale_order (order_id),
  KEY idx_aftersale_customer (customer_id),
  KEY idx_aftersale_status (status),
  KEY idx_aftersale_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='售后单表';

-- 2. 审计日志表
CREATE TABLE IF NOT EXISTS t_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  user_id BIGINT DEFAULT NULL COMMENT '操作人ID',
  user_name VARCHAR(64) DEFAULT NULL COMMENT '操作人姓名',
  role VARCHAR(32) DEFAULT NULL COMMENT '操作人角色',
  action VARCHAR(64) NOT NULL COMMENT '操作动作',
  resource_type VARCHAR(64) DEFAULT NULL COMMENT '资源类型',
  resource_id VARCHAR(64) DEFAULT NULL COMMENT '资源ID',
  detail TEXT COMMENT '操作详情',
  ip VARCHAR(64) DEFAULT NULL COMMENT 'IP地址',
  user_agent VARCHAR(255) DEFAULT NULL COMMENT '浏览器UA',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_log_tenant (tenant_id),
  KEY idx_audit_log_action (action),
  KEY idx_audit_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志表';

-- 3. 购物车表（小程序端）
CREATE TABLE IF NOT EXISTS t_cart_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '购物车项ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  sku_id BIGINT NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) DEFAULT NULL COMMENT 'SKU名称快照',
  name VARCHAR(128) DEFAULT NULL COMMENT '商品名称快照',
  main_image VARCHAR(255) DEFAULT NULL COMMENT '主图URL',
  quantity INT NOT NULL DEFAULT 1 COMMENT '数量',
  retail_price DECIMAL(12,2) DEFAULT NULL COMMENT '零售价快照',
  miniapp_price DECIMAL(12,2) DEFAULT NULL COMMENT '小程序价快照',
  wholesale_price DECIMAL(12,2) DEFAULT NULL COMMENT '批发价快照',
  available_qty INT DEFAULT NULL COMMENT '可用库存快照',
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cart_customer_sku (customer_id, sku_id, tenant_id),
  KEY idx_cart_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='购物车表';

-- 4. 现金流表
CREATE TABLE IF NOT EXISTS t_cash_flow (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '流水ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  transaction_type VARCHAR(32) NOT NULL COMMENT '交易类型',
  transaction_date DATE NOT NULL COMMENT '交易日期',
  amount DECIMAL(12,2) NOT NULL COMMENT '交易金额（正收负支）',
  balance_before DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '变动前余额',
  balance_after DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '变动后余额',
  related_type VARCHAR(32) DEFAULT NULL COMMENT '关联类型',
  related_no VARCHAR(64) DEFAULT NULL COMMENT '关联单号',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cash_flow_tenant (tenant_id),
  KEY idx_cash_flow_date (transaction_date),
  KEY idx_cash_flow_type (transaction_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='现金流表';

-- 5. 每日结算表
CREATE TABLE IF NOT EXISTS t_daily_settlement (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '结算ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  settle_date DATE NOT NULL COMMENT '结算日期',
  shift_no VARCHAR(64) DEFAULT NULL COMMENT '交接班编号',
  store_id BIGINT NOT NULL COMMENT '门店ID',
  operator_id BIGINT DEFAULT NULL COMMENT '操作人ID',
  total_sales DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '销售总额',
  total_received DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '实收总额',
  total_refund DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '退款总额',
  cash_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '现金金额',
  wechat_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '微信金额',
  alipay_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '支付宝金额',
  transfer_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '转账金额',
  other_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '其他金额',
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED' COMMENT '状态',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_daily_settlement_date (settle_date, store_id, tenant_id),
  KEY idx_daily_settlement_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日结算表';

-- 6. 订单优惠券关联表
CREATE TABLE IF NOT EXISTS t_order_coupon (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  coupon_id BIGINT NOT NULL COMMENT '优惠券ID（t_user_coupon.id）',
  order_id BIGINT NOT NULL COMMENT '订单ID',
  order_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '订单金额',
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '优惠金额',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_coupon (coupon_id, order_id),
  KEY idx_order_coupon_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单优惠券关联表';

-- 7. 平台结算表
CREATE TABLE IF NOT EXISTS t_platform_settlement (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '结算ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  tenant_name VARCHAR(128) DEFAULT NULL COMMENT '租户名称快照',
  settlement_no VARCHAR(64) NOT NULL COMMENT '结算单号',
  period_start DATE NOT NULL COMMENT '结算周期开始',
  period_end DATE NOT NULL COMMENT '结算周期结束',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '结算总额',
  pending_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '待结算金额',
  settled_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '已结算金额',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/SETTLED/CANCELLED',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  created_by BIGINT DEFAULT NULL COMMENT '创建人ID',
  settled_at DATETIME DEFAULT NULL COMMENT '结算时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_platform_settlement_no (settlement_no),
  KEY idx_platform_settlement_tenant (tenant_id),
  KEY idx_platform_settlement_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台结算表';

-- 8. 满减活动表（旧设计，代码 marketing-full-reduction/checkout/cart 引用）
CREATE TABLE IF NOT EXISTS t_full_reduction (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '活动ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  name VARCHAR(128) NOT NULL COMMENT '活动名称',
  rules JSON COMMENT '满减规则（JSON）',
  applicable_scope VARCHAR(32) DEFAULT 'ALL' COMMENT '适用范围：ALL/CATEGORY/PRODUCT',
  applicable_ids TEXT COMMENT '适用ID列表',
  description VARCHAR(500) DEFAULT NULL COMMENT '活动说明',
  priority INT NOT NULL DEFAULT 0 COMMENT '优先级',
  stackable TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否可叠加',
  start_time DATETIME NOT NULL COMMENT '开始时间',
  end_time DATETIME NOT NULL COMMENT '结束时间',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/INACTIVE/EXPIRED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_full_reduction_tenant (tenant_id),
  KEY idx_full_reduction_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='满减活动表';

-- 9. 限时秒杀活动表（旧设计，代码 marketing-flash-sale 引用）
CREATE TABLE IF NOT EXISTS t_flash_sale (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '活动ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  name VARCHAR(128) NOT NULL COMMENT '活动名称',
  product_id BIGINT NOT NULL COMMENT '商品ID',
  sku_id BIGINT NOT NULL COMMENT 'SKU ID',
  flash_price DECIMAL(12,2) NOT NULL COMMENT '秒杀价',
  original_price DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '原价',
  price DECIMAL(12,2) DEFAULT NULL COMMENT '价格',
  quantity INT NOT NULL DEFAULT 0 COMMENT '数量',
  total_stock INT NOT NULL DEFAULT 0 COMMENT '总库存',
  sold_count INT NOT NULL DEFAULT 0 COMMENT '已售数量',
  limit_per_user INT NOT NULL DEFAULT 1 COMMENT '每人限购',
  start_time DATETIME NOT NULL COMMENT '开始时间',
  end_time DATETIME NOT NULL COMMENT '结束时间',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/INACTIVE/EXPIRED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_flash_sale_tenant (tenant_id),
  KEY idx_flash_sale_status (status),
  KEY idx_flash_sale_sku (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='限时秒杀活动表';

-- 10. 秒杀参与记录表（旧设计）
CREATE TABLE IF NOT EXISTS t_flash_sale_record (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  flash_sale_id BIGINT NOT NULL COMMENT '秒杀活动ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  name VARCHAR(128) DEFAULT NULL COMMENT '活动名称快照',
  quantity INT NOT NULL DEFAULT 1 COMMENT '购买数量',
  price DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '成交价',
  flash_price DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '秒杀价快照',
  original_price DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '原价快照',
  total_stock INT DEFAULT NULL COMMENT '总库存快照',
  sold_count INT DEFAULT NULL COMMENT '已售快照',
  status VARCHAR(16) NOT NULL DEFAULT 'SUCCESS' COMMENT '状态：SUCCESS/FAILED/CANCELLED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_flash_sale_record_sale (flash_sale_id),
  KEY idx_flash_sale_record_user (user_id),
  KEY idx_flash_sale_record_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='秒杀参与记录表';

-- 11. 拼团活动表（旧设计，代码 community-marketing/group-buy 引用）
CREATE TABLE IF NOT EXISTS t_group_buy (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '拼团ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  activity_id BIGINT DEFAULT NULL COMMENT '关联活动ID',
  name VARCHAR(128) NOT NULL COMMENT '活动名称',
  product_id BIGINT NOT NULL COMMENT '商品ID',
  sku_id BIGINT NOT NULL COMMENT 'SKU ID',
  group_price DECIMAL(12,2) NOT NULL COMMENT '拼团价',
  original_price DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '原价',
  min_group_size INT NOT NULL DEFAULT 2 COMMENT '最小成团人数',
  max_group_size INT NOT NULL DEFAULT 2 COMMENT '最大成团人数',
  target_size INT NOT NULL DEFAULT 2 COMMENT '成团目标人数',
  current_size INT NOT NULL DEFAULT 0 COMMENT '当前参团人数',
  leader_id BIGINT DEFAULT NULL COMMENT '团长用户ID',
  leader_order_id BIGINT DEFAULT NULL COMMENT '团长订单ID',
  sold_count INT NOT NULL DEFAULT 0 COMMENT '已售数量',
  total_stock INT NOT NULL DEFAULT 0 COMMENT '总库存',
  start_time DATETIME NOT NULL COMMENT '开始时间',
  end_time DATETIME NOT NULL COMMENT '结束时间',
  expires_at DATETIME DEFAULT NULL COMMENT '过期时间',
  time_limit_hours INT NOT NULL DEFAULT 24 COMMENT '成团时限（小时）',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/SUCCESS/FAILED/CANCELLED',
  completed_at DATETIME DEFAULT NULL COMMENT '成团时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_group_buy_tenant (tenant_id),
  KEY idx_group_buy_status (status),
  KEY idx_group_buy_sku (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拼团活动表';

-- 12. 拼团成员表（旧设计）
CREATE TABLE IF NOT EXISTS t_group_buy_member (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '成员ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  team_id BIGINT NOT NULL COMMENT '拼团组ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  is_leader TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否团长',
  quantity INT NOT NULL DEFAULT 1 COMMENT '购买数量',
  order_id BIGINT DEFAULT NULL COMMENT '关联订单ID',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '参团时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_group_buy_member_team_user (team_id, user_id),
  KEY idx_group_buy_member_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拼团成员表';

-- 13. 拼团组表（旧设计）
CREATE TABLE IF NOT EXISTS t_group_buy_team (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '拼团组ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  activity_id BIGINT NOT NULL COMMENT '拼团活动ID',
  name VARCHAR(128) DEFAULT NULL COMMENT '活动名称快照',
  leader_id BIGINT DEFAULT NULL COMMENT '团长用户ID',
  leader_order_id BIGINT DEFAULT NULL COMMENT '团长订单ID',
  current_size INT NOT NULL DEFAULT 1 COMMENT '当前人数',
  target_size INT NOT NULL DEFAULT 2 COMMENT '目标人数',
  max_group_size INT NOT NULL DEFAULT 2 COMMENT '最大人数',
  group_price DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '拼团价快照',
  original_price DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '原价快照',
  sku_id BIGINT DEFAULT NULL COMMENT 'SKU ID',
  sold_count INT NOT NULL DEFAULT 0 COMMENT '已售数量',
  total_stock INT NOT NULL DEFAULT 0 COMMENT '总库存快照',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/SUCCESS/FAILED/CANCELLED',
  expires_at DATETIME DEFAULT NULL COMMENT '过期时间',
  completed_at DATETIME DEFAULT NULL COMMENT '成团时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_group_buy_team_activity (activity_id),
  KEY idx_group_buy_team_tenant (tenant_id),
  KEY idx_group_buy_team_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拼团组表';

-- 14. 活动叠加规则表（旧设计，代码 marketing-stack-rule 引用）
CREATE TABLE IF NOT EXISTS t_promo_stack_rule (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '规则ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  name VARCHAR(128) NOT NULL COMMENT '规则名称',
  type_combination JSON NOT NULL COMMENT '可叠加活动类型组合',
  max_total_discount_rate DECIMAL(5,2) NOT NULL DEFAULT 100 COMMENT '最大总折扣率',
  priority INT NOT NULL DEFAULT 0 COMMENT '优先级',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_promo_stack_rule_tenant (tenant_id),
  KEY idx_promo_stack_rule_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动叠加规则表';

-- 15. 支付方式表（租户默认支付方式）
CREATE TABLE IF NOT EXISTS t_payment_method (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  method_code VARCHAR(32) NOT NULL COMMENT '支付方式编码：CASH/WECHAT/ALIPAY/TRANSFER',
  method_name VARCHAR(64) NOT NULL COMMENT '支付方式名称',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/INACTIVE',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_payment_method_tenant_code (tenant_id, method_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付方式表';

-- 16. 待办表
CREATE TABLE IF NOT EXISTS t_todos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '待办ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  title VARCHAR(200) NOT NULL COMMENT '标题',
  type VARCHAR(32) DEFAULT NULL COMMENT '类型',
  source VARCHAR(64) DEFAULT NULL COMMENT '来源',
  priority VARCHAR(16) NOT NULL DEFAULT 'NORMAL' COMMENT '优先级：LOW/NORMAL/HIGH/URGENT',
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/COMPLETED/DISMISSED',
  due_date DATE DEFAULT NULL COMMENT '截止日期',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_todos_tenant (tenant_id),
  KEY idx_todos_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='待办表';

-- 17. 同步缓存表（价格/商品同步）
CREATE TABLE IF NOT EXISTS t_sync_cache (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '缓存ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  sync_type VARCHAR(32) NOT NULL COMMENT '同步类型：price/product',
  entity_id VARCHAR(64) NOT NULL COMMENT '实体ID',
  sync_data TEXT COMMENT '同步数据（JSON）',
  sync_status VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/synced/failed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sync_cache (tenant_id, sync_type, entity_id),
  KEY idx_sync_cache_status (sync_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='同步缓存表';

-- 18. 用户积分表（小程序用户积分余额）
CREATE TABLE IF NOT EXISTS t_user_points (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  points INT NOT NULL DEFAULT 0 COMMENT '当前积分',
  total_earned INT NOT NULL DEFAULT 0 COMMENT '累计获得',
  total_spent INT NOT NULL DEFAULT 0 COMMENT '累计消耗',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_points (tenant_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户积分表';

-- 19. 微信用户表
CREATE TABLE IF NOT EXISTS t_wx_user (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  openid VARCHAR(64) NOT NULL COMMENT '微信openid',
  unionid VARCHAR(64) DEFAULT NULL COMMENT '微信unionid',
  nickname VARCHAR(64) DEFAULT NULL COMMENT '昵称',
  avatar_url VARCHAR(255) DEFAULT NULL COMMENT '头像URL',
  gender TINYINT DEFAULT 0 COMMENT '性别：0未知/1男/2女',
  phone VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  country VARCHAR(64) DEFAULT NULL COMMENT '国家',
  province VARCHAR(64) DEFAULT NULL COMMENT '省份',
  city VARCHAR(64) DEFAULT NULL COMMENT '城市',
  session_key VARCHAR(255) DEFAULT NULL COMMENT '会话密钥',
  last_login_at DATETIME DEFAULT NULL COMMENT '最后登录时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_wx_user_openid (openid),
  KEY idx_wx_user_unionid (unionid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='微信用户表';

-- 20. 微信用户绑定表
CREATE TABLE IF NOT EXISTS t_user_binding (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '绑定ID',
  wx_user_id BIGINT NOT NULL COMMENT '微信用户ID（t_wx_user.id）',
  system_user_id BIGINT NOT NULL COMMENT '系统用户ID',
  binding_type VARCHAR(32) NOT NULL DEFAULT 'WECHAT' COMMENT '绑定类型',
  username VARCHAR(64) DEFAULT NULL COMMENT '系统账号快照',
  real_name VARCHAR(64) DEFAULT NULL COMMENT '姓名快照',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/UNBOUND',
  bound_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '绑定时间',
  unbound_at DATETIME DEFAULT NULL COMMENT '解绑时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_binding_wx (wx_user_id),
  KEY idx_user_binding_sys (system_user_id),
  KEY idx_user_binding_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='微信用户绑定表';

-- 21. 用户登录日志表
CREATE TABLE IF NOT EXISTS t_sys_user_login (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  user_id BIGINT DEFAULT NULL COMMENT '用户ID',
  username VARCHAR(64) DEFAULT NULL COMMENT '账号',
  login_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  ip VARCHAR(64) DEFAULT NULL COMMENT 'IP地址',
  user_agent VARCHAR(255) DEFAULT NULL COMMENT '浏览器UA',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sys_user_login_tenant (tenant_id),
  KEY idx_sys_user_login_login_at (login_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户登录日志表';

-- 22. 角色菜单关联表
CREATE TABLE IF NOT EXISTS t_sys_role_menu (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  role_id BIGINT NOT NULL COMMENT '角色ID',
  menu_id BIGINT NOT NULL COMMENT '菜单ID（t_sys_menu.id）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sys_role_menu (role_id, menu_id),
  KEY idx_sys_role_menu_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单关联表';

-- 23. 销售单归档表（镜像 t_sale_bill）
CREATE TABLE IF NOT EXISTS t_sale_bill_archive (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '销售单ID（归档）',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  bill_no VARCHAR(64) NOT NULL COMMENT '销售单号',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  customer_id BIGINT UNSIGNED DEFAULT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) DEFAULT NULL COMMENT '客户名称快照',
  customer_mobile VARCHAR(20) DEFAULT NULL COMMENT '客户手机号快照',
  customer_type VARCHAR(32) NOT NULL DEFAULT 'RETAIL' COMMENT '客户身份快照',
  sale_type VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '销售类型',
  business_status VARCHAR(32) NOT NULL DEFAULT 'CREATED' COMMENT '业务状态',
  collection_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID' COMMENT '收款状态',
  due_date DATE DEFAULT NULL COMMENT '应收截止日期',
  statement_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联对账单ID',
  goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
  rounding_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '抹零金额',
  receivable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应收金额',
  received_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已收金额',
  unreceived_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '未收金额',
  share_collection_count INT NOT NULL DEFAULT 0 COMMENT '分享收款次数',
  last_share_time DATETIME DEFAULT NULL COMMENT '最近分享时间',
  last_payment_time DATETIME DEFAULT NULL COMMENT '最近收款时间',
  locked_amount_flag TINYINT NOT NULL DEFAULT 0 COMMENT '金额锁定',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '开单人',
  remark VARCHAR(255) DEFAULT NULL COMMENT '客户可见备注',
  internal_remark VARCHAR(255) DEFAULT NULL COMMENT '内部备注',
  void_reason VARCHAR(255) DEFAULT NULL COMMENT '作废原因',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sale_bill_archive_no (bill_no),
  KEY idx_sale_bill_archive_tenant (tenant_id),
  KEY idx_sale_bill_archive_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售单归档表';

-- 24. 销售单明细归档表（镜像 t_sale_bill_item）
CREATE TABLE IF NOT EXISTS t_sale_bill_item_archive (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  bill_no VARCHAR(64) NOT NULL COMMENT '销售单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称快照',
  box_qty INT NOT NULL DEFAULT 0 COMMENT '箱数',
  bottle_qty INT NOT NULL DEFAULT 0 COMMENT '瓶数',
  total_bottle_qty INT NOT NULL COMMENT '合计瓶数',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '成交单价',
  price_type VARCHAR(32) NOT NULL COMMENT '价格类型',
  subtotal_amount DECIMAL(12,2) NOT NULL COMMENT '小计',
  trace_required TINYINT NOT NULL DEFAULT 0 COMMENT '是否需要追溯',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sale_bill_item_archive_bill (bill_no),
  KEY idx_sale_bill_item_archive_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售单明细归档表';

-- 25. 采购订单归档表（镜像 t_purchase_order）
CREATE TABLE IF NOT EXISTS t_purchase_order_archive (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '采购订单ID（归档）',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  order_no VARCHAR(64) NOT NULL COMMENT '采购订单号',
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  supplier_name VARCHAR(128) NOT NULL COMMENT '供应商名称快照',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '入库门店ID',
  order_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '订单状态',
  goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
  payable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应付金额',
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已付金额',
  unpaid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '未付金额',
  expected_date DATE DEFAULT NULL COMMENT '预计到货日期',
  actual_date DATE DEFAULT NULL COMMENT '实际到货日期',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '制单人',
  auditor_id BIGINT UNSIGNED DEFAULT NULL COMMENT '审核人',
  audited_at DATETIME DEFAULT NULL COMMENT '审核时间',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_purchase_order_archive_no (order_no),
  KEY idx_purchase_order_archive_tenant (tenant_id),
  KEY idx_purchase_order_archive_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单归档表';

-- 26. 采购订单明细归档表（镜像 t_purchase_order_item）
CREATE TABLE IF NOT EXISTS t_purchase_order_item_archive (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  order_no VARCHAR(64) NOT NULL COMMENT '采购订单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称快照',
  barcode VARCHAR(128) DEFAULT NULL COMMENT '条码快照',
  box_qty INT NOT NULL DEFAULT 0 COMMENT '箱数',
  bottle_qty INT NOT NULL DEFAULT 0 COMMENT '瓶数',
  total_bottle_qty INT NOT NULL COMMENT '合计瓶数',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '采购单价',
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0.0000 COMMENT '税率',
  subtotal_amount DECIMAL(12,2) NOT NULL COMMENT '小计金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  total_amount DECIMAL(12,2) NOT NULL COMMENT '含税小计',
  in_stocked_qty INT NOT NULL DEFAULT 0 COMMENT '已入库数量',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_purchase_order_item_archive_order (order_no),
  KEY idx_purchase_order_item_archive_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单明细归档表';

-- 验证 SQL：应返回 26 行
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()
--   AND table_name IN ('t_aftersale','t_audit_log','t_cart_item','t_cash_flow','t_daily_settlement',
--   't_full_reduction','t_flash_sale','t_flash_sale_record','t_group_buy','t_group_buy_member','t_group_buy_team',
--   't_order_coupon','t_payment_method','t_platform_settlement','t_promo_stack_rule',
--   't_purchase_order_archive','t_purchase_order_item_archive','t_sale_bill_archive','t_sale_bill_item_archive',
--   't_sync_cache','t_sys_role_menu','t_sys_user_login','t_todos','t_user_binding','t_user_points','t_wx_user');
