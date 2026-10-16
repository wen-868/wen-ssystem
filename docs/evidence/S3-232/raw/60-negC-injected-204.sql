UPDATE t_sys_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'goods:create')
WHERE role_code = 'STORE_MANAGER'
  AND permissions IS NOT NULL
  AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:create')) = 0;

UPDATE t_sys_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'goods:edit')
WHERE role_code = 'STORE_MANAGER'
  AND permissions IS NOT NULL
  AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:edit')) = 0;

INSERT INTO t_sys_menu (parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status, tenant_id)
SELECT p.id, c.code, c.name, 'BUTTON', NULL, NULL, NULL, c.sort_no, 1, 1, p.tenant_id
FROM t_sys_menu p
JOIN (
  SELECT 'system:alert:handle' AS code, '处理预警' AS name, 1 AS sort_no
  UNION ALL SELECT 'system:alert:rule-edit', '维护预警规则', 2
  UNION ALL SELECT 'system:alert:check', '手动预警检查', 3
  UNION ALL SELECT 'system:archive:execute', '执行数据归档', 4
  UNION ALL SELECT 'system:notification:read', '通知标记已读', 5
  UNION ALL SELECT 'system:notification:read-all', '通知全部已读', 6
  UNION ALL SELECT 'system:notification:send', '发送通知', 7
  UNION ALL SELECT 'system:notification:delete', '删除通知', 8
  UNION ALL SELECT 'system:notification:batch-delete', '批量删除通知', 9
  UNION ALL SELECT 'system:sms-template:create', '新增短信模板', 11
  UNION ALL SELECT 'system:sms-template:edit', '编辑短信模板', 12
  UNION ALL SELECT 'system:sms-template:delete', '删除短信模板', 13
  UNION ALL SELECT 'system:migration:run', '执行数据库迁移', 14
) c
WHERE p.menu_code = 'system'
  AND p.menu_type = 'CATALOG'
  AND p.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM t_sys_menu d WHERE d.tenant_id = p.tenant_id AND d.menu_code = c.code
  );

SELECT CONCAT('204 立码核对：14 码全租户命中 ', (SELECT COUNT(*) FROM t_sys_menu WHERE menu_code IN (
    'system:alert:handle', 'system:alert:rule-edit', 'system:alert:check', 'system:archive:execute',
    'system:notification:read', 'system:notification:read-all', 'system:notification:send',
    'system:notification:delete', 'system:notification:batch-delete', 'system:push:test',
    'system:sms-template:create', 'system:sms-template:edit', 'system:sms-template:delete',
    'system:migration:run')),
  ' 行；default 租户命中 ', (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id = 'default' AND menu_code IN (
    'system:alert:handle', 'system:alert:rule-edit', 'system:alert:check', 'system:archive:execute',
    'system:notification:read', 'system:notification:read-all', 'system:notification:send',
    'system:notification:delete', 'system:notification:batch-delete', 'system:push:test',
    'system:sms-template:create', 'system:sms-template:edit', 'system:sms-template:delete',
    'system:migration:run')),
  ' 行；同时持 goods:create 与 goods:edit 的 STORE_MANAGER 行数 ',
  (SELECT COUNT(*) FROM t_sys_role WHERE role_code = 'STORE_MANAGER' AND JSON_VALID(permissions) = 1
     AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:create')) = 1
     AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:edit')) = 1),
  ' 行；STORE_MANAGER 总行数 ', (SELECT COUNT(*) FROM t_sys_role WHERE role_code = 'STORE_MANAGER'),
  ' 行') AS result;

-- ============================================
-- 迁移编号：204
-- 单号：S3-232（立码第一批 · D6：解锁 A 类商品 15 条 + 系统设置/基础域 22 条）
-- 描述：① D1 —— 给 STORE_MANAGER 增补 goods:create + goods:edit（**不含 goods:delete**）
--       ② 系统设置/基础域 14 个新权限码登记进 t_sys_menu（BUTTON 行，父行 = 各租户的 system 一级目录）
-- 创建人：阿坚（后端 / 权限）｜执行卡：docs/tasks/inbox/ACTIVE-S3-232.md
-- 日期：2026-10-16
--
-- 一、本迁移只做两件事（**不改任何业务路由的鉴权语义**，接线留给后续批次）
--   ① 角色授权（D1）：goods:create / goods:edit **两个码本身在 079 里已存在**
--      （docs/migrations/079_权限矩阵.sql 的 BUTTON 行 200/201，模块 goods 的一级目录 10），
--      缺的只是"店长这一行角色没有这两个码"。依据：授权模型提案 §二·D1 —— 商品页对店长可见
--      （全量菜单矩阵 docs/evidence/_shared/prod-menu-grants-all-20261016.txt），店长**已持** goods:price
--      （同族先例）⇒ 符合不变量 I1'①。删除属高风险 ⇒ goods:delete **不给**（提案 §二·D1 明文）。
--   ② 立码（D6）：14 个新码登记进 t_sys_menu（本仓"权限码靠 t_sys_menu 行登记才可授权/可发现"，
--      同 S3-209 的 sale:cancel 口径）。本批新码 = docs/tasks/R101-待立码清单-五域.md §一 的 14 条，
--      与 backend/src/shared/system-permission-codes.ts 的 SYSTEM_PERMISSION_CATALOG **逐字同源**
--      （同值断言见 backend/src/__tests__/shared/system-permission-codes.test.ts）。
--
-- 二、幂等（可重复执行，第二遍**零行变更**）
--   ① 两条 UPDATE 各自带"未持有才追加"守卫（JSON_CONTAINS(...) = 0）⇒ 第二遍 Rows matched: 0；
--   ② 菜单行按 (menu_code, tenant_id) 判定（与唯一键 uk_sys_menu_code_tenant 同口径，NOT EXISTS 守卫）；
--   ③ 父行按 menu_code = 'system' 逐租户定位 ⇒ default 与各租户克隆行各自补自己的按钮行；
--      父行缺失的租户（尚未克隆菜单的空库/灾备库）本语句整条跳过，不插孤儿行、不报错。
--   ④ 为什么用 NOT EXISTS 而不是 INSERT IGNORE：INSERT IGNORE 会把**其它**错误（列不匹配、超长）一起吞掉，
--      留下"看起来成功其实没插"的假绿（技术债铁律：绕过 ≠ 修复）。
--
-- 三、授权面（本批 14 个新码**不给任何角色发码**，理由必须写清）
--   生产只读底稿 docs/evidence/_shared/prod-menu-grants-all-20261016.txt：system:* 全部菜单只授予
--   OPERATION_ADMIN（0 账号）/ READONLY（只读观察员，1 账号冒烟）/ STORE_ADMIN（0 账号，旧词表）
--   ⇒ **没有任何在用写角色**看得见这些页面，属提案 §〇·I1' 的"页面不对在用写角色开放"一类，
--   接线无 403 回归风险，也无须补角色授权。红线②（不给未用角色增删任何码）在本迁移中成立：
--   本迁移对 OPERATION_ADMIN / READONLY / STORE_ADMIN **一行不动**（可用底稿第三节的菜单分布复核）。
--
-- 四、⚠️ 必须用 run-migration.mjs 执行（否则本文件的数据写语句会被静默跳过）
--   本文件是**数据写语句**（UPDATE + INSERT），后端启动期外部迁移段（backend/src/shared/migration.ts
--   第 8 步）有 MIG-4 写闸门，默认 MIGRATION_WRITE_GATE=block ⇒ UPDATE/INSERT 会被跳过并各打一行日志，
--   只剩末尾 SELECT。正确执行方式（二选一，由凌舟在生产执行）：
--     node scripts/run-migration.mjs docs/migrations/204_系统设置域权限点立码.sql
--       或   MIGRATION_WRITE_GATE=allow 重启后端
--   执行后核对末尾 SELECT 的三个读数：14 码全租户命中 = 租户数 × 14、default 租户命中 14、
--   同时持 goods:create 与 goods:edit 的 STORE_MANAGER 行数 = STORE_MANAGER 总行数。
--   ⚠️ 权限串被签进 JWT（auth.ts expiresIn 4h）⇒ 店长相关账号**需重新登录**才带上新码，
--   不得用"改完立刻生效"当验收判据（同 docs/ops/S3-122-role-permission-align.sql 的既有口径）。
--
-- 五、回滚（逐条给出，回滚前先落"改前值"素材：SELECT id, role_code, permissions FROM t_sys_role
--   WHERE role_code = 'STORE_MANAGER'）
--   ① 摘掉 D1 追加的两个码（按值定位下标，只摘该值、不动其它码）
--      UPDATE t_sys_role SET permissions = JSON_REMOVE(permissions, JSON_UNQUOTE(JSON_SEARCH(permissions, 'one', 'goods:create')))
--        WHERE role_code = 'STORE_MANAGER' AND JSON_VALID(permissions) = 1 AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:create')) = 1
--      UPDATE t_sys_role SET permissions = JSON_REMOVE(permissions, JSON_UNQUOTE(JSON_SEARCH(permissions, 'one', 'goods:edit')))
--        WHERE role_code = 'STORE_MANAGER' AND JSON_VALID(permissions) = 1 AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:edit')) = 1
--      ⚠️ 若该角色**本来就有**其中一个码（本迁移不改动已有值），回滚会把原本存在的码也摘掉
--      ⇒ 回滚前必须先用上方的"改前值"素材比对，只回滚本迁移真正追加过的码。
--   ② 删掉本批 14 个码的菜单行（只删本批的码，不删 system 域既有菜单）
--      DELETE FROM t_sys_menu WHERE menu_code IN ('system:alert:handle', 'system:alert:rule-edit',
--        'system:alert:check', 'system:archive:execute', 'system:notification:read',
--        'system:notification:read-all', 'system:notification:send', 'system:notification:delete',
--        'system:notification:batch-delete', 'system:push:test', 'system:sms-template:create',
--        'system:sms-template:edit', 'system:sms-template:delete', 'system:migration:run')
--
-- 六、卡外差异（**只登记不动手**，逐条写进 docs/tasks/inbox/ACTIVE-回执-S3-232.md §六）
--   ① 派单卡 §二.1 说"目录在 backend/src/shared/user-permissions.ts 的 PERMISSION_CATALOG"——
--      该文件里**没有** PERMISSION_CATALOG（它只做 t_sys_role.permissions 的解析）。商家侧目录在本仓是
--      per-域常量：本批落在**新文件** backend/src/shared/system-permission-codes.ts（先例 goods-permission-codes.ts
--      / sale-permission-codes.ts / library-permission-codes.ts）。**未**改 user-permissions.ts。
--   ② 派单卡 §二.2 说"把新码写进角色权限矩阵（t_sys_role_permission）"——该表**全仓无人读**：
--      授权判定只读 t_sys_role.permissions（shared/user-permissions.ts 的 getUserPermissions），
--      t_sys_role_permission 在 backend/src 下只出现在一处注释与 migration.ts 的表清单里
--      （S3-198 已实测"对 trace 码 0 命中"）⇒ 往里插行等于制造"看起来配了实际没配"的假能力，
--      故**不写**该表，改走**真机制** t_sys_role.permissions（D1 的两条 UPDATE）。
--   ③ 派单卡 §二 警告"不要回改历史语料（如 079）"——授权模型提案 §三.2 另要求"同步 079 的模块/按钮码清单"。
--      两处口径冲突 ⇒ 按**卡面（更新、更具体）**执行：**不动 079**，新码全部走本迁移；
--      差异已登记回执 §六，是否补同步 079 由凌舟裁定。
--   ④ 本迁移的 D1 授权**不带 tenant_id 过滤**（对全部租户的 STORE_MANAGER 行生效）。理由：STORE_MANAGER
--      在各租户是同一角色定义的克隆行（198_租户角色菜单补全.sql），只改 default 会让 demo 等克隆租户的
--      店长与 default 店长权限不一致。若凌舟要收敛为只改 default，改 WHERE 加 tenant_id = 'default' 即可
--      （回滚同理，两条 UPDATE 与回滚各加同一条件）。此项**待确认**，已登记回执"待凌舟裁定项"。
-- ============================================
