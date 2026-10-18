-- ============================================
-- 迁移编号：208
-- 单号：S3-238（平台侧权限接线 · 第一批）
-- 描述：平台侧权限点**立码**（`tenant:manage`）——幂等、非破坏；**不授权、不插角色行**
-- 创建人：阿坚（后端 / 总台端）｜日期：2026-10-17
-- 依据：docs/tasks/inbox/ACTIVE-S3-238.md §二 R2（目录与常量两处同改 + 幂等迁移）
--       docs/tasks/R101-平台RBAC接线台账.md §五.4（两处必须同时改，S3-219 教训）、§六（`tenant:manage` 风险登记）
--       docs/evidence/S3-238/10-design.md（R1 设计：问题 1 码的存放形态、问题 5 错位实测）
-- ============================================
--
-- 一、为什么要有本文件（先写清楚，否则后人会当"多余动作"删掉）
--   ① `tenant:manage` 长期以来是**半个码**：
--        · 在 `middleware/platform-rbac.ts` 的 `PLATFORM_WRITE_CODES`（:77）**已存在** ⇒ 端点**能引用**；
--        · 在 `services/platform/platform-role.service.ts` 的 `PERMISSION_CATALOG` **没有** ⇒ 按
--          `updateRolePermissions()` 的口径（目录外 `module_code` 直接 400）该码**无法被授予任何平台角色**。
--      ⇒ 接线后非超管永久 403；而生产目前唯一平台管理员是 `PLATFORM_SUPER_ADMIN`（走超管通配）
--        ⇒ **表面上不红，实际是静默失效**（S3-231 F2 已把这条登记为待处置）。
--   ② S3-238 同时改两处：代码常量（真相源，**已随本单改**）+ 本文件（目录表的**出生证**）。
--
-- 二、★ 重要限制：**MIG-4 写闸门默认 block ⇒ 本文件的 INSERT 在生产不落库**（未根治，登记技术债）
--   · 机制：`shared/migration.ts` 的 `resolveWriteGate()` 只认环境变量 `MIGRATION_WRITE_GATE`，
--     未设置 / 非法值一律 **block** ⇒ `INSERT/UPDATE/DELETE/REPLACE/CALL` 被跳过；
--     而 `runMigrations()` 由 server.ts 每次启动调用、全仓**无执行账本** ⇒ 放行 allow 又会随每次重启**复利叠加**。
--   · 因此：平台侧目录的**唯一真相源仍是代码常量 `PERMISSION_CATALOG`**（与 S3-232 商家侧口径同源：
--     「目录走代码常量、迁移只做 DDL」）。本文件的 INSERT 用于**空库演练 / 目录表留档**，
--     **不**依赖它落库来保证功能；即便本文件在生产的 INSERT 被 block，平台侧接线依旧可用（读常量）。
--   · ⚠️ 按技术债铁律（绕过 ≠ 修复）如实标注：这是**既有机制限制**，不是本单引入，也未在本单根治；
--     根治方向 = 建立迁移执行账本后再放开写闸门（另立单，不在 S3-238 范围）。
--
-- 三、红线遵守（逐条）
--   ① **不覆盖**已有非空权限串（本文件不触碰 `t_platform_role.permissions` 等既有值）；
--   ② **不凭空插 `t_platform_role` / `t_platform_role_permission` 行**——生产实测这两张表 **0 行**
--      （`docs/evidence/_shared/prod-roles-20261016.txt:42-43`）⇒ 插行 = 凭空造平台角色，**本单禁止**；
--   ③ **不发给任何角色码**（授权留给后续单，需凌舟裁定：生产 0 平台角色，授权前提是先建角色行）；
--   ④ 幂等：`uk_perm_code`（迁移 179）保证同码重复 INSERT 被忽略 ⇒ 连跑两遍 affectedRows=0。
--
-- 四、可重复执行：是（`INSERT IGNORE` + 唯一键）
--

-- 平台侧权限点：租户管理（写）——与代码常量 PERMISSION_CATALOG 同名同义
INSERT IGNORE INTO t_platform_permission_catalog
  (module_code, module_name, perm_code, perm_name, perm_level)
VALUES
  ('tenant', '租户管理', 'tenant:manage', '租户管理（写）', 'BUTTON');

-- 五、只读核对（便于 run-migration.mjs 的 result 字段留痕，且不依赖上一步是否落库）
SELECT CONCAT('208 核对：catalog 行数=', (SELECT COUNT(*) FROM t_platform_permission_catalog),
              ' ／ tenant:manage 是否存在=',
              (SELECT COUNT(*) FROM t_platform_permission_catalog WHERE perm_code = 'tenant:manage'),
              ' ／ 平台角色行数=', (SELECT COUNT(*) FROM t_platform_role),
              '（期望 平台角色=0：本单不插角色行）') AS result;
