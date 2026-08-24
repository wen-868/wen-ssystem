-- 编号: 127, 描述: 修复演示账号（store_manager/store_operator 密码 admin123，bcrypt 兼容哈希）
-- 说明: 002_phase1_seed.sql 中的旧哈希为 SHA256，与后端 bcrypt 校验不兼容，
--       本脚本用 bcrypt(v2$) 哈希重建演示账号；幂等，可重复执行。

USE liquor_inventory;

-- 1) 修复演示账号密码哈希（v2$ + bcrypt(admin123, cost=12)）
INSERT INTO t_sys_user (tenant_id, username, password_hash, real_name, mobile, store_id, status, created_at, updated_at)
VALUES
  ('default', 'store_manager', 'v2$$2b$12$onxTslZGnbLqxNBA0GExa.I/UCHfvJ4enB5qVWpbyhkj3j9FOg7I6', '默认店长', '13800000001', 1, 1, NOW(), NOW()),
  ('default', 'store_operator', 'v2$$2b$12$onxTslZGnbLqxNBA0GExa.I/UCHfvJ4enB5qVWpbyhkj3j9FOg7I6', '默认店员', '13800000002', 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  real_name = VALUES(real_name),
  mobile = VALUES(mobile),
  store_id = VALUES(store_id),
  status = VALUES(status);

-- 2) 绑定角色（幂等）
INSERT INTO t_sys_user_role (user_id, role_id)
SELECT u.id, r.id FROM t_sys_user u JOIN t_sys_role r ON r.role_code = 'SUPER_ADMIN'
WHERE u.username = 'store_manager'
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

INSERT INTO t_sys_user_role (user_id, role_id)
SELECT u.id, r.id FROM t_sys_user u JOIN t_sys_role r ON r.role_code = 'STORE_OPERATOR'
WHERE u.username = 'store_operator'
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

-- 3) 校验（应输出 2 行，密码哈希均以 v2$ 开头）
SELECT username, LEFT(password_hash, 8) AS hash_prefix, store_id, status
FROM t_sys_user
WHERE username IN ('store_manager', 'store_operator');
