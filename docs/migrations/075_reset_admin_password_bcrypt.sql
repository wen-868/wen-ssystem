-- 编号: 075, 描述: 重置admin用户密码为bcrypt格式, 创建人: 凌舟, 日期: 2026-07-28
-- 问题：种子数据002中使用SHA256哈希存储密码，但后端verifyPassword使用bcrypt验证，导致登录永远失败
-- 修复：将admin/store_manager/store_operator三个用户的password_hash更新为bcrypt格式（带v2$前缀）
-- 默认密码：admin123

USE liquor_inventory;

-- 生成方式：bcrypt.hashSync('admin123', 12)，前缀 v2$ 为系统版本标识
UPDATE t_sys_user
SET password_hash = 'v2$$2b$12$biWP7DS78S7ZGnRr7j44lOUVoRHQsWSkMWws3Y6yoZTtA3j/zWECq',
    login_fail_count = 0,
    locked_until = NULL,
    updated_at = NOW()
WHERE username IN ('admin', 'store_manager', 'store_operator');
