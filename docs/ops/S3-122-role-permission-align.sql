-- ============================================================================
-- 编号：S3-122-F3（服务器侧数据订正，**非 DDL、非迁移文件**）
-- 名称：按前端 `roles` 门禁补齐 G0 权限点（防 S3-122-F2 接线锁死正常流程）
-- 产出：阿坚（后端）｜2026-09-26｜派单卡：docs/tasks/cards/R101-派单-20260926-S3-122-F3.md
-- 执行人：凌舟（本单**只产出不执行**，红线③）
-- 依据：docs/tasks/cards/R101-S3-122-F3-阿坚-不锁死矩阵.md §三（逐条给 :行号）
-- 目标表：t_sys_role（租户 default）；权限串被签进 JWT（auth.ts:76-83，expiresIn 4h）
--         ⇒ **执行后相关账号必须重新登录才生效**，不得用"改完立刻生效"当验收判据。
-- 幂等性：三条 UPDATE 均带"未持有才追加"前置条件 ⇒ 可重复执行；
--         **反测口径 = 第二次执行时 "Rows matched: 0 / Changed: 0"**（见 §4）。
-- 禁止事项：① 不得补 `goods:price`（前端 :177 与红线⑤冲突，见 §5，待凌舟裁定）；
--           ② 不得在本文件内建角色（CASHIER 角色缺失问题见 §5，属另案）。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) 前置：确认列类型与 12 个角色现状（只读；请把输出留档）
-- ----------------------------------------------------------------------------
-- 0.1 列类型（permissions 期望为 JSON；若为 TEXT/VARCHAR 仍可执行，见 §3 备选写法）
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sys_role' AND COLUMN_NAME IN ('permissions','data_scope');

-- 0.2 12 个角色 × 当前 permissions（本单矩阵的**权威数据源**，凌舟核对后再执行 §2）
SELECT id, role_code, role_name, data_scope, permissions, status
FROM t_sys_role
WHERE tenant_id = 'default'
ORDER BY id;

-- 0.3 只统计本单要动的两行（执行前必须 2 行；为空说明角色集合与源码口径不一致 ⇒ 停下报备）
SELECT role_code, permissions
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
-- 2) 补权限（3 条，逐条给依据；无前端依据的一律不补）
-- ----------------------------------------------------------------------------

-- 2.1 STORE_MANAGER ← finance:payment
-- 依据：前端 `admin-web/src/router/index.ts:269`（pos/daily-settle，POS 日结管理
--       [SUPER_ADMIN,STORE_MANAGER,CASHIER,STORE_OPERATOR] → DailySettleView.vue →
--       POST /admin/daily-settlements，接线后要求 finance:payment）+
--       `:112`（sales/commission/records [SUPER_ADMIN,STORE_MANAGER] → CommissionRecords.vue →
--       POST /admin/commission/settle，同上）。
-- 现状：STORE_MANAGER = ["store:*","sale:*","customer:*","inventory:*","report:*","dashboard:*"]，
--       无任何 finance:*（精确/域通配均不匹配）⇒ 不补则"店长日结/提成结算"403。
UPDATE t_sys_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'finance:payment')
WHERE tenant_id = 'default'
  AND role_code = 'STORE_MANAGER'
  AND permissions IS NOT NULL
  AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('finance:payment')) = 0;

-- 2.2 STORE_OPERATOR ← sale:return
-- 依据：前端 `admin-web/src/router/index.ts:263`（pos/sale-return，POS 销售退货
--       [SUPER_ADMIN,STORE_MANAGER,CASHIER,STORE_OPERATOR]，与 :107 PC 退货共用
--       views/pos/SaleReturnView.vue）；接线点在 backend/src/routes/sale-return.routes.ts:15
--       `POST /:returnNo/refund`（该 Router 同时挂 /api/admin/sale-returns 与 /api/store/sale-returns）。
-- 现状：STORE_OPERATOR = ["sale:create","sale:view","inventory:view","dashboard:view"] ⇒ 不补则"操作员退货"403。
UPDATE t_sys_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'sale:return')
WHERE tenant_id = 'default'
  AND role_code = 'STORE_OPERATOR'
  AND permissions IS NOT NULL
  AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('sale:return')) = 0;

-- 2.3 STORE_OPERATOR ← finance:payment
-- 依据：前端 `admin-web/src/router/index.ts:269`（pos/daily-settle 的 meta.roles 含 STORE_OPERATOR
--       → DailySettleView.vue:146 submitStoreDailySettle → admin-web/src/api/pos.ts:213
--       POST /admin/daily-settlements → 接线点 admin-finance.routes.ts:11 要求 finance:payment）。
-- ⚠ 副作用（必须由凌舟裁定后才执行）：finance:payment 是**粗粒度域内动作码**，补上后
--   STORE_OPERATOR 同时能通过 `/admin/commission/settle`、`/admin/payments-new/:no/writeoff`、
--   `/admin/receipts/:no/writeoff`、`/store/receivables/:no/payment` 的权限门（前端并未给操作员
--   暴露这些入口）。若凌舟判定"操作员不应持有 finance:payment"，则本单 2.3 **不执行**，
--   改走"日结另立独立权限点"的接线粒度方案（属 F2 范围，F3 不得接线）。
UPDATE t_sys_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'finance:payment')
WHERE tenant_id = 'default'
  AND role_code = 'STORE_OPERATOR'
  AND permissions IS NOT NULL
  AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('finance:payment')) = 0;

-- ----------------------------------------------------------------------------
-- 3) 备选写法（仅当 §0.1 显示 permissions 为 TEXT/VARCHAR 且存在脏值时使用）
-- ----------------------------------------------------------------------------
-- 说明：JSON_VALID(permissions) = 1 会把"非法 JSON 的脏值"挡在 WHERE 之外（不报错、不修改）；
--       如需对脏值也强行补齐，先把脏值清理/登记，再执行上面的三条 UPDATE，不要直接放开 JSON_VALID。
-- UPDATE t_sys_role
-- SET permissions = JSON_ARRAY_APPEND(CAST(permissions AS JSON), '$', 'sale:return')
-- WHERE tenant_id = 'default' AND role_code = 'STORE_OPERATOR'
--   AND permissions IS NOT NULL AND JSON_VALID(permissions) = 1
--   AND COALESCE(permissions, '[]') NOT LIKE '%"sale:return"%';

-- ----------------------------------------------------------------------------
-- 4) 执行后校验（含幂等反测）
-- ----------------------------------------------------------------------------
-- 4.1 12 个角色 permissions 全量打印（派单卡要求的校验 SQL）
SELECT id, role_code, role_name, permissions
FROM t_sys_role
WHERE tenant_id = 'default'
ORDER BY id;

-- 4.2 目标两点是否就位（1 = 持有；0 = 未持有；NULL = 无法判定/脏值）
SELECT role_code,
       JSON_CONTAINS(permissions, JSON_QUOTE('sale:return'))     AS has_sale_return,
       JSON_CONTAINS(permissions, JSON_QUOTE('finance:payment')) AS has_finance_payment,
       JSON_LENGTH(permissions)                                  AS perm_count
FROM t_sys_role
WHERE tenant_id = 'default' AND role_code IN ('STORE_MANAGER','STORE_OPERATOR')
ORDER BY role_code;

-- 4.3 幂等反测：**再次执行 §2 的三条 UPDATE**，期望输出 "Rows matched: 0  Changed: 0"
--     （若 matched > 0 ⇒ 说明有重复追加风险，立即停下报备）

-- 4.4 重复项检查（期望每项计数 = 1）
SELECT role_code,
       JSON_LENGTH(JSON_EXTRACT(permissions, '$')) AS total,
       (JSON_LENGTH(JSON_EXTRACT(permissions, '$')) -
        JSON_LENGTH(JSON_REMOVE(permissions, JSON_UNQUOTE(
          JSON_SEARCH(permissions, 'one', 'sale:return')))))   AS sale_return_dups
FROM t_sys_role
WHERE tenant_id = 'default' AND role_code = 'STORE_OPERATOR';

-- ----------------------------------------------------------------------------
-- 5) 明确**不补**的两项（红线⑤ + 角色缺失，均只登记不执行）
-- ----------------------------------------------------------------------------
-- 5.1 `goods:price` 不补：前端 :142（inventory-batch-price [SUPER_ADMIN]）与红线⑤一致；
--     但 :177（prices 价格管理 [SUPER_ADMIN,STORE_MANAGER]）经 PricesView.vue 调用
--     price.routes.ts:15/16/17/21/30/31/32（均要求 goods:price）⇒ 数据与 :177 冲突。
--     该冲突**不在本 SQL 内单方面解决**，由凌舟裁定（改前端门禁 / 改接线粒度 / 补 goods:price 三选一）。
-- 5.2 `CASHIER` 不补：前端 :258/:263/:269 等门禁含 CASHIER，但源码种子里**没有任何角色行为 CASHIER**
--     （079/128/120d/099/008 均无；CASHIER 仅出现在 admin-web 门禁与 backend/src/middleware/auth.ts:24 的
--     CASHIER_ROLES 列表）⇒ 无法通过 UPDATE 补齐，属"角色本身缺失"，需凌舟核实生产库是否手工建过该角色。

-- ============================================================================
-- 附：本单**不含**的处置（避免误读为已完成）
--   · F2 的 32 处接线仍未合并（停在 issue-157 工作区），执行本 SQL 不会使接线生效；
--   · 执行顺序建议：先执行本 SQL → 相关账号重新登录 → 再合并 F2 接线（避免中间窗口出现 403）；
--   · 若先合并 F2 再执行本 SQL，则窗口期内 STORE_OPERATOR 退货与 STORE_MANAGER 日结会 403。
-- ============================================================================
