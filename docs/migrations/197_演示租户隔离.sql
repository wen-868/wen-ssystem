INSERT INTO t_tenant (id, name, company_name, contact_person, contact_mobile, tenant_code, plan, status)
SELECT 'demo', '演示租户', '演示租户', '演示联系人', '13800000000', 'DEMO', 'basic', 1
FROM (SELECT 1 AS whether_to_seed) AS seed_probe
WHERE NOT EXISTS (SELECT 1 FROM t_tenant WHERE id = 'demo');

-- S3-174-F2 第 2 条：把 default 的角色行按 (role_code, tenant_id) 克隆到 demo（幂等判据与表上唯一键
-- uk_role_code_tenant 同口径，不用 INSERT IGNORE——少写列必须在严格模式下报错停下）
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT s.role_code, s.role_name, s.description, s.data_scope, s.permissions, s.status, 'demo'
FROM t_sys_role s
WHERE s.tenant_id = 'default'
  AND NOT EXISTS (SELECT 1 FROM t_sys_role d WHERE d.tenant_id = 'demo' AND d.role_code = s.role_code);

UPDATE t_sys_user
SET tenant_id = 'demo', updated_at = NOW()
WHERE username = 'demo' AND (tenant_id IS NULL OR tenant_id <> 'demo');

-- S3-174-F2 第 4 条：演示账号的绑定行**原地**改租户并**按 role_code 重指向 demo 自己的角色行**
-- （role_id + tenant_id 一条 UPDATE 改完，不做"先插后删"——uk_sys_user_role (user_id, role_id) 不含
-- tenant_id，插入会被唯一键跳过而删除照做，绑定就归零，见判红 ②）
UPDATE t_sys_user_role ur
JOIN t_sys_user u ON u.id = ur.user_id AND u.username = 'demo'
JOIN t_sys_role s ON s.id = ur.role_id
JOIN t_sys_role d ON d.tenant_id = 'demo' AND d.role_code = s.role_code
SET ur.role_id = d.id, ur.tenant_id = 'demo'
WHERE s.tenant_id <> 'demo';

INSERT INTO t_sys_user_role (user_id, role_id, tenant_id)
SELECT u.id, r.id, 'demo'
FROM t_sys_user u
JOIN t_sys_role r ON r.role_code = 'SUPER_ADMIN' AND r.tenant_id = 'demo'
LEFT JOIN t_sys_user_role ur ON ur.user_id = u.id
WHERE u.username = 'demo' AND ur.id IS NULL;

INSERT INTO t_sys_menu (parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status, tenant_id)
SELECT NULL, m.menu_code, m.menu_name, m.menu_type, m.path, m.component, m.icon, m.sort_no, m.visible, m.status, 'demo'
FROM t_sys_menu m
WHERE m.tenant_id = 'default' AND m.parent_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM t_sys_menu d WHERE d.tenant_id = 'demo' AND d.menu_code = m.menu_code);

INSERT INTO t_sys_menu (parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status, tenant_id)
SELECT p.id, m.menu_code, m.menu_name, m.menu_type, m.path, m.component, m.icon, m.sort_no, m.visible, m.status, 'demo'
FROM t_sys_menu m
LEFT JOIN t_sys_menu sp ON sp.id = m.parent_id AND sp.tenant_id = 'default'
LEFT JOIN t_sys_menu p ON p.tenant_id = 'demo' AND p.menu_code = sp.menu_code
WHERE m.tenant_id = 'default' AND m.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM t_sys_menu d WHERE d.tenant_id = 'demo' AND d.menu_code = m.menu_code);

SELECT
  (SELECT COUNT(*) FROM t_tenant WHERE id = 'demo') AS demo_tenant_rows,
  (SELECT COUNT(*) FROM t_sys_user WHERE username = 'demo' AND tenant_id = 'demo') AS demo_user_in_demo,
  (SELECT COUNT(*) FROM t_sys_user WHERE username = 'demo' AND (tenant_id IS NULL OR tenant_id <> 'demo')) AS demo_user_outside_demo,
  (SELECT COUNT(*) FROM t_sys_user_role ur JOIN t_sys_user u ON u.id = ur.user_id
     WHERE u.username = 'demo' AND ur.tenant_id = 'demo') AS demo_bindings_in_demo,
  (SELECT COUNT(*) FROM t_sys_user_role ur JOIN t_sys_user u ON u.id = ur.user_id
     WHERE u.username = 'demo' AND ur.tenant_id <> 'demo') AS demo_bindings_outside_demo,
  (SELECT COUNT(*) FROM t_sys_role WHERE tenant_id = 'demo') AS demo_role_rows,
  (SELECT COUNT(*) FROM t_sys_role WHERE tenant_id = 'default') AS default_role_rows,
  (SELECT COUNT(*) FROM t_sys_user_role ur JOIN t_sys_user u ON u.id = ur.user_id
     JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
     WHERE u.username = 'demo') AS demo_bindings_on_own_role,
  (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id = 'demo') AS demo_menu_rows,
  (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id = 'default') AS default_menu_rows;

SELECT CONCAT(
  '迁移 197 完成：demo 租户 ', (SELECT COUNT(*) FROM t_tenant WHERE id = 'demo'), ' 行',
  '，演示账号在 demo 租户 ', (SELECT COUNT(*) FROM t_sys_user WHERE username = 'demo' AND tenant_id = 'demo'), ' 行',
  '，demo 租户内角色绑定 ', (SELECT COUNT(*) FROM t_sys_user_role ur JOIN t_sys_user u ON u.id = ur.user_id
     WHERE u.username = 'demo' AND ur.tenant_id = 'demo'), ' 条',
  '，非 demo 租户残留绑定 ', (SELECT COUNT(*) FROM t_sys_user_role ur JOIN t_sys_user u ON u.id = ur.user_id
     WHERE u.username = 'demo' AND ur.tenant_id <> 'demo'), ' 条',
  '，demo 租户角色行 ', (SELECT COUNT(*) FROM t_sys_role WHERE tenant_id = 'demo'), ' 行',
  '，绑定命中本租户角色 ', (SELECT COUNT(*) FROM t_sys_user_role ur JOIN t_sys_user u ON u.id = ur.user_id
     JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
     WHERE u.username = 'demo'), ' 条',
  '，demo 租户菜单 ', (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id = 'demo'), ' 行'
) AS result;

-- ============================================
-- 迁移编号：197
-- 单号：S3-174-F1（P0 安全：演示账号迁出真实租户 —— 三处生产同构硬伤重做版）
--       S3-174-F2（2026-10-10 判红 v2 整改：补"角色行克隆" + 绑定按 role_code 重指向 + 登录路径角色查询限定租户）
-- 创建人：阿坚（后端）
-- 日期：2026-10-08（F1）／2026-10-10（F2 整改）
-- 上一版（判红）：docs/tasks/cards/R101-S3-174-凌舟验收-判红.md
-- 本轮判红：docs/tasks/cards/R101-S3-174-F1-凌舟验收-判红-v2.md（§三 第 4 处硬伤 + §四 修复要求）
-- 依据：docs/tasks/cards/R101-派单-20261007-S3-174.md 一①/二/三
--       docs/tasks/cards/R101-S3-174-凌舟验收-判红.md 三（①~⑤ 逐条）
--       docs/tasks/cards/R101-S3-174-F1-凌舟验收-判红-v2.md 四（1~6）
--
-- 一、问题（P0 真缺陷，不是预防性改动）
--   演示口令 Demo@2026 是公开值（写在前端打包产物与仓内 .env.example）。上一版迁移把演示账号
--   （t_sys_user.username = 'demo'）从 'default' 迁到 'demo'，方向正确，但三处结构性前提在**生产
--   同构 schema** 上不成立，按现状执行会静默坏事：
--     1) t_tenant 的 company_name / contact_person / contact_mobile / tenant_code(UNIQUE) 四列
--        在 016/029 的建表定义里是 NOT NULL 且**无默认值**（两处 SQL 原文：016 第 12~16 行、
--        029 第 4~8 行）。上一版写的是 `INSERT IGNORE INTO t_tenant (id, name, plan, status)`，
--        严格模式下 1364（该列无默认值）在 IGNORE 下**退化成 warning 并跳过该行** ⇒ 演示租户
--        根本建不出来，账号却被指到它。
--     2) t_sys_user_role 唯一键是 **uk_sys_user_role (user_id, role_id)**（不含 tenant_id，见
--        docs/init_database.sql 第 316 行）。上一版是"先 INSERT IGNORE 复制绑定到 demo、再 DELETE
--        旧绑定"：插入撞上同一 (user_id, role_id) 唯一键被跳过，删除却照做 ⇒ 绑定归零。
--     3) t_sys_menu 按租户存菜单（唯一键 uk_sys_menu_code_tenant (menu_code, tenant_id)）。
--        生产 'demo' 租户 0 行、'default' 89 行 ⇒ 只搬账号不搬菜单，演示侧没有菜单可用。
--     4) t_sys_role 的角色行同样是"租户内实体"（唯一键 uk_role_code_tenant (role_code, tenant_id)，
--        rbac.service.ts 的 createRole 按 (role_code, tenant_id) 查重）。F1 版把账号与绑定搬进 demo，
--        却没给 demo 建角色行 ⇒ 绑定行 role_id 仍指向 default 的角色，两条按租户匹配的读路径
--        （auth.service.ts 的 getUserPermissions 用 r.tenant_id = ur.tenant_id、menu-permission.service.ts
--        的 getUserMenus 用 r.tenant_id = ?）全部命中 0 行 ⇒ permissions = []、菜单 = []，
--        手机端「功能中心 / 更多功能」整屏空白且不给任何提示（判红 v2 §三 第 4 处硬伤）。
--        同源复发点：demoLogin() 的超管查询原为 `WHERE role_code = 'SUPER_ADMIN'`（**不限租户**），
--        登录一次就会把 default 租户的角色 id 绑进 demo —— F2 第 ③ 项已把该查询限定到 demo 租户。
--
-- 二、本版七条可执行写语句各自解决什么（顺序不可调换）
--   1) 建演示租户：**显式写齐全部 NOT NULL 无默认值列**（company_name / contact_person /
--      contact_mobile / tenant_code='DEMO'），并用 `WHERE NOT EXISTS` 做存在性判定 ——
--      **全程不用 INSERT IGNORE**，就是要让"少写 NOT NULL 列"这件事在严格模式下**报错停下**，
--      而不是被静默跳过（这正是上一版判红的原因）。
--      不写 FROM DUAL：迁移执行器 addTablePrefix 会把 `FROM DUAL` 改写成 `FROM t_DUAL`
--      （migration.ts 第 90~135 行的通用 FROM 规则），故用派生表 `(SELECT 1 …) AS seed_probe`
--      提供一行来源（括号开头不匹配表名正则，不会被改写）。
--   2) 克隆角色行（S3-174-F2 新增）：从 t_sys_role WHERE tenant_id = 'default' 克隆到 'demo'，
--      **必须带上 permissions**（B 断言要的就是它）以及 role_name / description / data_scope / status。
--      幂等判据用 (role_code, tenant_id)（与 uk_role_code_tenant 同口径），不用 INSERT IGNORE。
--      注：153 补列 `name`（与 role_name 同义）全仓无读取点，未纳入克隆清单，如需一并克隆再单独裁定。
--   3) 演示账号归属改 demo（隔离承重句）：口令登录 backend/src/services/admin/auth.service.ts 的
--      issueLoginResult 取 account.tenant_id 作为 JWT 的 tenantId，业务读接口再按该租户过滤。
--      条件含 (tenant_id IS NULL OR tenant_id <> 'demo')，已迁就跳过 ⇒ 幂等且不写无谓行。
--   4) 角色绑定改 **UPDATE 原地改租户 + 按 role_code 重指向 demo 自己的角色行**（判红 ② 的硬要求，
--      F2 补上"重指向"这一半）：因唯一键 uk_sys_user_role (user_id, role_id) 不含 tenant_id，
--      把该账号现有绑定行**原地改**是唯一不撞键的路径，**不再出现"先插后删"**，也就没有
--      "插入被唯一键跳过、删除照做 ⇒ 绑定归零"的窗口。只改"角色行还在别租户"的绑定
--      （WHERE s.tenant_id <> 'demo'），故第二遍天然 0 行。用 JOIN 而非 IN (SELECT …)，
--      防止将来同名账号出现多行时报子查询多行错误。
--   5) 兜底补一条 SUPER_ADMIN 绑定：仅当该账号**一条绑定都没有**时补（LEFT JOIN … ur.id IS NULL）。
--      生产既有绑定由第 4 条搬过来，本句影响 0 行；全新/灾备库才是真正生效的场景。
--      角色查询**必须限定 demo 租户**：第 2 条克隆后 SUPER_ADMIN 在 default 与 demo 各有一行，
--      不限定就会补出指向 default 角色 id 的跨租户绑定（与登录路径第 ③ 项同一个坑）。
--      不用 INSERT IGNORE —— 用连接条件表达"缺失才补"。
--   6) 菜单一起迁（两段）：先克隆 default 的顶级菜单（parent_id IS NULL），再克隆子菜单，
--      并把子菜单的 parent_id **重指向 demo 自己的父行**（按 menu_code 对齐）—— 若照抄
--      default 的 parent_id，demo 的子菜单会指向别的租户的行，菜单树会散架。
--      父行对齐用 LEFT JOIN：default 侧若存在"父行缺失"的历史脏行（079 的分组 INSERT 在生产
--      曾被部分丢弃，可能出现孤儿子行），该子行降级为顶级菜单照常克隆（parent_id = NULL），
--      保证"default 有几行、demo 就有几行"，而不是整行漏掉。
--      幂等判定一律用 (menu_code, tenant_id)（与表上唯一键 uk_sys_menu_code_tenant 同口径）。
--      只迁菜单，不迁 t_sys_role_menu 绑定：第 2 条已把角色行克隆到 demo，演示账号的 SUPER_ADMIN
--      落在 demo ⇒ menu-permission.service.ts 的 getUserMenus 才会走到"超管返回本租户全量菜单"分支
--      （F1 时角色行还在 default，该分支根本到不了，见判红 v2 §三）。
--
-- 三、零业务数据搬迁（判红 ⑤，本单红线）
--   全文只写 t_tenant / t_sys_user / t_sys_user_role / t_sys_menu 四张系统表，
--   **不出现任何业务表**（t_sale_bill / t_member / t_product_* / t_purchase_order / t_store …），
--   也没有任何 DELETE。生产 'default' 租户 524 行销售单一行不动（判据由验证装置
--   docs/evidence/S3-174/tools/s3-174-verify.mjs 的前后计数给出）。
--
-- 四、幂等（连跑两遍：第二遍零错误码、零行变更）
--   第 1 条命中 NOT EXISTS ⇒ 0 行；第 2 条命中 NOT EXISTS ⇒ 0 行；第 3 条条件不成立 ⇒ 0 行；
--   第 4 条因第二遍时绑定已指向 demo 的角色行（WHERE s.tenant_id <> 'demo' 不成立）⇒ 0 行；
--   第 5 条 LEFT JOIN 命中已有绑定 ⇒ 0 行；第 6 条 NOT EXISTS ⇒ 0 行。全部按"当前状态收敛"，
--   不依赖任何迁移账本（本仓无账本表，后端每次启动都会重跑全部 docs/migrations/*.sql）。
--   可执行语句顶格写在注释块**之前**，且注释文字内不出现 ASCII 分号 —— 规避踩坑日志[63]
--   "以注释开头的整块语句被 runner 丢弃"。
--
-- 五、⚠️ 必须用 run-migration.mjs 执行（否则本迁移会静默失效）
--   本文件第 1~7 条是数据写语句（INSERT / UPDATE）。后端启动期的外部迁移段
--   （backend/src/shared/migration.ts 第 8 步）有 MIG-4 写闸门，默认 MIGRATION_WRITE_GATE=block
--   ⇒ 这些写语句会被**跳过并各打一行日志**，只有末尾两条 SELECT 照跑。也就是说：
--     只靠"重启后端自动迁移"，本单修复**不会生效**（demo 账号仍留在 default）。
--   正确执行方式（二选一，由凌舟在生产执行）：
--     node scripts/run-migration.mjs docs/migrations/197_演示租户隔离.sql
--       或   MIGRATION_WRITE_GATE=allow 重启后端
--   执行后核对输出：demo_tenant_rows=1、demo_user_in_demo=1、demo_user_outside_demo=0、
--   demo_bindings_in_demo>=1、demo_bindings_outside_demo=0、demo_role_rows>0、
--   demo_bindings_on_own_role>=1（权限/菜单两条读路径真正命中的行数）、demo_menu_rows>0。
--
-- 六、回滚（把演示账号放回真实租户 'default'；行尾请自行补 SQL 语句终止符）
--   回滚只动账号归属与角色引用，**不会**把 demo 租户下的演示业务数据迁回 default（那些数据本就不该迁）。
--   按顺序逐条执行下面 4 条：
--     1) UPDATE t_sys_user_role ur JOIN t_sys_role s ON s.id = ur.role_id
--          JOIN t_sys_role d ON d.tenant_id = 'default' AND d.role_code = s.role_code
--          JOIN t_sys_user u ON u.id = ur.user_id AND u.username = 'demo'
--          SET ur.role_id = d.id, ur.tenant_id = 'default'
--        （F2 之后绑定指向 demo 的角色行，回滚**必须**把 role_id 按 role_code 指回 default 的角色行，
--          只改 tenant_id 会把账号留在"绑定指向别租户角色"的坏状态，权限与菜单照样解析为空）
--     2) UPDATE t_sys_user SET tenant_id = 'default', updated_at = NOW()
--          WHERE username = 'demo' AND tenant_id = 'demo'
--     3) DELETE FROM t_sys_menu WHERE tenant_id = 'demo'
--     4) DELETE FROM t_sys_role WHERE tenant_id = 'demo'
--   演示租户行（t_tenant.id = 'demo'）默认**保留**（便于重新前滚）。确需删除时：
--     DELETE FROM t_tenant WHERE id = 'demo'
--   ⚠️ 回滚后 demo 账号会重新拿到 default 租户的 SUPER_ADMIN —— 这正是本单要消除的状态，
--      只允许在验证"反测该红就红"时短暂存在，验完必须重新前滚本迁移。
--
-- 七、反测（必须在生产同构库上跑，装置见 docs/evidence/S3-174-F1-凌舟复核 与 docs/evidence/S3-174-F2）
--   正向：跑完断言 demo 租户存在 ∧ 演示账号 tenant_id = 'demo' ∧ 角色绑定 >= 1 且全在 demo
--         ∧ demo 角色行数 = default 角色行数 ∧ 绑定命中本租户角色（B/C 两条读路径的形状）
--         ∧ demo 菜单数 > 0 ∧ 口令登录返回 roles 非空。
--   反向①（F2 新增）：把第 2 条"克隆角色行"整段去掉再跑 ⇒ 断言 B（getUserPermissions 形状）
--         与 C（getUserMenus 形状）必须**变红**（证明这两条断言有分辨力，不是恒绿凑数）。
--   反向②（F2 新增）：把登录路径超管查询的租户限定去掉（auth.service.ts 的 demoLogin）⇒
--         执行一次登录的绑定语句后，该账号会多出一条指向 default 角色行的跨租户绑定
--         （真实读数与后果见回传卡 §三，含"再跑迁移撞唯一键"的实测输出）。
--   反向③：把第 1 条的 NOT NULL 列**去掉任一**（如 company_name）再跑 ⇒ 必须**报错停下**
--         （1364 Field 'company_name' doesn't have a default value），不得静默跳过。
--   幂等：连跑两遍零错误码、零行变更、无重复菜单/绑定/角色行。
-- ============================================
