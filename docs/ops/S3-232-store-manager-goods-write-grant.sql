-- ============================================================================
-- 编号：S3-232（服务器侧角色授权，**非 DDL、非迁移文件**——与 204 迁移的授权语句**同源**）
-- 名称：D1 —— 给 STORE_MANAGER 增补商品写码 goods:create + goods:edit（**不含 goods:delete**）
-- 产出：阿坚（后端 / 权限）｜执行卡：docs/tasks/inbox/ACTIVE-S3-232.md｜日期：2026-10-16
-- 执行人：凌舟（**本单只产出不执行**，红线③）
-- 依据：docs/tasks/cards/R101-授权模型提案-凌舟-20261016.md §二·D1 +
--       docs/evidence/_shared/prod-menu-grants-all-20261016.txt（goods:* 菜单授予 STORE_MANAGER）
-- 目标表：t_sys_role（permissions 为 JSON 数组，授权判定读的就是这一列 —— shared/user-permissions.ts）
--         ⚠️ 权限串被签进 JWT（auth.ts，expiresIn 4h）⇒ **执行后相关账号必须重新登录才生效**，
--            不得用"改完立刻生效"当验收判据（同 docs/ops/S3-122-role-permission-align.sql 口径）。
-- 幂等性：两条 UPDATE 均带"未持有才追加"前置条件 ⇒ 可重复执行；
--         **反测口径 = 第二次执行时 "Rows matched: 0 / Changed: 0"**（见 §3）。
-- 与本单迁移的关系：docs/migrations/204_系统设置域权限点立码.sql 的**前两条 UPDATE 与本文件 §1 逐字同值**
--         （迁移走"人显式执行迁移"的通道；本文件走"运维直连库执行"的通道）。
--         为什么两条通道都要：迁移的数据写语句被 MIG-4 写闸门默认 block（MIGRATION_WRITE_GATE=block），
--         生产 .env 无该变量 ⇒ 只挂迁移会出现"看起来配了实际没配"的假能力（203 迁移的既有教训）。
-- 禁止事项：① 不得补 goods:delete（删除属高风险，留给超管/运营 —— 提案 §二·D1）；
--           ② 不得顺手给其它角色（SALESMAN / STORE_ADMIN / PURCHASE_STAFF / FINANCE_STAFF /
--              WAREHOUSE_STAFF / SALES_STAFF / CUSTOMER_SERVICE / OPERATION_ADMIN）增删任何码（红线②）；
--           ③ 不得在本文件内执行本批 14 个新码的菜单登记（那是迁移 204 的职责，见其 §一.②）。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) 前置：确认列类型与 12 个角色现状（只读；请把输出留档）
-- ----------------------------------------------------------------------------
-- 0.1 列类型（permissions 期望为 JSON；若为 TEXT/VARCHAR，JSON_* 函数仍可用，但需确认 JSON_VALID=1）
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sys_role' AND COLUMN_NAME IN ('permissions','data_scope');

-- 0.2 本单要动的行（执行前应看到 **每条租户 1 行**：default + demo 等克隆租户；
--     若某租户没有 STORE_MANAGER 行 ⇒ 停下报备，不要建行）
SELECT tenant_id, id, role_code, permissions
FROM t_sys_role
WHERE role_code = 'STORE_MANAGER'
ORDER BY tenant_id;

-- 0.3 执行前持有情况（基线读数，供 §3 对比：两个码在执行前应各为 0 行）
SELECT COUNT(*) AS rows_with_goods_create FROM t_sys_role
WHERE role_code = 'STORE_MANAGER' AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:create'));
SELECT COUNT(*) AS rows_with_goods_edit FROM t_sys_role
WHERE role_code = 'STORE_MANAGER' AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:edit'));

-- ----------------------------------------------------------------------------
-- 1) 回滚素材：把当前值转成可直接回放的 UPDATE（**执行前先落盘**，这是唯一可靠的还原路径）
-- ----------------------------------------------------------------------------
SELECT CONCAT(
         'UPDATE t_sys_role SET permissions = ''',
         REPLACE(permissions, '''', ''''''),
         ''' WHERE role_code = ''STORE_MANAGER'' AND tenant_id = ''', tenant_id, ''';'
       ) AS rollback_sql
FROM t_sys_role
WHERE role_code = 'STORE_MANAGER'
ORDER BY tenant_id;

-- ----------------------------------------------------------------------------
-- 2) 补权限（2 条；与迁移 204 的前两条 UPDATE 逐字同值）
-- ----------------------------------------------------------------------------

-- 2.1 STORE_MANAGER ← goods:create（新增商品）
-- 依据：授权模型提案 §二·D1 —— 商品页对店长可见（生产全量菜单矩阵），店长**已持** goods:price（同族先例），
--       页面 `goods:list` 的写入口（新增商品）本就对店长开放 ⇒ 符合不变量 I1'①；
--       不补则 A 类 15 条商品写端点接线后店长点击即 403。
UPDATE t_sys_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'goods:create')
WHERE role_code = 'STORE_MANAGER'
  AND permissions IS NOT NULL
  AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:create')) = 0;

-- 2.2 STORE_MANAGER ← goods:edit（编辑商品）
-- 依据：同上（编辑与新增同属商品写入口；删除不在此列 —— 高风险，见文件头"禁止事项①"）。
UPDATE t_sys_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'goods:edit')
WHERE role_code = 'STORE_MANAGER'
  AND permissions IS NOT NULL
  AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:edit')) = 0;

-- ----------------------------------------------------------------------------
-- 3) 执行后核对（机器可判；**第二次执行时 §2 的两条必须给 "Rows matched: 0 / Changed: 0"**）
-- ----------------------------------------------------------------------------
-- 3.1 逐码命中行数：执行后应**等于** §0.2 的行数（= STORE_MANAGER 总行数），且两码相等
SELECT COUNT(*) AS rows_with_goods_create FROM t_sys_role
WHERE role_code = 'STORE_MANAGER' AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:create'));
SELECT COUNT(*) AS rows_with_goods_edit FROM t_sys_role
WHERE role_code = 'STORE_MANAGER' AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:edit'));

-- 3.2 逐码恰好多一个（不是倍数）：数组里 goods:create 出现的次数必须 = 1（防"跑两遍追加两次"）
SELECT tenant_id, JSON_LENGTH(JSON_EXTRACT(permissions, '$')) AS perm_len,
       (LENGTH(permissions) - LENGTH(REPLACE(permissions, 'goods:create', ''))) / LENGTH('goods:create') AS create_occurrences,
       (LENGTH(permissions) - LENGTH(REPLACE(permissions, 'goods:edit', ''))) / LENGTH('goods:edit') AS edit_occurrences
FROM t_sys_role
WHERE role_code = 'STORE_MANAGER'
ORDER BY tenant_id;

-- 3.3 越权自证：goods:delete 不得出现在任何角色的 permissions 里（本单不新增该码的持有面）
SELECT COUNT(*) AS rows_holding_goods_delete FROM t_sys_role
WHERE JSON_VALID(permissions) = 1 AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:delete'));

-- 3.4 未被本单触碰的角色零改动（导出与 §0 逐行 diff，12 行里除 STORE_MANAGER 外应逐字相同）
SELECT tenant_id, role_code, permissions
FROM t_sys_role
WHERE role_code <> 'STORE_MANAGER'
ORDER BY tenant_id, id;

-- ----------------------------------------------------------------------------
-- 4) 回滚（两条路径，任选其一）
-- ----------------------------------------------------------------------------
-- 4.1 精确回滚（按值定位下标，只摘本迁移追加过的那个值、不动其它码）
--     ⚠️ 若该角色**原本就有** goods:create/edit（§0.3 基线非 0），本节会把原有值一并摘掉 ⇒ 只能回滚
--        "§0.3 基线为 0"的码，其余一律用 §1 落盘的 rollback_sql 整列回放。
UPDATE t_sys_role
SET permissions = JSON_REMOVE(permissions, JSON_UNQUOTE(JSON_SEARCH(permissions, 'one', 'goods:create')))
WHERE role_code = 'STORE_MANAGER' AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:create')) = 1;

UPDATE t_sys_role
SET permissions = JSON_REMOVE(permissions, JSON_UNQUOTE(JSON_SEARCH(permissions, 'one', 'goods:edit')))
WHERE role_code = 'STORE_MANAGER' AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:edit')) = 1;

-- 4.2 整列回放：把 §1 输出的 rollback_sql 逐租户执行（用于"原本就有这两个码"的租户）
