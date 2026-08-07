-- 自动生成的缺表补建 SQL（2026-08-07T13:14:18.201Z）
-- 共找到 46 张缺表的 CREATE TABLE，未找到 22 张：t_aftersale, t_audit_log, t_cart_item, t_cash_flow, t_daily_settlement, t_flash_sale, t_flash_sale_record, t_full_reduction, t_group_buy, t_group_buy_member, t_group_buy_team, t_order_coupon, t_payment_method, t_platform_settlement, t_product_step_price, t_promo_stack_rule, t_purchase_order_archive, t_purchase_order_item_archive, t_sale_bill_archive, t_sale_bill_item_archive, t_sys_user_login, t_wx_user
SET NAMES utf8mb4;

-- 1. 审批规则配置表
CREATE TABLE t_approval_rule (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '规则ID',
  rule_name VARCHAR(128) NOT NULL COMMENT '规则名称',
  business_type VARCHAR(32) NOT NULL COMMENT '业务类型：PURCHASE_ORDER/SALE_RETURN/PRICE_CHANGE/CREDIT_LIMIT',
  trigger_condition JSON NOT NULL COMMENT '触发条件：金额阈值、状态变更等',
  approval_chain JSON NOT NULL COMMENT '审批链：[{level: 1, approver_type: "ROLE", approver_value: "MANAGER"}]',
  sla_hours INT NOT NULL DEFAULT 24 COMMENT 'SLA超时时间（小时）',
  escalation_level INT DEFAULT 1 COMMENT '升级层级：1-直属上级，2-部门经理，3-总经理',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_approval_rule_business_type (business_type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批规则配置表';

-- 2. 审批实例表
CREATE TABLE t_approval_instance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '实例ID',
  instance_no VARCHAR(64) NOT NULL COMMENT '审批实例编号',
  rule_id BIGINT UNSIGNED NOT NULL COMMENT '关联规则ID',
  business_type VARCHAR(32) NOT NULL COMMENT '业务类型',
  business_no VARCHAR(64) NOT NULL COMMENT '业务单号',
  business_title VARCHAR(255) NOT NULL COMMENT '业务标题',
  applicant_id BIGINT UNSIGNED NOT NULL COMMENT '申请人ID',
  applicant_name VARCHAR(64) NOT NULL COMMENT '申请人姓名',
  current_level INT NOT NULL DEFAULT 1 COMMENT '当前审批层级',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/APPROVED/REJECTED/CANCELLED/ESCALATED',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  completed_at DATETIME DEFAULT NULL COMMENT '完成时间',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_approval_instance_no (instance_no),
  KEY idx_approval_instance_business (business_type, business_no),
  KEY idx_approval_instance_applicant (applicant_id),
  KEY idx_approval_instance_status (status, submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批实例表';

-- 3. 审批任务表（每个审批人的任务）
CREATE TABLE t_approval_task (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '任务ID',
  instance_id BIGINT UNSIGNED NOT NULL COMMENT '关联实例ID',
  approval_level INT NOT NULL COMMENT '审批层级',
  approver_id BIGINT UNSIGNED NOT NULL COMMENT '审批人ID',
  approver_name VARCHAR(64) NOT NULL COMMENT '审批人姓名',
  task_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '任务状态：PENDING/APPROVED/REJECTED/ESCALATED',
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '接收时间',
  processed_at DATETIME DEFAULT NULL COMMENT '处理时间',
  sla_deadline DATETIME NOT NULL COMMENT 'SLA截止时间',
  escalated TINYINT NOT NULL DEFAULT 0 COMMENT '是否已升级：0否，1是',
  approval_comment VARCHAR(500) DEFAULT NULL COMMENT '审批意见',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_approval_task_instance (instance_id),
  KEY idx_approval_task_approver (approver_id, task_status),
  KEY idx_approval_task_sla (sla_deadline, task_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批任务表';

-- 4. 审批日志表
CREATE TABLE t_approval_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  instance_id BIGINT UNSIGNED NOT NULL COMMENT '关联实例ID',
  task_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联任务ID',
  action VARCHAR(32) NOT NULL COMMENT '操作：SUBMIT/APPROVE/REJECT/CANCEL/ESCALATE',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '操作人ID',
  operator_name VARCHAR(64) NOT NULL COMMENT '操作人姓名',
  from_status VARCHAR(32) DEFAULT NULL COMMENT '原状态',
  to_status VARCHAR(32) DEFAULT NULL COMMENT '新状态',
  comment VARCHAR(500) DEFAULT NULL COMMENT '操作备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_approval_log_instance (instance_id),
  KEY idx_approval_log_operator (operator_id),
  KEY idx_approval_log_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批日志表';

-- 5. 审批人配置表（角色与用户的映射）
CREATE TABLE t_approval_approver (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  approver_type VARCHAR(32) NOT NULL COMMENT '审批人类型：ROLE/USER/DEPARTMENT',
  approver_value VARCHAR(64) NOT NULL COMMENT '审批人值：角色代码/用户ID/部门ID',
  approver_name VARCHAR(64) NOT NULL COMMENT '审批人名称',
  backup_approver_id BIGINT UNSIGNED DEFAULT NULL COMMENT '备用审批人ID',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_approval_approver_type (approver_type, approver_value, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批人配置表';

-- 6. 审批通知表
CREATE TABLE t_approval_notification (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '通知ID',
  instance_id BIGINT UNSIGNED NOT NULL COMMENT '关联实例ID',
  task_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联任务ID',
  notification_type VARCHAR(32) NOT NULL COMMENT '通知类型：NEW_TASK/ESCALATION/REMINDER/RESULT',
  recipient_id BIGINT UNSIGNED NOT NULL COMMENT '接收人ID',
  recipient_name VARCHAR(64) NOT NULL COMMENT '接收人姓名',
  title VARCHAR(255) NOT NULL COMMENT '通知标题',
  content TEXT NOT NULL COMMENT '通知内容',
  channel VARCHAR(32) NOT NULL DEFAULT 'SYSTEM' COMMENT '通知渠道：SYSTEM/WECHAT/SMS/EMAIL',
  read_status TINYINT NOT NULL DEFAULT 0 COMMENT '已读状态：0未读，1已读',
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  read_at DATETIME DEFAULT NULL COMMENT '已读时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_approval_notification_recipient (recipient_id, read_status),
  KEY idx_approval_notification_instance (instance_id),
  KEY idx_approval_notification_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批通知表';

-- 编号: 015, 描述: 客户拜访记录表, 创建人: 阿坚, 日期: 2026-07-06

-- P1-08: 客户拜访记录表
-- 用于记录销售人员拜访客户的详细信息

CREATE TABLE IF NOT EXISTS t_customer_visit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '拜访记录ID',
  visit_no VARCHAR(64) NOT NULL COMMENT '拜访单号',
  customer_id BIGINT UNSIGNED NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) NOT NULL COMMENT '客户名称快照',
  customer_mobile VARCHAR(20) DEFAULT NULL COMMENT '客户手机号',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '所属门店ID',
  visitor_id BIGINT UNSIGNED NOT NULL COMMENT '拜访人(员工ID)',
  visitor_name VARCHAR(64) NOT NULL COMMENT '拜访人姓名',
  visit_type VARCHAR(32) NOT NULL DEFAULT 'ONSITE' COMMENT '拜访类型：ONSITE(现场拜访)/PHONE(电话拜访)/ONLINE(线上拜访)',
  visit_purpose VARCHAR(32) NOT NULL DEFAULT 'ROUTINE' COMMENT '拜访目的：ROUTINE(常规拜访)/ORDER(下单)/COLLECTION(催收)/COMPLAINT(投诉处理)/PROMOTION(推广)/AFTER_SALE(售后)',
  visit_date DATE NOT NULL COMMENT '拜访日期',
  start_time DATETIME DEFAULT NULL COMMENT '拜访开始时间',
  end_time DATETIME DEFAULT NULL COMMENT '拜访结束时间',
  duration_minutes INT DEFAULT NULL COMMENT '拜访时长(分钟)',
  address VARCHAR(255) DEFAULT NULL COMMENT '拜访地址',
  latitude DECIMAL(10, 7) DEFAULT NULL COMMENT '纬度',
  longitude DECIMAL(10, 7) DEFAULT NULL COMMENT '经度',
  contact_person VARCHAR(64) DEFAULT NULL COMMENT '联系人',
  contact_position VARCHAR(64) DEFAULT NULL COMMENT '联系人职位',
  contact_mobile VARCHAR(20) DEFAULT NULL COMMENT '联系人电话',
  visit_summary TEXT COMMENT '拜访总结',
  follow_up_required TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否需要跟进：0否 1是',
  follow_up_date DATE DEFAULT NULL COMMENT '下次跟进日期',
  follow_up_content VARCHAR(255) DEFAULT NULL COMMENT '跟进内容说明',
  next_action VARCHAR(255) DEFAULT NULL COMMENT '下一步行动计划',
  status VARCHAR(32) NOT NULL DEFAULT 'PLANNED' COMMENT '状态：PLANNED(计划中)/VISITED(已拜访)/COMPLETED(已完成)/CANCELLED(已取消)',
  related_order_no VARCHAR(64) DEFAULT NULL COMMENT '关联订单号',
  images JSON DEFAULT NULL COMMENT '拜访照片(JSON数组)',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_customer_visit_no (visit_no),
  KEY idx_customer_visit_customer (customer_id),
  KEY idx_customer_visit_visitor (visitor_id),
  KEY idx_customer_visit_date (visit_date),
  KEY idx_customer_visit_status (status),
  KEY idx_customer_visit_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户拜访记录表';

-- 4. 租户模块访问权限表（tenant_module_access）
CREATE TABLE IF NOT EXISTS t_tenant_module_access (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL COMMENT '租户ID',
  module_code VARCHAR(64) NOT NULL COMMENT '模块编码（如：sales/purchase/inventory/marketing）',
  module_name VARCHAR(128) NOT NULL COMMENT '模块名称',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  granted_by VARCHAR(32) NOT NULL DEFAULT 'PLAN' COMMENT '授权方式（PLAN/MANUAL/ADDON）',
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  expire_at DATETIME COMMENT '过期时间（NULL表示永久）',
  remark VARCHAR(255) COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_tenant_module (tenant_id, module_code),
  INDEX idx_tenant_module_tenant (tenant_id),
  INDEX idx_tenant_module_enabled (enabled),
  
  FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户模块访问权限表';

-- 5. 订阅操作日志表（subscription_operation_log）
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

-- 6. 租户管理员表（tenant_admin）
CREATE TABLE IF NOT EXISTS t_tenant_admin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL COMMENT '租户ID',
  user_id INT NOT NULL COMMENT '用户ID（关联sys_user）',
  role VARCHAR(32) NOT NULL DEFAULT 'ADMIN' COMMENT '角色（ADMIN/SUPER_ADMIN）',
  is_primary TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否主管理员',
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_tenant_user (tenant_id, user_id),
  INDEX idx_tenant_admin_tenant (tenant_id),
  INDEX idx_tenant_admin_user (user_id),
  
  FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户管理员表';

-- 3. 即时零售轮播图表（retail_banner）
CREATE TABLE IF NOT EXISTS t_retail_banner (
  id INT AUTO_INCREMENT PRIMARY KEY,
  banner_title VARCHAR(128) NOT NULL COMMENT '轮播图标题',
  banner_image VARCHAR(255) NOT NULL COMMENT '轮播图URL',
  link_type VARCHAR(32) COMMENT '链接类型（PRODUCT/CATEGORY/URL）',
  link_value VARCHAR(255) COMMENT '链接值（商品ID/分类ID/URL）',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  start_time DATETIME COMMENT '开始时间',
  end_time DATETIME COMMENT '结束时间',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status),
  INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='即时零售轮播图表';

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
  INDEX idx_product (product_id),
  FOREIGN KEY (order_id) REFERENCES retail_order(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='即时零售订单商品表';

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

-- 编号: 020, 描述: V3版本支付与小程序迁移, 创建人: 阿坚, 日期: 2026-07-06

-- ============================================================
-- 智享全链 v3 迁移：支付配置 + 小程序平台 + 模板系统
-- 版本：v3.0 | 日期：2026-07-01
-- 执行方式：mysql -u root -p liquor_inventory < migrate_v3_payment_miniapp.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. 支付配置表（独立，不放 sys_config）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS t_payment_config (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id     VARCHAR(64)  NOT NULL,
  provider      VARCHAR(20)  NOT NULL COMMENT 'wechat/alipay/unionpay',
  config_key    VARCHAR(64)  NOT NULL,
  config_value  TEXT         NOT NULL,
  is_encrypted  TINYINT      NOT NULL DEFAULT 0 COMMENT '是否加密存储',
  description   VARCHAR(255) NOT NULL DEFAULT '',
  sort_order    INT          NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_provider_key (tenant_id, provider, config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付渠道配置';

-- ────────────────────────────────────────────────────────────
-- 3. 小程序平台配置表
-- 注意：app_id 是小程序AppID（来自 mp.weixin.qq.com），不同于支付AppID
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS t_miniapp_config (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id       VARCHAR(64)  NOT NULL,
  platform        VARCHAR(20)  NOT NULL COMMENT 'WECHAT/ALIPAY/DOUYIN/KUAISHOU',
  app_id          VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '小程序 AppID（来自公众平台/开放平台）',
  app_secret      VARCHAR(512) NOT NULL DEFAULT '' COMMENT 'AppSecret（加密存储）',
  app_name        VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '小程序名称',
  app_description VARCHAR(255) NOT NULL DEFAULT '' COMMENT '小程序描述',
  app_icon        VARCHAR(512) NOT NULL DEFAULT '' COMMENT '小程序图标URL',
  app_version     VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '应用版本号',
  template_id     INT          NULL     COMMENT '关联 miniapp_template.id',
  status          VARCHAR(20)  NOT NULL DEFAULT 'draft' COMMENT 'draft/published',
  audit_status    VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT 'pending/submitted/approved/rejected',
  audit_reason    VARCHAR(512) NOT NULL DEFAULT '' COMMENT '审核原因/备注',
  publish_version VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '发布版本号',
  published_at    DATETIME     NULL,
  -- 联系人信息
  contact_name    VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '联系人姓名',
  contact_email   VARCHAR(128) NOT NULL DEFAULT '' COMMENT '联系人邮箱',
  contact_phone   VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '联系人电话',
  -- 域名设置
  domain_whitelist JSON        NULL     COMMENT '域名白名单 ["url1","url2"]',
  business_domain  JSON        NULL     COMMENT '业务域名',
  webview_domain   JSON        NULL     COMMENT 'webview域名',
  -- 其他
  qrcode_url      VARCHAR(512) NOT NULL DEFAULT '' COMMENT '小程序码URL',
  privacy_url     VARCHAR(512) NOT NULL DEFAULT '' COMMENT '隐私协议URL',
  service_agreement_url VARCHAR(512) NOT NULL DEFAULT '' COMMENT '服务协议URL',
  -- 隐私和功能开关
  required_privacy_setting TINYINT NOT NULL DEFAULT 0 COMMENT '是否强制隐私设置',
  allow_guest     TINYINT      NOT NULL DEFAULT 1 COMMENT '允许游客访问',
  allow_location  TINYINT      NOT NULL DEFAULT 1 COMMENT '允许获取位置',
  allow_phone     TINYINT      NOT NULL DEFAULT 1 COMMENT '允许获取手机号',
  allow_share     TINYINT      NOT NULL DEFAULT 1 COMMENT '允许分享',
  allow_subscribe TINYINT      NOT NULL DEFAULT 1 COMMENT '允许订阅消息',
  allow_payment   TINYINT      NOT NULL DEFAULT 1 COMMENT '允许支付',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_platform (tenant_id, platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序平台配置';

-- ────────────────────────────────────────────────────────────
-- 4. 小程序模板仓库
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS t_miniapp_template (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id    VARCHAR(64)  NOT NULL DEFAULT 'DEFAULT' COMMENT '租户ID（DEFAULT=全局模板）',
  name         VARCHAR(64)  NOT NULL COMMENT '模板名称',
  description  VARCHAR(255) NOT NULL DEFAULT '' COMMENT '模板描述',
  thumbnail    VARCHAR(512) NOT NULL DEFAULT '' COMMENT '缩略图URL',
  preview_urls JSON         NULL     COMMENT '预览截图URL列表 ["url1","url2"]',
  style_config JSON         NOT NULL COMMENT '样式配置: {primaryColor, backgroundColor, ...}',
  page_config  JSON         NOT NULL COMMENT '页面配置: {homeLayout, productCardStyle, ...}',
  version      VARCHAR(20)  NOT NULL DEFAULT '1.0.0',
  status       VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT 'active/inactive',
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序模板';

-- ────────────────────────────────────────────────────────────
-- 5. 小程序发布日志
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS t_miniapp_publish_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   VARCHAR(64)  NOT NULL,
  platform    VARCHAR(20)  NOT NULL DEFAULT 'WECHAT',
  template_id INT          NULL,
  action      VARCHAR(20)  NOT NULL COMMENT 'publish/update/offline',
  version     VARCHAR(20)  NOT NULL DEFAULT '',
  result      VARCHAR(20)  NOT NULL COMMENT 'success/failed',
  remark      VARCHAR(512) NOT NULL DEFAULT '' COMMENT '发布备注',
  status      VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '状态: published/rollback/audit_submitted',
  error_msg   TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant_platform (tenant_id, platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序发布日志';

-- 编号: 049, 描述: 添加订单同步日志表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_miniapp_order_sync_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(64) NOT NULL COMMENT '订单号',
  platform VARCHAR(32) NOT NULL COMMENT '平台',
  sync_type VARCHAR(32) NOT NULL COMMENT '同步类型：STATUS/SKU/PRICE/STOCK',
  sync_direction VARCHAR(32) NOT NULL COMMENT '方向：PUSH_TO_PLATFORM/PULL_FROM_PLATFORM',
  request_data JSON DEFAULT NULL COMMENT '请求数据',
  response_data JSON DEFAULT NULL COMMENT '响应数据',
  status VARCHAR(32) NOT NULL COMMENT '状态：SUCCESS/FAILED',
  error_msg VARCHAR(512) DEFAULT NULL COMMENT '错误信息',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_order_no (order_no),
  INDEX idx_platform (platform),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序订单同步日志表';

-- 编号: 050, 描述: 添加平台对账表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_platform_reconciliation (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform VARCHAR(32) NOT NULL COMMENT '平台',
  reconciliation_date DATE NOT NULL COMMENT '对账日期',
  platform_order_count INT NOT NULL DEFAULT 0 COMMENT '平台订单数',
  platform_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '平台金额',
  system_order_count INT NOT NULL DEFAULT 0 COMMENT '系统订单数',
  system_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '系统金额',
  diff_count INT NOT NULL DEFAULT 0 COMMENT '差异单数',
  diff_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '差异金额',
  commission_amount DECIMAL(12,2) DEFAULT NULL COMMENT '佣金金额',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/MATCHED/DIFF/ADJUSTED',
  operator_id BIGINT UNSIGNED DEFAULT NULL COMMENT '对账人',
  adjusted_at DATETIME DEFAULT NULL COMMENT '调整时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_platform_date (platform, reconciliation_date),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台对账表';

-- 编号: 051, 描述: 添加平台审核表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_platform_review (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform VARCHAR(32) NOT NULL COMMENT '平台',
  platform_review_id VARCHAR(128) DEFAULT NULL COMMENT '平台评价ID',
  order_no VARCHAR(64) NOT NULL COMMENT '关联订单号',
  rating TINYINT NOT NULL COMMENT '评分：1-5',
  content TEXT DEFAULT NULL COMMENT '评价内容',
  reply_content VARCHAR(500) DEFAULT NULL COMMENT '回复内容',
  replied_at DATETIME DEFAULT NULL COMMENT '回复时间',
  synced_at DATETIME DEFAULT NULL COMMENT '同步时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_no (order_no),
  INDEX idx_platform (platform),
  INDEX idx_rating (rating),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台评价表';

-- 编号: 052, 描述: 添加零售公告表, 创建人: 阿坚, 日期: 2026-07-05
-- 更新: 2026-07-23 R55-01 新增 tenant_id 列用于租户隔离（修复跨租户数据泄露）
-- 说明：原表无 tenant_id 列，所有 SQL 仅按 store_id 过滤且 storeId 来自用户输入，
--       任何认证用户可跨租户访问/修改/删除其他租户公告。本次新增 tenant_id 列。

CREATE TABLE IF NOT EXISTS t_retail_announcement (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  title VARCHAR(128) NOT NULL COMMENT '公告标题',
  content TEXT NOT NULL COMMENT '公告内容',
  is_top TINYINT NOT NULL DEFAULT 0 COMMENT '是否置顶',
  start_time DATETIME DEFAULT NULL COMMENT '开始展示时间',
  end_time DATETIME DEFAULT NULL COMMENT '结束展示时间',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_store (store_id),
  INDEX idx_status_time (status, start_time, end_time),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序公告表';

-- 编号: 054, 描述: 添加零售客户地址表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_retail_consumer_address (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  name VARCHAR(64) NOT NULL COMMENT '收货人姓名',
  mobile VARCHAR(20) NOT NULL COMMENT '收货人手机',
  province VARCHAR(64) NOT NULL COMMENT '省',
  city VARCHAR(64) NOT NULL COMMENT '市',
  district VARCHAR(64) NOT NULL COMMENT '区',
  detail VARCHAR(255) NOT NULL COMMENT '详细地址',
  is_default TINYINT NOT NULL DEFAULT 0 COMMENT '是否默认地址',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_default (user_id, is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消费者收货地址表';

-- 编号: 055, 描述: 添加积分商城商品表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_points_mall_item (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL COMMENT '商品名称',
  image VARCHAR(255) DEFAULT NULL COMMENT '商品图片',
  points INT NOT NULL COMMENT '所需积分',
  stock INT NOT NULL DEFAULT 0 COMMENT '库存',
  limit_per_user INT NOT NULL DEFAULT 1 COMMENT '每人限兑',
  valid_start DATE DEFAULT NULL COMMENT '有效期开始',
  valid_end DATE DEFAULT NULL COMMENT '有效期结束',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/INACTIVE',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分商城商品表';

-- 编号: 056, 描述: 添加积分商城订单表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_points_mall_order (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(64) NOT NULL COMMENT '订单号',
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  item_id BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  item_name VARCHAR(128) NOT NULL COMMENT '商品名称',
  points INT NOT NULL COMMENT '消耗积分',
  quantity INT NOT NULL DEFAULT 1 COMMENT '兑换数量',
  receiver_name VARCHAR(64) DEFAULT NULL COMMENT '收货人',
  receiver_mobile VARCHAR(20) DEFAULT NULL COMMENT '收货电话',
  receiver_address VARCHAR(255) DEFAULT NULL COMMENT '收货地址',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/DELIVERED/CANCELLED',
  delivered_at DATETIME DEFAULT NULL COMMENT '发货时间',
  cancelled_at DATETIME DEFAULT NULL COMMENT '取消时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_order_no (order_no),
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分商城订单表';

-- 编号: 057, 描述: 添加营销资产表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_marketing_asset (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL COMMENT '素材名称',
  type VARCHAR(32) NOT NULL COMMENT '类型：IMAGE/VIDEO/COPYWRITING',
  url VARCHAR(500) DEFAULT NULL COMMENT '素材URL',
  thumbnail_url VARCHAR(500) DEFAULT NULL COMMENT '缩略图URL',
  content TEXT DEFAULT NULL COMMENT '文案内容',
  category VARCHAR(64) DEFAULT NULL COMMENT '分类',
  tags JSON DEFAULT NULL COMMENT '标签',
  file_size BIGINT DEFAULT NULL COMMENT '文件大小(字节)',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/INACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_category (category),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营销素材表';

-- 编号: 058, 描述: 添加系统部门表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_sys_department (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id BIGINT UNSIGNED DEFAULT NULL COMMENT '父部门ID',
  name VARCHAR(64) NOT NULL COMMENT '部门名称',
  store_id BIGINT UNSIGNED DEFAULT NULL COMMENT '所属门店',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_parent (parent_id),
  INDEX idx_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门表';

-- 编号: 059, 描述: 添加用户会话表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_user_session (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  token VARCHAR(512) NOT NULL COMMENT '会话令牌',
  device_type VARCHAR(32) DEFAULT NULL COMMENT '设备类型：WEB/MINIAPP/IOS/ANDROID',
  device_info VARCHAR(255) DEFAULT NULL COMMENT '设备信息',
  ip VARCHAR(64) DEFAULT NULL COMMENT 'IP地址',
  expires_at DATETIME NOT NULL COMMENT '过期时间',
  last_activity_at DATETIME DEFAULT NULL COMMENT '最后活跃时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_token (token(191)),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户会话表';

-- 编号: 060, 描述: 添加自定义报表模板表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_custom_report_template (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL COMMENT '模板名称',
  type VARCHAR(32) NOT NULL COMMENT '报表类型：SALES/INVENTORY/FINANCE/CUSTOMER',
  config JSON NOT NULL COMMENT '报表配置（指标、维度、筛选条件）',
  creator_id BIGINT UNSIGNED NOT NULL COMMENT '创建人',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_creator (creator_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自定义报表模板表';

-- 编号: 061, 描述: 添加自定义报表计划表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_custom_report_schedule (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id BIGINT UNSIGNED NOT NULL COMMENT '模板ID',
  name VARCHAR(128) NOT NULL COMMENT '任务名称',
  cron_expression VARCHAR(64) NOT NULL COMMENT '定时表达式',
  export_format VARCHAR(16) DEFAULT 'EXCEL' COMMENT '导出格式：EXCEL/PDF',
  recipients JSON DEFAULT NULL COMMENT '接收人列表',
  last_run_at DATETIME DEFAULT NULL COMMENT '上次执行时间',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/PAUSED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_template (template_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定时报表导出表';

-- 编号: 062, 描述: 添加报表权限矩阵表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS t_report_permission_matrix (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  report_code VARCHAR(64) NOT NULL COMMENT '报表编码',
  store_scope VARCHAR(32) NOT NULL DEFAULT 'SELF' COMMENT '门店范围：SELF/CHILDREN/ALL',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_report (role_id, report_code),
  INDEX idx_role (role_id),
  INDEX idx_report (report_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报表权限矩阵表';

-- 编号: 067, 描述: 添加单位组表, 创建人: 阿坚, 日期: 2026-07-05
-- 支持 4-5 级自定义单位（箱>包>条>合>个）及换算率

CREATE TABLE IF NOT EXISTS t_unit_group (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL COMMENT '单位组名称',
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='单位组表';

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
  INDEX idx_level (group_id, level),
  CONSTRAINT fk_item_group FOREIGN KEY (group_id) REFERENCES unit_group(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='单位层级明细表';

-- 10. 零售评价表
CREATE TABLE IF NOT EXISTS `t_retail_review` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT NOT NULL COMMENT '订单ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `product_id` BIGINT DEFAULT NULL COMMENT '商品ID',
  `platform` VARCHAR(20) DEFAULT NULL COMMENT '来源平台',
  `platform_review_id` VARCHAR(64) DEFAULT NULL COMMENT '平台评价ID',
  `rating` DECIMAL(2,1) NOT NULL COMMENT '评分',
  `review_content` VARCHAR(1000) DEFAULT NULL COMMENT '评价内容',
  `review_images` JSON DEFAULT NULL COMMENT '评价图片',
  `review_tags` JSON DEFAULT NULL COMMENT '评价标签',
  `reply` VARCHAR(1000) DEFAULT NULL COMMENT '商家回复',
  `reply_at` DATETIME DEFAULT NULL COMMENT '回复时间',
  `is_anonymous` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否匿名',
  `status` VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED' COMMENT '状态',
  `tenant_id` VARCHAR(32) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_platform_review` (`platform_review_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='零售评价表';

-- ============================================================
-- 第3步：新建数据权限表（行级数据过滤规则）
-- ============================================================
CREATE TABLE t_sys_data_permission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  role_id BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  table_name VARCHAR(64) NOT NULL COMMENT '表名',
  field_name VARCHAR(64) NOT NULL COMMENT '字段名',
  condition_type VARCHAR(16) NOT NULL COMMENT '条件类型：EQ(等于)/IN(在集合中)/LIKE(模糊)/OWN(自己的数据)',
  condition_value VARCHAR(512) DEFAULT NULL COMMENT '条件值，JSON格式',
  description VARCHAR(255) DEFAULT NULL COMMENT '规则说明',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_data_perm (role_id, table_name, field_name, tenant_id),
  KEY idx_data_perm_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据权限表';

-- ============================================================
-- 第4步：新建字段权限表（字段可见性/可编辑性）
-- ============================================================
CREATE TABLE t_sys_field_permission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  role_id BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  table_name VARCHAR(64) NOT NULL COMMENT '表名',
  field_name VARCHAR(64) NOT NULL COMMENT '字段名',
  permission_type VARCHAR(16) NOT NULL COMMENT '权限类型：VISIBLE(可见)/HIDDEN(隐藏)/READONLY(只读)/EDITABLE(可编辑)',
  description VARCHAR(255) DEFAULT NULL COMMENT '字段说明',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_field_perm (role_id, table_name, field_name, tenant_id),
  KEY idx_field_perm_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='字段权限表';

-- 平台操作日志
CREATE TABLE IF NOT EXISTS t_platform_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL COMMENT '操作人ID',
  admin_name VARCHAR(64) NOT NULL COMMENT '操作人姓名',
  action VARCHAR(64) NOT NULL COMMENT '操作类型',
  target_type VARCHAR(64) NOT NULL COMMENT '操作对象类型',
  target_id VARCHAR(64) DEFAULT NULL COMMENT '操作对象ID',
  detail JSON DEFAULT NULL COMMENT '操作详情',
  ip VARCHAR(45) DEFAULT NULL COMMENT '操作IP',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_id (admin_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台操作日志';

CREATE TABLE t_customer_quote (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '报价单ID',
  quote_no VARCHAR(32) NOT NULL COMMENT '报价单号',
  title VARCHAR(200) NOT NULL COMMENT '报价单标题',
  customer_id BIGINT UNSIGNED NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(100) NOT NULL COMMENT '客户名称（冗余）',
  customer_phone VARCHAR(20) DEFAULT NULL COMMENT '客户电话（冗余）',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE有效/CANCELLED已取消/EXPIRED已过期',
  valid_days INT NOT NULL DEFAULT 7 COMMENT '有效期(天)',
  expire_at DATETIME NOT NULL COMMENT '过期时间',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '总金额',
  total_sku INT NOT NULL DEFAULT 0 COMMENT 'SKU数量',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  view_count INT NOT NULL DEFAULT 0 COMMENT '浏览次数',
  created_by BIGINT UNSIGNED NOT NULL COMMENT '创建人ID',
  share_token VARCHAR(64) DEFAULT NULL COMMENT '分享令牌',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_quote_no (quote_no, tenant_id),
  UNIQUE KEY uk_share_token (share_token),
  KEY idx_customer_id (customer_id, tenant_id),
  KEY idx_status (status, tenant_id),
  KEY idx_created_at (created_at, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户报价单';

-- 报价单明细表
CREATE TABLE t_customer_quote_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '明细ID',
  quote_id BIGINT UNSIGNED NOT NULL COMMENT '报价单ID',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(200) NOT NULL COMMENT 'SKU名称（冗余）',
  quote_price DECIMAL(12,2) NOT NULL COMMENT '报价',
  min_qty INT NOT NULL DEFAULT 1 COMMENT '最小起订量',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_quote_id (quote_id, tenant_id),
  KEY idx_sku_id (sku_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价单明细';

-- 报价推送日志表
CREATE TABLE t_customer_quote_push_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  quote_id BIGINT UNSIGNED NOT NULL COMMENT '报价单ID',
  channel VARCHAR(20) NOT NULL COMMENT '推送渠道：sms/miniapp/email',
  content VARCHAR(500) DEFAULT NULL COMMENT '推送内容',
  target VARCHAR(100) DEFAULT NULL COMMENT '推送目标（手机号/OpenID/邮箱）',
  status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' COMMENT '状态：SUCCESS成功/FAILED失败',
  error_msg VARCHAR(500) DEFAULT NULL COMMENT '错误信息',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_quote_id (quote_id, tenant_id),
  KEY idx_created_at (created_at, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价推送日志';

-- 损益表
CREATE TABLE IF NOT EXISTS t_inventory_loss_gain (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  lg_no VARCHAR(32) NOT NULL COMMENT '损益编号',
  store_id BIGINT NOT NULL COMMENT '门店ID',
  type VARCHAR(10) NOT NULL COMMENT '类型: LOSS/GAIN',
  sku_id BIGINT NOT NULL COMMENT 'SKU ID',
  qty INT NOT NULL COMMENT '数量',
  cost_price DECIMAL(12,2) DEFAULT 0 COMMENT '成本价',
  amount DECIMAL(12,2) DEFAULT 0 COMMENT '损益金额',
  reason VARCHAR(200) DEFAULT NULL COMMENT '原因',
  operator_id BIGINT DEFAULT NULL COMMENT '操作人ID',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/CONFIRMED',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_lg_no (lg_no, tenant_id),
  INDEX idx_store (store_id),
  INDEX idx_sku (sku_id),
  INDEX idx_type (type),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存损益';

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
  updated_at NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_publish_at (publish_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台公告表';