-- ============================================
-- 迁移编号：206
-- 单号：S3-234 生产回归处置（凌舟，2026-10-16 深夜）
-- 描述：回补 **S3-234 首次全清单部署**中被历史语料覆盖掉的角色权限码（**只增不减**、幂等）
-- ============================================
--
-- 一、事件与根因（先写清楚，否则后人会把本文件当"多余动作"删掉）
--   ① S3-234 把部署迁移段由「硬编码 3 条」改为「清单驱动 185 条」（第 74 项）后，
--      生产首次全量执行 ⇒ 历史语料里的**数据写入型**迁移（如 `128_fix_roles_binding.sql`）
--      用**它自带的旧口径**重写了 `t_sys_role.permissions`；
--   ② 结果：两个**在用角色**丢码（生产只读实测，2026-10-16）——
--        STORE_MANAGER ：丢 `finance:payment` / `goods:price` / `finance:daily-settle`
--                        （9 → 8，D1 补的 `goods:create|edit` 仍在）
--        STORE_OPERATOR：丢 `dashboard:view` / `sale:return` / `finance:daily-settle`
--                        （6 → 3）
--      影响：店长收款/改价/日结、操作员退货/日结/看板 会 403。
--   ③ **为什么两遍夹具测试没抓到**：夹具库本身是用同一批迁移**从零建**的 ⇒ 128 的输出在夹具里
--      「恰好等于夹具状态」⇒ 表现为幂等；而生产是**漂移过的真数据** ⇒ 一回放就被覆盖。
--      这是**方法论漏洞**（夹具幂等 ≠ 对漂移真库安全），已登记；后续把"数据写入型"迁移移出部署通道。
--
-- 二、本文件语义（**只增不减**，幂等）
--   仅当角色**缺**该码时追加；绝不删除、绝不覆盖既有值 ⇒ 重复执行 affectedRows=0。
--   依据：生产底稿 `docs/evidence/_shared/prod-roles-20261016.txt` §一（导出时刻的权威值）。
--
-- 三、可重复执行：是（`JSON_CONTAINS` 前置判定）
--

-- STORE_MANAGER：回补 3 码（底稿 §一 的 9 项 + D1 的 goods:create|edit = 11 项）
UPDATE t_sys_role SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'finance:payment')
WHERE role_code = 'STORE_MANAGER' AND tenant_id = 'default'
  AND permissions IS NOT NULL AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('finance:payment')) = 0;

UPDATE t_sys_role SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'goods:price')
WHERE role_code = 'STORE_MANAGER' AND tenant_id = 'default'
  AND permissions IS NOT NULL AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:price')) = 0;

UPDATE t_sys_role SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'finance:daily-settle')
WHERE role_code = 'STORE_MANAGER' AND tenant_id = 'default'
  AND permissions IS NOT NULL AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('finance:daily-settle')) = 0;

-- STORE_OPERATOR：回补 3 码（底稿 §一 的 6 项）
UPDATE t_sys_role SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'dashboard:view')
WHERE role_code = 'STORE_OPERATOR' AND tenant_id = 'default'
  AND permissions IS NOT NULL AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('dashboard:view')) = 0;

UPDATE t_sys_role SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'sale:return')
WHERE role_code = 'STORE_OPERATOR' AND tenant_id = 'default'
  AND permissions IS NOT NULL AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('sale:return')) = 0;

UPDATE t_sys_role SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'finance:daily-settle')
WHERE role_code = 'STORE_OPERATOR' AND tenant_id = 'default'
  AND permissions IS NOT NULL AND JSON_VALID(permissions) = 1
  AND JSON_CONTAINS(permissions, JSON_QUOTE('finance:daily-settle')) = 0;

-- 四、核对（只读打印，便于 run-migration.mjs 的 result 字段留痕）
SELECT CONCAT('206 核对：STORE_MANAGER=', (SELECT JSON_LENGTH(permissions) FROM t_sys_role WHERE role_code='STORE_MANAGER' AND tenant_id='default'),
              ' / STORE_OPERATOR=', (SELECT JSON_LENGTH(permissions) FROM t_sys_role WHERE role_code='STORE_OPERATOR' AND tenant_id='default'),
              '（期望 11 / 6）') AS result;
