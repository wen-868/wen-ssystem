SET @s3158_added = 0;

SET @s3158_col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_platform_admin' AND COLUMN_NAME = 'mfa_secret');
SET @s3158_sql = IF(@s3158_col = 0,
  'ALTER TABLE t_platform_admin ADD COLUMN mfa_secret VARCHAR(128) DEFAULT NULL COMMENT ''TOTP 双因素认证 Secret(Base32)'' AFTER password_hash',
  'SELECT ''mfa_secret 已存在，跳过'' AS result');
PREPARE s3158_stmt FROM @s3158_sql;
EXECUTE s3158_stmt;
DEALLOCATE PREPARE s3158_stmt;
SET @s3158_added = @s3158_added + IF(@s3158_col = 0, 1, 0);

SET @s3158_col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_platform_admin' AND COLUMN_NAME = 'mfa_enabled');
SET @s3158_sql = IF(@s3158_col = 0,
  'ALTER TABLE t_platform_admin ADD COLUMN mfa_enabled TINYINT NOT NULL DEFAULT 0 COMMENT ''双因素认证是否启用：1启用 0未启用'' AFTER mfa_secret',
  'SELECT ''mfa_enabled 已存在，跳过'' AS result');
PREPARE s3158_stmt FROM @s3158_sql;
EXECUTE s3158_stmt;
DEALLOCATE PREPARE s3158_stmt;
SET @s3158_added = @s3158_added + IF(@s3158_col = 0, 1, 0);

SELECT CONCAT('196 t_platform_admin MFA：本次新增 ', @s3158_added, ' 列，当前 ',
  (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_platform_admin'
       AND COLUMN_NAME IN ('mfa_secret', 'mfa_enabled')), ' / 2 列',
  IF(@s3158_added = 0, '（列已存在，跳过）', '')) AS result;

-- ============================================
-- 迁移编号：196
-- 单号：S3-58-F1-F1（被修单 S3-58-F1）
-- 描述：t_platform_admin 补 MFA 两列 —— mfa_secret VARCHAR(128) NULL ＋ mfa_enabled TINYINT NOT NULL DEFAULT 0
-- 创建人：阿坚（后端）
-- 日期：2026-10-07
-- 依据：docs/tasks/cards/R101-派单-20261007-S3-58-F1-F1.md 二① ＋ docs/tasks/cards/R101-S3-58-F1-凌舟验收-判红.md 五、修复要求 1
--
-- 一、为什么必须补这两列（真缺陷，不是预防性改动）
--   S3-58-F1 R3 的平台端 MFA 直接读写 t_platform_admin.mfa_enabled / mfa_secret，
--   但生产 SHOW COLUMNS 证明这两列**根本不存在**（判红卡 §二 三步只读反例），
--   且 docs/migrations 下当时只有 150_mfa.sql，而它只给 t_sys_user 加列。
--   ⇒ 部署后 platform-auth.service.login 的 SELECT 立刻报 ERROR 1054 (42S22)，
--     平台控制台（saas.onepan.cn）全员登录 500。本迁移把列补上，是修复的一半。
--   另一半是缺列防御（platform-auth.service.ts / platform-mfa.service.ts），
--   因为部署顺序不可控 —— 迁移未跑时登录也不得 500。
--
-- 二、为什么幂等（可重复执行，第二遍零错误码）
--   information_schema.COLUMNS 逐列存在性判断 ⇒ 列不存在才 ALTER，
--   已存在则走「已存在，跳过」分支（照 081_platform_admin_seed_and_fix.sql 的 PREPARE/EXECUTE 写法）。
--   本文件有两条执行路径，都会跑它，故幂等不是可选项：
--     1) 部署流水线 deploy/auto-deploy.sh 的 run-migration.mjs（本单已接入）
--     2) 后端启动 backend/src/shared/migration.ts 第 8 步（遍历 docs/migrations/*.sql 逐条执行）
--   注：第 2 条会把语句再过一遍 addTablePrefix，本文件的表名均已带 t_ 前缀，information_schema 也不被改写。
--
-- 三、列定义口径（与租户端 150_mfa.sql 对齐，字段名与类型一致，避免两端语义分叉）
--   mfa_secret  VARCHAR(128) NULL          —— 与 t_sys_user.mfa_secret 同型
--   mfa_enabled TINYINT NOT NULL DEFAULT 0 —— 与 t_sys_user.mfa_enabled 同型
--   列顺序 mfa_secret → mfa_enabled，对齐 150_mfa.sql 的 AFTER 链。
--   零 DML：本文件只有 SET / PREPARE / EXECUTE / DEALLOCATE / SELECT，无任何数据写语句，
--   在 MIG-4 写闸门 block 下也能整篇执行。
--
-- 四、回滚（mfa_secret 清空后不可恢复，回滚前务必确认无人使用平台端 MFA）
--   逐条执行下面两条（行尾请自行补 SQL 语句终止符）：
--     ALTER TABLE t_platform_admin DROP COLUMN mfa_enabled
--     ALTER TABLE t_platform_admin DROP COLUMN mfa_secret
--   回滚前先跑 SELECT COUNT(*) FROM t_platform_admin WHERE mfa_enabled = 1，
--   非 0 表示已有管理员在用 MFA，回滚会让其无法二次验证（其 mfa_secret 同时丢失）。
--
-- 五、验收（可复跑）
--   连跑两遍 `node scripts/run-migration.mjs docs/migrations/196_平台管理员MFA.sql`，
--   第二遍应输出「本次新增 0 列 …（列已存在，跳过）」且 EXIT=0。
-- ============================================
