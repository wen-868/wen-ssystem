-- ============================================
-- 迁移编号：200
-- 描述：账号口径统一 —— 唯一对外账号 admin（口令为公开值，口径见 backend/src/config/constants.ts
--       的 DEMO_PASSWORD；本文件只落哈希，不写明文）、门店账号口令轮换、demo 账号停用
-- 创建人：阿坚
-- 日期：2026-10-15
-- 依据：派单 S3-203 / 处置卡 docs/tasks/cards/R101-S3-203-账号口径统一处置-凌舟.md
-- ============================================
--
-- 一、本迁移做什么（与处置卡 §一~§三 逐条对应）
--   1. `t_sys_user`（租户 default）的 `admin` 与 `t_platform_admin` 的 `admin` 口令统一为
--      业主定案的唯一对外口令（口径见 backend/src/config/constants.ts 的 DEMO_PASSWORD）；
--      两个账号**同名同口令但身份与权限各自独立**（平台侧 = t_platform_admin，租户侧 = t_sys_user）。
--   2. `store_manager` / `store_operator`（租户 default）轮换为**不公开的强口令**（只落哈希，
--      明文只在交付回复里给业主与凌舟，不入仓库、不入日志、不入提交信息）。
--   3. `demo`（租户 demo）**停用**（status=0）并把口令轮换为随机值 ⇒ 全系统只剩一个对外口径。
--
-- 二、本迁移不做什么（避免越权改业务语义）
--   · **不删除**任何账号、角色与绑定行：`demo` 只停用，历史绑定原样保留（可一条 UPDATE 回滚）。
--   · 不动 `t_sys_user` 里其它租户的同名账号（每条写语句都带 `tenant_id` 限定）。
--   · 不改任何 DDL，不建表、不加列。
--   · **不写明文口令**：四条语句的 `password_hash` 全部是 bcrypt（v2$ 前缀、cost=12，
--     与 backend/src/shared/password.ts 的 hashPassword 同口径）；明文不进本文件。
--     哈希生成与「新口令匹配 / 旧口令不匹配」的双向自证见
--     docs/evidence/S3-203/01-hash-generation.json（脚本 docs/evidence/S3-203/gen-hashes.cjs）。
--
-- 三、幂等（判据：连跑两遍，第二遍零变更）
--   每条 UPDATE 的 WHERE 都带「值尚不等于目标值」的守卫 ⇒ 第二遍命中 0 行、affectedRows=0，
--   不会因为 `updated_at=NOW()` 造成"第二遍仍有变更"的假幂等。
--
-- 四、执行方式（重要）
--   迁移写闸门（MIG-4）默认 block，会**跳过** INSERT/UPDATE/DELETE ⇒ 必须显式放行：
--     MIGRATION_WRITE_GATE=allow node scripts/run-migration.mjs docs/migrations/200_账号口径统一.sql
--   本迁移在生产只允许由凌舟经部署通道执行（本单在本地副本库完成验证，零生产写操作）。
--
-- 五、回滚（人工执行，非自动）
--   · `admin` / `store_manager` / `store_operator` 的口令回滚 = 重新执行 075 / 127（旧口径哈希）；
--   · `demo` 恢复启用 = `UPDATE t_sys_user SET status = 1 WHERE username = 'demo' AND tenant_id = 'demo';`
--   （口令不回滚为公开值：旧公开口令已按 S3-203 口径作废。）

-- 1) 租户 default 超管 admin：唯一对外口令（同时承担演示入口，见 S3-203 处置卡 §一）
UPDATE t_sys_user
SET password_hash = 'v2$$2b$12$v8wQ/Iwwz7md5Rqc9dkwKu4YVwTrbWWHR01xset3KFGkkY5RyU7Fm',
    status = 1,
    login_fail_count = 0,
    locked_until = NULL,
    updated_at = NOW()
WHERE username = 'admin'
  AND tenant_id = 'default'
  AND (password_hash <> 'v2$$2b$12$v8wQ/Iwwz7md5Rqc9dkwKu4YVwTrbWWHR01xset3KFGkkY5RyU7Fm'
       OR status <> 1
       OR login_fail_count <> 0
       OR locked_until IS NOT NULL);

-- 2) 平台侧超管 admin：与租户侧同名同口令（平台身份独立，权限走 requirePlatformPermission）
UPDATE t_platform_admin
SET password_hash = 'v2$$2b$12$v8wQ/Iwwz7md5Rqc9dkwKu4YVwTrbWWHR01xset3KFGkkY5RyU7Fm',
    status = 1,
    updated_at = NOW()
WHERE username = 'admin'
  AND (password_hash <> 'v2$$2b$12$v8wQ/Iwwz7md5Rqc9dkwKu4YVwTrbWWHR01xset3KFGkkY5RyU7Fm'
       OR status <> 1);

-- 3) 门店角色演示账号：口令轮换为不公开强口令 + 清掉被爆破留下的失败计数/锁定
UPDATE t_sys_user
SET password_hash = CASE username
      WHEN 'store_manager'  THEN 'v2$$2b$12$DTeP0h4Cyx7rcEiN.xJTz.N0joBOwbGUYkAyVJX8QHXbC/L.BA8cm'
      WHEN 'store_operator' THEN 'v2$$2b$12$B7OJyHZo.RIyBf11xcybgufSj/cGRpxZGg3WZXdI7J2IkrA8SShlq'
      ELSE password_hash END,
    login_fail_count = 0,
    locked_until = NULL,
    updated_at = NOW()
WHERE username IN ('store_manager', 'store_operator')
  AND tenant_id = 'default'
  AND ((username = 'store_manager'
        AND password_hash <> 'v2$$2b$12$DTeP0h4Cyx7rcEiN.xJTz.N0joBOwbGUYkAyVJX8QHXbC/L.BA8cm')
       OR (username = 'store_operator'
        AND password_hash <> 'v2$$2b$12$B7OJyHZo.RIyBf11xcybgufSj/cGRpxZGg3WZXdI7J2IkrA8SShlq')
       OR login_fail_count <> 0
       OR locked_until IS NOT NULL);

-- 4) demo 账号停用 + 口令轮换为随机值（保留行与绑定，只停用；不删号）
UPDATE t_sys_user
SET password_hash = 'v2$$2b$12$uqawxSVS3p.52cEABMQHNePTmEymW5bS/18JjrUe0SBqkvcbWFNZ2',
    status = 0,
    login_fail_count = 0,
    locked_until = NULL,
    updated_at = NOW()
WHERE username = 'demo'
  AND tenant_id = 'demo'
  AND (status <> 0
       OR password_hash <> 'v2$$2b$12$uqawxSVS3p.52cEABMQHNePTmEymW5bS/18JjrUe0SBqkvcbWFNZ2');

-- 5) 验证 SQL（执行后核对；status/hash 前缀与锁定字段）
SELECT 't_sys_user' AS src, username, tenant_id, status, LEFT(password_hash, 8) AS hash_prefix,
       login_fail_count, locked_until
FROM t_sys_user
WHERE (username = 'admin' AND tenant_id = 'default')
   OR (username IN ('store_manager', 'store_operator') AND tenant_id = 'default')
   OR (username = 'demo' AND tenant_id = 'demo')
UNION ALL
SELECT 't_platform_admin' AS src, username, '' AS tenant_id, status, LEFT(password_hash, 8) AS hash_prefix,
       NULL AS login_fail_count, NULL AS locked_until
FROM t_platform_admin
WHERE username = 'admin';
