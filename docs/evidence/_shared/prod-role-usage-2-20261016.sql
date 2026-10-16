-- 生产只读：角色 × 在用账号数 + 账号明细（**不取 password/password_hash/mfa_secret**）
SELECT '=== 1. 角色 × 分配账号数（default 租户） ===';
SELECT r.role_code,
       COUNT(ur.user_id) AS assigned,
       SUM(CASE WHEN u.status = 1 THEN 1 ELSE 0 END) AS active
FROM t_sys_role r
LEFT JOIN t_sys_user_role ur ON ur.role_id = r.id AND ur.tenant_id = 'default'
LEFT JOIN t_sys_user u ON u.id = ur.user_id
WHERE r.tenant_id = 'default'
GROUP BY r.role_code
ORDER BY active DESC, r.role_code;

SELECT '=== 2. 账号明细（用户名 / 角色 / 状态 / 最后登录） ===';
SELECT u.username, COALESCE(r.role_code,'(无角色)') AS role_code, u.status, u.last_login_at
FROM t_sys_user u
LEFT JOIN t_sys_user_role ur ON ur.user_id = u.id AND ur.tenant_id = 'default'
LEFT JOIN t_sys_role r ON r.id = ur.role_id
WHERE u.tenant_id = 'default'
ORDER BY u.id;
