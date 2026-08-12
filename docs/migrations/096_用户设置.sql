-- 编号: 096, 描述: 用户设置, 创建人: 阿坚, 日期: 2026-07-05
-- --------------------------------------------------------------------------
-- 用户设置扩展：添加用户默认首页字段
-- 用途：支持用户自定义默认进入工作台还是收银台
-- --------------------------------------------------------------------------

-- 添加 default_homepage 字段到 sys_user 表
ALTER TABLE t_sys_user
ADD COLUMN default_homepage VARCHAR(32) DEFAULT NULL COMMENT '用户默认首页：/admin 工作台，/cashier 收银台';

-- 添加索引
ALTER TABLE t_sys_user
ADD KEY idx_sys_user_default_homepage (default_homepage);

-- --------------------------------------------------------------------------
-- 使用说明：
-- 1. 执行此迁移后，用户可以通过以下接口设置默认首页：
--    GET  /api/admin/auth/settings     - 获取当前设置
--    PUT  /api/admin/auth/settings     - 更新设置（body: { "defaultHomepage": "/admin" | "/cashier" | null }）
-- 2. 登录后 /me 接口返回的 defaultMode 会优先使用用户设置的默认首页
-- 3. 如果用户未设置，defaultMode 由 getUserAccessInfo() 根据角色自动判断
-- --------------------------------------------------------------------------
