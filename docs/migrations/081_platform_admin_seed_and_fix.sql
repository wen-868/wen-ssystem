-- 编号: 081, 描述: 平台管理员初始数据 + 表结构补全 + 字段名修复, 创建人: 凌舟, 日期: 2026-07-28
-- ============================================================
-- 问题1：t_platform_admin 表无初始数据，saas.onepan.cn 无法登录
-- 问题2：platform-auth.service.ts 中 SQL 查询字段名 'password' 应为 'password_hash'（代码已修复）
-- 问题3：admin-account.service.ts INSERT 引用 created_by 列但表结构中不存在
-- 问题4：admin-account.service.ts SELECT 引用 last_login_at 列但表结构中不存在
-- 问题5：admin-account.service.ts status 用字符串 'ACTIVE'/'DISABLED' 但表是 TINYINT(1/0)
-- ============================================================

USE liquor_inventory;

-- 1. 确保表存在（幂等，与 080 迁移脚本一致）
CREATE TABLE IF NOT EXISTS t_platform_admin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE COMMENT '登录账号',
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt 密码哈希',
  real_name VARCHAR(64) NOT NULL COMMENT '真实姓名',
  email VARCHAR(128) DEFAULT NULL COMMENT '邮箱',
  phone VARCHAR(32) DEFAULT NULL COMMENT '手机号',
  role VARCHAR(32) NOT NULL DEFAULT 'PLATFORM_ADMIN' COMMENT '角色: PLATFORM_ADMIN / PLATFORM_SUPER_ADMIN',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1=启用 0=禁用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台管理员';

-- 2. 补充缺失字段（幂等）
-- last_login_at：admin-account.service.ts 列表查询需要
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'liquor_inventory' AND TABLE_NAME = 't_platform_admin' AND COLUMN_NAME = 'last_login_at');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE t_platform_admin ADD COLUMN last_login_at DATETIME DEFAULT NULL COMMENT ''最后登录时间'' AFTER status',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- created_by：admin-account.service.ts INSERT 需要
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'liquor_inventory' AND TABLE_NAME = 't_platform_admin' AND COLUMN_NAME = 'created_by');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE t_platform_admin ADD COLUMN created_by VARCHAR(64) DEFAULT ''system'' COMMENT ''创建人'' AFTER last_login_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. 插入默认平台超级管理员（admin / admin123）
--    密码哈希：bcrypt.hashSync('admin123', 12)，前缀 v2$ 为系统版本标识
INSERT INTO t_platform_admin (username, password_hash, real_name, email, phone, role, status)
VALUES (
  'admin',
  'v2$$2b$12$biWP7DS78S7ZGnRr7j44lOUVoRHQsWSkMWws3Y6yoZTtA3j/zWECq',
  '平台超级管理员',
  'admin@onepan.cn',
  '13800000000',
  'PLATFORM_SUPER_ADMIN',
  1
)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  status = VALUES(status),
  updated_at = NOW();

-- 4. 验证数据
SELECT id, username, LEFT(password_hash, 10) AS hash_prefix, role, status, last_login_at, created_by FROM t_platform_admin;
