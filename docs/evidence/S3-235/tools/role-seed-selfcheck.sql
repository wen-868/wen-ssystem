-- ============================================
-- S3-235 · R3：灾备/新库切换后的只读自检（30 秒档）
-- 用途：部署或灾备切换后，确认"角色权限种子"是否真的在库里
-- 单号：S3-235（收口总清单第 72 项）｜执行方：阿坚（后端 / 权限）｜日期：2026-10-16
-- 通道：**只读**（本文件不含 INSERT/UPDATE/DELETE/REPLACE/CALL/DDL；不会写库）
-- ============================================
--
-- 判据口径（"在用角色"的定义）：
--   在用角色 = 至少被一个账号绑定的角色（t_sys_user_role 里有绑定行）。
--   为什么这样定：没有任何账号绑定的空权限角色，对"灾备切过去能不能干活"没有影响；
--   把它算进 FAIL 会制造噪声（例：库里留着的历史角色）。故 FAIL 判据只看"在用角色"。
--   ⚠️ 为什么**不**再叠加 status 过滤（实测坑）：同一台空库里角色的 status 口径并不统一——
--      S3-235 空库演练实测：绑定到演示账号的 STORE_MANAGER/STORE_OPERATOR/SALES_STAFF/PURCHASER/SUPER_ADMIN 里，
--      有 5 个 status='1'、其余 'ACTIVE'。若判据写成 `status='ACTIVE'`，这 5 个"真在用"的角色会被整体排除，
--      空权限也照样 PASS ⇒ 假绿。故本文件只用"有绑定"这一条客观事实。
--   同时给出"全部角色"的口径供对照（不参与 PASS/FAIL 判定）。
--
-- 怎么跑（任选其一）：
--   ① node scripts/run-migration.mjs docs/evidence/S3-235/tools/role-seed-selfcheck.sql
--      （按本项目约定，脚本会打印最后一条 SELECT 的 result 字段）
--   ② mysql -h <host> -P <port> -u <user> -p <db> < docs/evidence/S3-235/tools/role-seed-selfcheck.sql
--
-- 期望输出：
--   · 正常：`PASS: 在用角色里 permissions 为空 = 0 行（在用角色 12 个 / 全部角色 12 个）`
--   · 异常：`FAIL: 在用角色里 permissions 为空 = N 行（…）⇒ 处置：…`
--
-- FAIL 怎么处置（按顺序）：
--   1) 补跑种子（无写闸门）：node scripts/run-migration.mjs docs/migrations/205_角色权限种子.sql
--   2) 若在第 1 步之后仍是 FAIL：确认这台库的角色行是否被写闸门跳过过
--      （MIGRATION_WRITE_GATE 默认 block 会跳过 205 的 INSERT/UPDATE ⇒ 后端启动链跑完也不会有权限）；
--      灾备/新库重建时必须显式 MIGRATION_WRITE_GATE=allow 再启动一次，或按第 1 步手工补跑。
--   3) 仍异常 ⇒ 停止切换，回报凌舟（附本文件原始输出）。
-- ============================================

-- 明细：把"空权限"的角色逐行列出来（含绑定账号数），便于直接定位
SELECT r.tenant_id,
       r.role_code,
       r.role_name,
       r.status,
       (SELECT COUNT(*) FROM t_sys_user_role ur WHERE ur.role_id = r.id) > 0 AS in_use,
       (SELECT COUNT(*) FROM t_sys_user_role ur WHERE ur.role_id = r.id) AS bound_users
FROM t_sys_role r
WHERE (r.permissions IS NULL
       OR JSON_VALID(r.permissions) = 0
       OR JSON_TYPE(r.permissions) = 'NULL'
       OR JSON_LENGTH(r.permissions) = 0)
ORDER BY r.tenant_id, r.role_code;

-- 判定（最后一条语句 ⇒ run-migration.mjs 会打印它的 result）
SELECT CONCAT(
  IF(bad_in_use = 0, 'PASS', 'FAIL'),
  ': 在用角色（有账号绑定）里 permissions 为空 = ', bad_in_use, ' 行',
  '（在用角色 ', in_use_total, ' 个 / 全部角色 ', all_total, ' 个；全部角色里为空 = ', bad_all, ' 行）',
  IF(bad_in_use = 0, '', CONCAT(' ⇒ 处置：先跑 node scripts/run-migration.mjs docs/migrations/205_角色权限种子.sql；若仍失败，按 MIGRATION_WRITE_GATE=allow 重启后再跑，仍未好则停止切换并回报凌舟'))
) AS result
FROM (
  SELECT
    (SELECT COUNT(*) FROM t_sys_role r
      WHERE EXISTS (SELECT 1 FROM t_sys_user_role ur WHERE ur.role_id = r.id)
        AND (r.permissions IS NULL OR JSON_VALID(r.permissions) = 0
             OR JSON_TYPE(r.permissions) = 'NULL' OR JSON_LENGTH(r.permissions) = 0)) AS bad_in_use,
    (SELECT COUNT(*) FROM t_sys_role r
      WHERE EXISTS (SELECT 1 FROM t_sys_user_role ur WHERE ur.role_id = r.id)) AS in_use_total,
    (SELECT COUNT(*) FROM t_sys_role) AS all_total,
    (SELECT COUNT(*) FROM t_sys_role r
      WHERE (r.permissions IS NULL OR JSON_VALID(r.permissions) = 0
             OR JSON_TYPE(r.permissions) = 'NULL' OR JSON_LENGTH(r.permissions) = 0)) AS bad_all
) AS counts;
