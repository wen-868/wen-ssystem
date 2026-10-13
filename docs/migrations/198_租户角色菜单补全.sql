INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT s.role_code, s.role_name, s.description, s.data_scope, s.permissions, s.status, tt.id
FROM t_tenant tt
JOIN t_sys_role s ON s.tenant_id = 'default'
WHERE tt.id <> 'default'
  AND NOT EXISTS (
    SELECT 1 FROM t_sys_role d WHERE d.tenant_id = tt.id AND d.role_code = s.role_code
  );

-- ② 顶级菜单克隆（parent_id IS NULL），幂等判据 (menu_code, tenant_id)
INSERT INTO t_sys_menu (parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status, tenant_id)
SELECT NULL, m.menu_code, m.menu_name, m.menu_type, m.path, m.component, m.icon, m.sort_no, m.visible, m.status, tt.id
FROM t_tenant tt
JOIN t_sys_menu m ON m.tenant_id = 'default' AND m.parent_id IS NULL
WHERE tt.id <> 'default'
  AND NOT EXISTS (
    SELECT 1 FROM t_sys_menu d WHERE d.tenant_id = tt.id AND d.menu_code = m.menu_code
  );

-- ③ 子级菜单克隆：parent_id 按 menu_code 重指向本租户自己的父行（父行缺失时降级为顶级，保证行数齐平）
INSERT INTO t_sys_menu (parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status, tenant_id)
SELECT p.id, m.menu_code, m.menu_name, m.menu_type, m.path, m.component, m.icon, m.sort_no, m.visible, m.status, tt.id
FROM t_tenant tt
JOIN t_sys_menu m ON m.tenant_id = 'default' AND m.parent_id IS NOT NULL
LEFT JOIN t_sys_menu sp ON sp.id = m.parent_id AND sp.tenant_id = 'default'
LEFT JOIN t_sys_menu p ON p.tenant_id = tt.id AND p.menu_code = sp.menu_code
WHERE tt.id <> 'default'
  AND NOT EXISTS (
    SELECT 1 FROM t_sys_menu d WHERE d.tenant_id = tt.id AND d.menu_code = m.menu_code
  );

-- ④ 跨租户绑定收口：绑定行指向别租户的角色行 ⇒ **原地**改指本租户同 role_code 的角色行
--    （uk_sys_user_role (user_id, role_id) 不含 tenant_id，先插后删会把绑定归零，见 197 判红 ②）
--    左侧 LEFT JOIN 是防撞键守卫：该用户已存在指向目标角色行的绑定行时跳过本行，
--    避免 ER_DUP_ENTRY 让整个迁移停下（这些行由末尾 SELECT 如实报数）
UPDATE t_sys_user_role ur
JOIN t_sys_role s ON s.id = ur.role_id
JOIN t_sys_user u ON u.id = ur.user_id AND u.tenant_id = ur.tenant_id
JOIN t_sys_role d ON d.tenant_id = ur.tenant_id AND d.role_code = s.role_code
LEFT JOIN t_sys_user_role x ON x.user_id = ur.user_id AND x.role_id = d.id
SET ur.role_id = d.id
WHERE s.tenant_id <> ur.tenant_id
  AND x.id IS NULL;

-- ⑤ 租户管理员"零绑定"兜底：仅对**该租户已登记的管理员**（t_tenant_admin 中登记过，或平台开通链路的
--    固定账号名 admin）且**一条绑定都没有**的账号补一条本租户 SUPER_ADMIN 绑定 —— 不是无差别发放，
--    已绑定的账号一律跳过（ur.id IS NULL 守卫）
INSERT INTO t_sys_user_role (user_id, role_id, tenant_id)
SELECT u.id, r.id, u.tenant_id
FROM t_sys_user u
JOIN t_sys_role r
  ON r.tenant_id = u.tenant_id
 AND r.role_code = 'SUPER_ADMIN'
 AND (r.status = 'ACTIVE' OR r.status = 1 OR r.status = '1')
LEFT JOIN t_sys_user_role ur ON ur.user_id = u.id
WHERE u.tenant_id <> 'default'
  AND (u.status = 1 OR u.status = 'ACTIVE' OR u.status = '1')
  AND ur.id IS NULL
  AND (
    EXISTS (SELECT 1 FROM t_tenant_admin ta WHERE ta.tenant_id = u.tenant_id AND ta.user_id = u.id)
    OR u.username = 'admin'
  );

-- ⑥ 迁移结果核对（机器可判：跑完应满足 tenants_without_roles = 0、tenants_without_menus = 0、
--    cross_tenant_bindings = 0）
SELECT
  (SELECT COUNT(*) FROM t_tenant WHERE id <> 'default') AS other_tenant_rows,
  (SELECT COUNT(*) FROM t_sys_role WHERE tenant_id = 'default') AS default_role_rows,
  (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id = 'default') AS default_menu_rows,
  (SELECT COUNT(*) FROM t_tenant tt WHERE tt.id <> 'default'
     AND (SELECT COUNT(*) FROM t_sys_role r WHERE r.tenant_id = tt.id) = 0) AS tenants_without_roles,
  (SELECT COUNT(*) FROM t_tenant tt WHERE tt.id <> 'default'
     AND (SELECT COUNT(*) FROM t_sys_menu m WHERE m.tenant_id = tt.id) = 0) AS tenants_without_menus,
  (SELECT COUNT(*) FROM t_sys_user_role ur JOIN t_sys_role s ON s.id = ur.role_id
     WHERE s.tenant_id <> ur.tenant_id) AS cross_tenant_bindings,
  (SELECT COUNT(*) FROM t_sys_user_role ur
     JOIN t_sys_role s ON s.id = ur.role_id
     JOIN t_sys_user u ON u.id = ur.user_id
     WHERE ur.tenant_id <> 'default'
       AND ur.tenant_id = u.tenant_id
       AND s.tenant_id = ur.tenant_id) AS bindings_on_own_role;

SELECT CONCAT(
  '迁移 198 完成：非 default 租户 ', (SELECT COUNT(*) FROM t_tenant WHERE id <> 'default'), ' 个',
  '，仍无角色行的租户 ', (SELECT COUNT(*) FROM t_tenant tt WHERE tt.id <> 'default'
     AND (SELECT COUNT(*) FROM t_sys_role r WHERE r.tenant_id = tt.id) = 0), ' 个',
  '，仍无菜单行的租户 ', (SELECT COUNT(*) FROM t_tenant tt WHERE tt.id <> 'default'
     AND (SELECT COUNT(*) FROM t_sys_menu m WHERE m.tenant_id = tt.id) = 0), ' 个',
  '，残留跨租户绑定 ', (SELECT COUNT(*) FROM t_sys_user_role ur JOIN t_sys_role s ON s.id = ur.role_id
     WHERE s.tenant_id <> ur.tenant_id), ' 条',
  '，命中本租户角色行的绑定 ', (SELECT COUNT(*) FROM t_sys_user_role ur
     JOIN t_sys_role s ON s.id = ur.role_id
     JOIN t_sys_user u ON u.id = ur.user_id
     WHERE ur.tenant_id <> 'default' AND ur.tenant_id = u.tenant_id AND s.tenant_id = ur.tenant_id), ' 条'
) AS result;

-- ============================================
-- 迁移编号：198
-- 单号：S3-183（依据 R101-收口总清单第 18 项，P0）
-- 创建人：阿坚（后端 · 本地子代理通道）
-- 日期：2026-10-13
--
-- 一、问题（真实受害租户 f0cbfe78-9f74-4966-9d1e-95aff8402d1c，业主生产只读实测）
--   · 平台开通租户的链路**从不克隆角色与菜单** ⇒ t_sys_role / t_sys_menu 在该租户下 0 行，
--     而其实时管理员绑定指向 'default' 的 SUPER_ADMIN 行（bind_tenant = 本租户、role_tenant = default，
--     不匹配）⇒ 登录后 auth.service.ts 的 getUserPermissions（JOIN … AND r.tenant_id = ur.tenant_id）
--     命中 0 行（permissions = []）、menu-permission.service.ts 的 getUserMenus（AND r.tenant_id = ?）
--     命中 0 行并 return [] ⇒ 能登录，但功能中心 / 侧栏整屏空白，且不给任何提示。
--   · 这是通病不是个案：**每个新租户一出生就是坏的**（demo 那套是 197 手工补的，不是开通链路给的）。
--   · 开通链路的**运行时**修复在 ① 号交付物（services/platform/tenant-rbac-provision.service.ts +
--     四个开通落点接线）里，本迁移只负责**存量**租户。
--
-- 二、本迁移五条写语句各自解决什么（顺序不可调换）
--   ① 角色行克隆：对每个非 default 租户补齐 default 有的角色行（含 role_code / role_name /
--      description / data_scope / permissions / status）。幂等判据 (role_code, tenant_id)，与唯一键
--      uk_role_code_tenant 同口径；**不用 INSERT IGNORE**（少写列必须在严格模式下报错停下）。
--   ② / ③ 菜单克隆（两段）：先顶级（parent_id IS NULL），再子级；子级 parent_id **重指向本租户自己的
--      父行**（按 menu_code 对齐），否则子菜单会指向别租户的行、菜单树散架。父行用 LEFT JOIN，
--      源侧存在"父行缺失"的历史脏行时该子行降级为顶级照常克隆 ⇒ 保证"default 有几行、本租户就有几行"。
--      幂等判据一律 (menu_code, tenant_id)（与 uk_sys_menu_code_tenant 同口径）。
--   ④ 绑定收口：指向**别租户**角色行的绑定行**原地**改指本租户同 role_code 的角色行
--      （uk_sys_user_role (user_id, role_id) 不含 tenant_id ⇒ 原地 UPDATE 是唯一不撞键的路径，
--      **不做"先插后删"**，否则插入被唯一键跳过、删除照做、绑定归零，见 197 判红 ②）。
--      左侧 LEFT JOIN 守卫：该用户已存在指向目标角色行的绑定行时跳过该行（避免 ER_DUP_ENTRY 整体停下），
--      跳过的残留在末尾 SELECT 的 cross_tenant_bindings 里如实报数。
--   ⑤ 管理员零绑定兜底：只对**该租户已登记的管理员**（t_tenant_admin 登记过，或平台开通链路的固定
--      账号名 admin）且**一条绑定都没有**的账号补一条本租户 SUPER_ADMIN 绑定。这不是无差别发放：
--      任何已有绑定的账号都会被 ur.id IS NULL 守卫排除。
--
-- 三、本迁移只碰三张系统表（t_sys_role / t_sys_menu / t_sys_user_role），**零业务表、零 DELETE**
--   （红线沿用 197 第 ⑤ 条：不动 t_sale_bill / t_member / t_product_* / t_purchase_order / t_store 等）
--
-- 四、幂等（连跑两遍：第二遍零错误码、零行变更）
--   ①②③④⑤ 全部以"当前状态收敛"为判据（NOT EXISTS / ur.id IS NULL / s.tenant_id <> ur.tenant_id），
--   不依赖任何迁移账本（本仓无账本表，后端每次启动都会重跑全部 docs/migrations/*.sql）。
--   可执行语句顶格写在注释块**之前**，且注释文字内不出现 ASCII 分号 —— 规避踩坑日志[63]
--   "以注释开头的整块语句被 runner 丢弃"。
--
-- 五、⚠️ 必须用 run-migration.mjs 执行（否则本迁移的写语句会静默失效）
--   本文件 ①~⑤ 是数据写语句（INSERT / UPDATE）。后端启动期的外部迁移段（backend/src/shared/migration.ts
--   第 8 步）有 MIG-4 写闸门，默认 MIGRATION_WRITE_GATE=block ⇒ 这些写语句会被**跳过并各打一行日志**，
--   只有末尾两条 SELECT 照跑。正确执行方式（二选一，由凌舟在生产执行）：
--     node scripts/run-migration.mjs docs/migrations/198_租户角色菜单补全.sql
--       或   MIGRATION_WRITE_GATE=allow 重启后端
--   执行后核对：tenants_without_roles = 0、tenants_without_menus = 0、cross_tenant_bindings = 0，
--   且受害租户（f0cbfe78-…）出现角色行与菜单行、其管理员绑定命中本租户角色行。
--
-- 六、回滚
--   本迁移是"补全 + 原地改指"，不新增业务数据，回滚按租户/账号逐条处理：
--     1) 角色/菜单克隆行（仅撤销本迁移新增的租户级副本）
--        DELETE r FROM t_sys_role r JOIN t_tenant tt ON tt.id = r.tenant_id
--          WHERE tt.id <> 'default'
--        DELETE m FROM t_sys_menu m JOIN t_tenant tt ON tt.id = m.tenant_id
--          WHERE tt.id <> 'default'
--     2) 绑定改指（把绑定重新指回 default 的同 role_code 角色行）
--        UPDATE t_sys_user_role ur
--          JOIN t_sys_role s ON s.id = ur.role_id
--          JOIN t_sys_role d ON d.tenant_id = 'default' AND d.role_code = s.role_code
--        SET ur.role_id = d.id
--        WHERE ur.tenant_id <> 'default'
--     3) ⑤ 补出来的绑定按 (user_id, role_id) 逐条删除后再执行上面的 2
--   ⚠️ 回滚后这些租户会**重新变成"权限与菜单解析为空"**，只有在验证"反测该红就红"时才允许短暂回滚，
--      验完必须重新前滚本迁移。
--
-- 七、影响面与已知边界（如实报备）
--   · 影响面 = **所有**非 default 租户（本迁移对所有缺角色或缺菜单的租户生效，已齐平的租户是 0 行变更）。
--     生产实况（凌舟只读实测）：t_sys_role / t_sys_menu 只有 default（12 / 89 行）与 demo（197 补的）有数据。
--   · ⑤ 的窄口径是本单的判断（P0 修复必须让"开通后即不可用"的账号可用），若凌舟要求收紧到
--     "只补 t_tenant_admin 登记过的账号"，去掉 `OR u.username = 'admin'` 一处即可（单行改动）。
--   · ④ 的守卫会把"该用户已有指向目标角色行的绑定"的跨租户残留保留下来，由末尾
--     cross_tenant_bindings 报数 —— 这是**有意的**：宁可如实报数，也不为了转绿而删绑定（零 DELETE）。
-- ============================================
