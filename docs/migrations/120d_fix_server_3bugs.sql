-- ============================================================================
-- 编号: 116, 描述: 修复服务器3个P0错误（t_sys_role缺permissions列 + t_subscription/t_subscription_plan表缺失 + t_error_logs缺tenant_id默认值）, 创建人: 凌舟, 日期: 2026-07-29
-- ============================================================================
-- 问题1：admin登录500 — t_sys_role 表缺少 permissions 列（ER_BAD_FIELD_ERROR: Unknown column 'r.permissions'）
-- 问题2：订阅到期扫描报错 — t_subscription / t_subscription_plan 表不存在（ER_NO_SUCH_TABLE）
-- 问题3：错误日志写入失败 — t_error_logs 表 tenant_id 列不允许 NULL（ER_BAD_NULL_ERROR）
-- ============================================================================

USE liquor_inventory;

-- ============================================================
-- 修复1：t_sys_role 表补充 data_scope + permissions 列
-- ============================================================
-- 原因：服务器建表时使用的是 Phase 1 旧版结构（无 permissions / data_scope 列），
--       但 079_权限矩阵.sql 迁移脚本中 INSERT 引用了这些列。
--       init_database.sql 中已有定义，但服务器未执行。
-- 注意：必须先加 data_scope，再加 permissions（permissions 指定 AFTER data_scope）

-- 步骤1：先补充 data_scope 列
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'liquor_inventory' AND TABLE_NAME = 't_sys_role' AND COLUMN_NAME = 'data_scope');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE t_sys_role ADD COLUMN data_scope VARCHAR(32) NOT NULL DEFAULT ''SELF'' COMMENT ''数据范围：ALL/DEPARTMENT/STORE/SELF'' AFTER description',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 步骤2：再补充 permissions 列（依赖 data_scope 已存在）
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'liquor_inventory' AND TABLE_NAME = 't_sys_role' AND COLUMN_NAME = 'permissions');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE t_sys_role ADD COLUMN permissions JSON DEFAULT NULL COMMENT ''权限列表（JSON格式）'' AFTER data_scope',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 插入角色权限数据（如果 t_sys_role 为空或缺少 permissions 值）
-- 使用 ON DUPLICATE KEY UPDATE 确保幂等
INSERT INTO t_sys_role (id, role_code, role_name, description, data_scope, permissions, status, tenant_id)
VALUES
  (1, 'SUPER_ADMIN', '超级管理员', '拥有系统全部权限，可管理所有租户和门店', 'ALL', '["*"]', 1, 'default'),
  (2, 'STORE_MANAGER', '门店店长', '管理本门店的销售、库存、客户、员工', 'STORE', '["store:*","sale:*","customer:*","inventory:*","report:*","dashboard:*"]', 1, 'default'),
  (3, 'SALES_STAFF', '销售员', '负责线下销售开单、客户管理、客户拜访', 'SELF', '["sale:create","sale:view","customer:view","customer:visit","dashboard:view"]', 1, 'default'),
  (4, 'PURCHASER', '采购员', '负责采购订单、供应商管理、入库', 'SELF', '["purchase:create","purchase:view","supplier:view","inventory:in"]', 1, 'default'),
  (5, 'INVENTORY_MANAGER', '库存管理员', '负责库存盘点、库存调拨、库存预警', 'STORE', '["inventory:*","report:inventory"]', 1, 'default'),
  (6, 'FINANCE', '财务', '负责收款付款、对账、财务报表', 'STORE', '["finance:*","report:finance","payment:*"]', 1, 'default'),
  (7, 'STORE_OPERATOR', '门店操作员', '门店日常操作', 'STORE', '["sale:create","sale:view","inventory:view"]', 1, 'default'),
  (8, 'VIEWER', '只读角色', '仅查看权限，无操作权限', 'SELF', '["dashboard:view","report:view"]', 1, 'default')
ON DUPLICATE KEY UPDATE
  permissions = VALUES(permissions),
  data_scope = VALUES(data_scope),
  status = VALUES(status);

-- 确保 t_sys_user_role 表有数据（admin 用户绑定 SUPER_ADMIN 角色）
INSERT IGNORE INTO t_sys_user_role (user_id, role_id, tenant_id)
VALUES (1, 1, 'default');

-- ============================================================
-- 修复2：创建 t_subscription_plan 和 t_subscription 表
-- ============================================================
-- 原因：030/031 迁移脚本中 FOREIGN KEY 引用了 tenant(id) 和 subscription_plan(id)，
--       但服务器表名是 t_tenant（不是 tenant），导致外键创建失败，整张表未创建。
--       此处去掉外键约束，直接建表。

CREATE TABLE IF NOT EXISTS `t_subscription_plan` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `plan_code` VARCHAR(32) NOT NULL UNIQUE COMMENT '套餐编码（如：BASIC/STANDARD/PROFESSIONAL）',
  `plan_name` VARCHAR(64) NOT NULL COMMENT '套餐名称',
  `plan_type` VARCHAR(32) NOT NULL COMMENT '套餐类型（MONTHLY/YEARLY/PERMANENT）',
  `price` DECIMAL(10,2) NOT NULL COMMENT '价格',
  `original_price` DECIMAL(10,2) COMMENT '原价',
  `duration_days` INT NOT NULL COMMENT '有效天数（如：30/365/9999）',
  `max_users` INT NOT NULL DEFAULT 5 COMMENT '最大用户数',
  `max_stores` INT NOT NULL DEFAULT 1 COMMENT '最大门店数',
  `max_customers` INT NOT NULL DEFAULT 1000 COMMENT '最大客户数',
  `max_products` INT NOT NULL DEFAULT 500 COMMENT '最大商品数',
  `max_storage_mb` INT NOT NULL DEFAULT 1024 COMMENT '最大存储空间（MB）',
  `features` JSON COMMENT '功能特性列表（JSON格式）',
  `module_access` JSON COMMENT '可访问模块（JSON格式）',
  `description` VARCHAR(500) COMMENT '套餐描述',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_plan_code` (`plan_code`),
  INDEX `idx_plan_status` (`status`),
  INDEX `idx_plan_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订阅套餐表';

CREATE TABLE IF NOT EXISTS `t_subscription` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `subscription_no` VARCHAR(32) NOT NULL UNIQUE COMMENT '订阅编号',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `plan_id` INT NOT NULL COMMENT '套餐ID',
  `plan_name` VARCHAR(64) NOT NULL COMMENT '套餐名称（冗余）',
  `plan_type` VARCHAR(32) NOT NULL COMMENT '套餐类型',
  `start_date` DATE NOT NULL COMMENT '开始日期',
  `end_date` DATE NOT NULL COMMENT '结束日期',
  `duration_days` INT NOT NULL COMMENT '有效天数',
  `price` DECIMAL(10,2) NOT NULL COMMENT '订阅价格',
  `payment_status` VARCHAR(16) NOT NULL DEFAULT 'UNPAID' COMMENT '支付状态',
  `payment_method` VARCHAR(32) COMMENT '支付方式',
  `paid_at` DATETIME COMMENT '支付时间',
  `transaction_no` VARCHAR(128) COMMENT '交易流水号',
  `auto_renew` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否自动续费',
  `renew_price` DECIMAL(10,2) COMMENT '续费价格',
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态',
  `cancel_reason` VARCHAR(255) COMMENT '取消原因',
  `cancelled_at` DATETIME COMMENT '取消时间',
  `expire_notify_sent` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已发送到期通知',
  `expire_notify_at` DATETIME COMMENT '到期通知发送时间',
  `remark` VARCHAR(500) COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_subscription_no` (`subscription_no`),
  INDEX `idx_subscription_tenant` (`tenant_id`),
  INDEX `idx_subscription_plan` (`plan_id`),
  INDEX `idx_subscription_status` (`status`),
  INDEX `idx_subscription_end_date` (`end_date`),
  INDEX `idx_subscription_payment` (`payment_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订阅表';

-- 插入默认套餐（如果表为空）
INSERT IGNORE INTO `t_subscription_plan` (`id`, `plan_code`, `plan_name`, `plan_type`, `price`, `duration_days`, `max_users`, `max_stores`, `status`, `sort_order`)
VALUES
  (1, 'BASIC', '基础版', 'MONTHLY', 199.00, 30, 5, 1, 'ACTIVE', 1),
  (2, 'STANDARD', '标准版', 'YEARLY', 1999.00, 365, 20, 3, 'ACTIVE', 2),
  (3, 'PROFESSIONAL', '专业版', 'YEARLY', 4999.00, 365, 100, 10, 'ACTIVE', 3);

-- 为 default 租户插入一条默认订阅（确保订阅扫描器有数据）
INSERT IGNORE INTO `t_subscription` (`subscription_no`, `tenant_id`, `plan_id`, `plan_name`, `plan_type`, `start_date`, `end_date`, `duration_days`, `price`, `payment_status`, `status`)
VALUES ('SUB20260701001', 'default', 1, '基础版', 'MONTHLY', '2026-07-01', '2027-07-01', 365, 199.00, 'PAID', 'ACTIVE');

-- ============================================================
-- 修复3：t_error_logs 表 tenant_id 列允许 NULL
-- ============================================================
-- 原因：error-handler.ts 中 insertErrorLog 在未登录场景下 tenant_id 为 null，
--       但服务器 t_error_logs 表 tenant_id 列为 NOT NULL，导致写入失败。
SET @col_nullable = (SELECT IS_NULLABLE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'liquor_inventory' AND TABLE_NAME = 't_error_logs' AND COLUMN_NAME = 'tenant_id');
SET @sql = IF(@col_nullable = 'NO',
  'ALTER TABLE t_error_logs MODIFY COLUMN tenant_id VARCHAR(64) DEFAULT NULL COMMENT ''租户ID''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 如果 t_error_logs 表不存在，创建它
CREATE TABLE IF NOT EXISTS `t_error_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `error_type` VARCHAR(64) NOT NULL COMMENT '错误类型',
  `severity` VARCHAR(16) NOT NULL DEFAULT 'ERROR' COMMENT '严重级别：FATAL/ERROR/WARN/INFO',
  `message` TEXT NOT NULL COMMENT '错误消息',
  `stack` TEXT COMMENT '错误堆栈',
  `request_url` VARCHAR(500) DEFAULT NULL COMMENT '请求URL',
  `request_method` VARCHAR(10) DEFAULT NULL COMMENT '请求方法',
  `status_code` INT DEFAULT NULL COMMENT 'HTTP状态码',
  `user_id` VARCHAR(64) DEFAULT NULL COMMENT '用户ID',
  `tenant_id` VARCHAR(64) DEFAULT NULL COMMENT '租户ID',
  `source` VARCHAR(16) DEFAULT 'backend' COMMENT '来源：backend/frontend',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_error_type` (`error_type`),
  INDEX `idx_severity` (`severity`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='错误日志表';
