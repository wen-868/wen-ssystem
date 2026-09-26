-- ============================================================================
-- 编号：S3-122-F4（服务器侧数据订正，**非 DDL、非迁移文件**）
-- 名称：日结权限点从 finance:payment 拆出后的角色数据订正（消除 STORE_OPERATOR 越权面）
-- 产出：阿坚（后端）｜2026-09-26｜派单卡：docs/tasks/cards/R101-派单-20260926-S3-122-F4.md
-- 执行人：凌舟（本单**只产出不执行**，红线④）
-- 依据：本卡 R1/R3 + 凌舟本轮生产角色实值（2026-09-26 只读取证）：
--       STORE_MANAGER  = ["store:*","sale:*","customer:*","inventory:*","report:*","dashboard:*","finance:payment","goods:price"]
--       STORE_OPERATOR = ["sale:create","sale:view","inventory:view","dashboard:view","sale:return","finance:payment"]
--       接线点：backend/src/routes/admin-finance.routes.ts:11（日结端点本单改挂 finance:daily-settle）
--       其余四处（commission/payment-new/receipt/store-receivable）**继续挂 finance:payment**，本单不动。
-- 目标表：t_sys_role（租户 default）
-- ★ 生效口径：**执行后相关账号必须重新登录才生效。**
--   权限串会随登录响应签发给前端（services/admin/auth.service.ts:186-207 的 user.permissions，
--   token expiresIn 4h，见 middleware/auth.ts:72-83），前端路由/菜单门禁读的正是它
--   （admin-web/src/router/index.ts:269 日结管理 meta.roles）⇒ 不重新登录，前端可见性仍是旧串。
--   （后端 requirePermission 是**请求期读库**判定——services/admin/rbac.service.ts
--    checkUserPermission 查 t_sys_role.permissions，故后端拦截不受登录态限制。）
-- 幂等性：三条 UPDATE 均带"未持有才追加 / 持有才删除"前置条件 ⇒ 可重复执行；
--         **反测口径 = 第二次执行时输出 "Rows matched: 0  Changed: 0"**（见 §4.3）。
-- 明确不动：① #2–#5 端点的权限点（仍 finance:payment）；② 通配持有者（FINANCE_STAFF `finance:*`、
--           OPERATION_ADMIN / SUPER_ADMIN `*`）；③ 不新增角色、不新增其他权限点。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) 前置：只读核对（请把输出留档；与 §0.3 不符时停下报备，不要继续执行 §2）
-- ----------------------------------------------------------------------------
-- 0.1 列类型（permissions 期望为 JSON；若为 TEXT/VARCHAR 仍可执行，见 §3 备选写法）
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sys_role' AND COLUMN_NAME = 'permissions';

-- 0.2 只统计本单要动的两行（执行前必须 2 行；为空说明角色集合与源码口径不一致 ⇒ 停下报备）
SELECT role_code, role_name, permissions
FROM t_sys_role
WHERE tenant_id = 'default' AND role_code IN ('STORE_MANAGER','STORE_OPERATOR')
ORDER BY role_code;

-- 0.3 本单前置应有形态（执行前逐项核对，任一不符 ⇒ 停下报备）
--     STORE_OPERATOR：has_finance_payment = 1（本单要删）、has_finance_daily_settle = 0（本单要补）
--     STORE_MANAGER ：has_finance_payment = 1（**保留**）、has_finance_daily_settle = 0（本单要补）
SELECT role_code,
       JSON_CONTAINS(permissions, JSON_QUOTE('finance:payment'))      AS has_finance_payment,
       JSON_CONTAINS(permissions, JSON_QUOTE('finance:daily-settle')) AS has_finance_daily_settle,
       JSON_LENGTH(permissions)                                       AS perm_count
FROM t_sys_role
WHERE tenant_id = 'default' AND role_code IN ('STORE_MANAGER','STORE_OPERATOR')
ORDER BY role_code;

-- ----------------------------------------------------------------------------
-- 1) 回滚素材：把当前值转成可直接回放的 UPDATE（执行前先落盘）
-- ----------------------------------------------------------------------------
SELECT CONCAT(
         'UPDATE t_sys_role SET permissions = ''',
         REPLACE(permissions, '''', ''''''),
         ''' WHERE role_code = ''', role_code, ''' AND tenant_id = ''default'';'
       ) AS rollback_sql
FROM t_sys_role
WHERE tenant_id = 'default' AND role_code IN ('STORE_MANAGER','STORE_OPERATOR')
ORDER BY role_code;

-- ----------------------------------------------------------------------------
-- 2) 幂等正文（3 条语句：2.1 删 / 2.2 补 / 2.3 补）
-- ----------------------------------------------------------------------------

-- 2.1 STORE_OPERATOR **删** finance:payment（日结不再走它 ⇒ 操作员失去 #2–#5 四个收款类端点的门）
-- 定位方式：JSON_SEARCH(..., 'one', 'finance:payment') **按值找路径**（不写死数组下标）；
-- 保护：先判 JSON_CONTAINS = 1（未持有时 JSON_SEARCH 返回 NULL，JSON_REMOVE(..., NULL) 会整列置 NULL，
--       故该前置条件是**安全必需项**，不可删）。
-- ⚠ 保留 `sale:return` 等其它元素：只移除 finance:payment 这一项。
UPDATE t_sys_role
SET permissions = JSON_REMOVE(permissions, JSON_UNQUOTE(JSON_SEARCH(permissions, 'one', 'finance:payment')))
WHERE tenant_id = 'default'
  AND role_code = 'STORE_OPERATOR'
  AND permissions IS NOT NULL
  AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('finance:payment')) = 1;

-- 2.2 STORE_OPERATOR **补** finance:daily-settle（只保留 #1 日结可达，语义见卡面 R1/R3）
-- 幂等条件：未持有才追加（重复执行 ⇒ Rows matched: 0 / Changed: 0）
UPDATE t_sys_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'finance:daily-settle')
WHERE tenant_id = 'default'
  AND role_code = 'STORE_OPERATOR'
  AND permissions IS NOT NULL
  AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('finance:daily-settle')) = 0;

-- 2.3 STORE_MANAGER **补** finance:daily-settle（**保留** finance:payment：#2 提成结算 :112 与
--     #5 收款类 :108 均为其前端既有能力，属正当持有，卡面 R3 明令不得删）
UPDATE t_sys_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'finance:daily-settle')
WHERE tenant_id = 'default'
  AND role_code = 'STORE_MANAGER'
  AND permissions IS NOT NULL
  AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('finance:daily-settle')) = 0;

-- ----------------------------------------------------------------------------
-- 3) 备选写法（仅当 §0.1 显示 permissions 为 TEXT/VARCHAR 且存在脏值时使用）
-- ----------------------------------------------------------------------------
-- 说明：JSON_VALID(permissions) = 1 会把"非法 JSON 的脏值"挡在 WHERE 之外（不报错、不修改）；
--       如需对脏值也强行订正，先清理/登记脏值，再执行 §2，不要直接放开 JSON_VALID。
-- UPDATE t_sys_role
-- SET permissions = JSON_REMOVE(CAST(permissions AS JSON),
--                        JSON_UNQUOTE(JSON_SEARCH(CAST(permissions AS JSON), 'one', 'finance:payment')))
-- WHERE tenant_id = 'default' AND role_code = 'STORE_OPERATOR'
--   AND permissions IS NOT NULL AND JSON_VALID(permissions) = 1
--   AND permissions LIKE '%"finance:payment"%';

-- ----------------------------------------------------------------------------
-- 4) 执行后校验（打印两行 + 断言 JSON_CONTAINS 结果 + 幂等反测 + 重复项检查）
-- ----------------------------------------------------------------------------
-- 4.1 两行 permissions 原值
SELECT role_code, role_name, permissions
FROM t_sys_role
WHERE tenant_id = 'default' AND role_code IN ('STORE_MANAGER','STORE_OPERATOR')
ORDER BY role_code;

-- 4.2 断言（期望两行全 PASS）：
--     STORE_MANAGER  期望 has_finance_payment = 1 且 has_finance_daily_settle = 1
--     STORE_OPERATOR 期望 has_finance_payment = 0 且 has_finance_daily_settle = 1
SELECT role_code,
       JSON_CONTAINS(permissions, JSON_QUOTE('finance:payment'))      AS has_finance_payment,
       JSON_CONTAINS(permissions, JSON_QUOTE('finance:daily-settle')) AS has_finance_daily_settle,
       JSON_LENGTH(permissions)                                       AS perm_count,
       CASE role_code
         WHEN 'STORE_MANAGER' THEN
           IF(JSON_CONTAINS(permissions, JSON_QUOTE('finance:payment')) = 1
              AND JSON_CONTAINS(permissions, JSON_QUOTE('finance:daily-settle')) = 1, 'PASS', 'FAIL')
         WHEN 'STORE_OPERATOR' THEN
           IF(JSON_CONTAINS(permissions, JSON_QUOTE('finance:payment')) = 0
              AND JSON_CONTAINS(permissions, JSON_QUOTE('finance:daily-settle')) = 1, 'PASS', 'FAIL')
       END                                                            AS assertion
FROM t_sys_role
WHERE tenant_id = 'default' AND role_code IN ('STORE_MANAGER','STORE_OPERATOR')
ORDER BY role_code;

-- 4.3 幂等反测：**再次执行 §2 的三条 UPDATE（2.1 只对 STORE_OPERATOR 生效、2.2/2.3 各一行）**，
--     期望三行输出均为 "Rows matched: 0  Changed: 0"
--     （若 matched > 0 ⇒ 说明有重复追加/重复删除风险，立即停下报备）

-- 4.4 出现次数核对（每项期望出现 1 次；未持有记 0）：
--     STORE_MANAGER  ⇒ finance_payment_count = 1、finance_daily_settle_count = 1
--     STORE_OPERATOR ⇒ finance_payment_count = 0、finance_daily_settle_count = 1
--     （>1 说明有重复追加，立即停下报备；COALESCE 处理"该项不存在时 JSON_SEARCH 返回 NULL"）
SELECT role_code,
       JSON_LENGTH(permissions) AS total,
       COALESCE(JSON_LENGTH(permissions) -
                JSON_LENGTH(JSON_REMOVE(permissions, JSON_UNQUOTE(JSON_SEARCH(permissions, 'one', 'finance:payment')))), 0)      AS finance_payment_count,
       COALESCE(JSON_LENGTH(permissions) -
                JSON_LENGTH(JSON_REMOVE(permissions, JSON_UNQUOTE(JSON_SEARCH(permissions, 'one', 'finance:daily-settle')))), 0) AS finance_daily_settle_count
FROM t_sys_role
WHERE tenant_id = 'default' AND role_code IN ('STORE_MANAGER','STORE_OPERATOR')
ORDER BY role_code;

-- ----------------------------------------------------------------------------
-- 5) 本单**不含**的处置（避免误读为已完成）
-- ----------------------------------------------------------------------------
-- · 日结接线（admin-finance.routes.ts:11 改挂 finance:daily-settle）**必须在代码库里合并上线**，
--   只执行本 SQL 不生效；执行顺序窗口说明：
--     先执行本 SQL → 接线上线前，STORE_MANAGER/STORE_OPERATOR 的「日结」仍走 finance:payment 判定，
--     二者在 SQL 后仍持有 finance:daily-settle 而**不再持有 finance:payment 的操作员**会在该窗口被 403；
--     先合并接线 → 窗口内两个角色的「日结」都缺 finance:daily-settle 而被 403。
--   两种顺序都存在窗口，建议：**接线上线后立即执行本 SQL**，窗口期内受影响面仅为「日结生成」
--   （读侧与 #2–#5 不受影响），并同步要求相关账号重新登录。
-- · CASHIER 角色缺失（前端 :269 门禁含 CASHIER，源码种子里无该角色）属 F5，本单不建角色。
-- · credit.routes.ts 的收款类路由当前**未挂 requirePermission**（本单红线只涉及 #1–#5，未触碰）。
-- ============================================================================
