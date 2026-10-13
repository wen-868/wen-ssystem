-- ============================================================
-- S3-192 探针 P4/P5：迁移 199 §1 的订正效果、幂等性 与「去掉 WHERE」反测
--   口径说明（重要）：MySQL/MariaDB 的 ROW_COUNT() 计的是**实际变更**行数，不是匹配行数；
--   故幂等性用两个量同时度量：
--     ① 匹配行数（WHERE 直接控制的量）—— 第二遍必须为 0；
--     ② 变更行数（ROW_COUNT()）—— 第二遍必须为 0。
--   反测（去掉 WHERE）改用 `suspended_at = NOW()` 的等价语句：否则第二遍 SET 值与现值相同、
--   ROW_COUNT() 恒为 0，会掩盖"每次都在全表重写"这一事实。
-- ============================================================

-- ── P4a：字符串形态库（016/029 声明的形态）——本迁移在这里才真正有对象
USE s3192_str;
SELECT 'P4a 订正前：越界状态值行数（期望 2）' AS probe, COUNT(*) AS cnt
FROM t_tenant WHERE CAST(status AS CHAR) NOT IN ('0', '1', 'ACTIVE', 'DISABLED');
SELECT 'P4a 订正前：status 分布' AS probe, status, COUNT(*) AS cnt FROM t_tenant GROUP BY status;

UPDATE t_tenant
SET status = 0,
    suspend_reason = COALESCE(suspend_reason, '状态值域收敛订正（原状态值越界）'),
    suspended_at = COALESCE(suspended_at, NOW())
WHERE CAST(status AS CHAR) NOT IN ('0', '1', 'ACTIVE', 'DISABLED');
SELECT 'P4a 第一遍 变更行数' AS probe, ROW_COUNT() AS changed_rows;
SELECT 'P4a 订正后：越界状态值行数（期望 0）' AS probe, COUNT(*) AS cnt
FROM t_tenant WHERE CAST(status AS CHAR) NOT IN ('0', '1', 'ACTIVE', 'DISABLED');
SELECT 'P4a 订正后：status 分布' AS probe, status, COUNT(*) AS cnt FROM t_tenant GROUP BY status;
SELECT 'P4a 第二遍执行前：匹配行数（期望 0 = WHERE 守卫，幂等的前提）' AS probe, COUNT(*) AS matched_rows
FROM t_tenant WHERE CAST(status AS CHAR) NOT IN ('0', '1', 'ACTIVE', 'DISABLED');

UPDATE t_tenant
SET status = 0,
    suspend_reason = COALESCE(suspend_reason, '状态值域收敛订正（原状态值越界）'),
    suspended_at = COALESCE(suspended_at, NOW())
WHERE CAST(status AS CHAR) NOT IN ('0', '1', 'ACTIVE', 'DISABLED');
SELECT 'P4a 第二遍 变更行数（期望 0 = 幂等）' AS probe, ROW_COUNT() AS changed_rows;

-- ── P4b：数值形态库（当前生产形态）——本迁移是 no-op
USE s3192_num;
SELECT 'P4b 匹配行数（期望 0：数值列上不存在越界字符串值）' AS probe, COUNT(*) AS matched_rows
FROM t_tenant WHERE CAST(status AS CHAR) NOT IN ('0', '1', 'ACTIVE', 'DISABLED');
UPDATE t_tenant
SET status = 0,
    suspend_reason = COALESCE(suspend_reason, '状态值域收敛订正（原状态值越界）'),
    suspended_at = COALESCE(suspended_at, NOW())
WHERE CAST(status AS CHAR) NOT IN ('0', '1', 'ACTIVE', 'DISABLED');
SELECT 'P4b 第一遍 变更行数（期望 0）' AS probe, ROW_COUNT() AS changed_rows;
UPDATE t_tenant
SET status = 0,
    suspend_reason = COALESCE(suspend_reason, '状态值域收敛订正（原状态值越界）'),
    suspended_at = COALESCE(suspended_at, NOW())
WHERE CAST(status AS CHAR) NOT IN ('0', '1', 'ACTIVE', 'DISABLED');
SELECT 'P4b 第二遍 变更行数（期望 0）' AS probe, ROW_COUNT() AS changed_rows;
SELECT 'P4b 数值库行为未被改坏（num-active 仍 = 0 且有原因；num-disabled 仍 = 0）' AS probe;
SELECT id, CAST(status AS CHAR) AS status_raw, suspend_reason FROM t_tenant ORDER BY id;

-- ── P5 反测：独立探针库，去掉 §1 的 WHERE 守卫
DROP DATABASE IF EXISTS s3192_anti;
CREATE DATABASE s3192_anti DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE TABLE s3192_anti.t_tenant (
  id VARCHAR(36) PRIMARY KEY,
  company_name VARCHAR(128) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  suspend_reason VARCHAR(255) NULL,
  suspended_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO s3192_anti.t_tenant (id, company_name, status) VALUES
  ('a', '探针·ACTIVE', 'ACTIVE'),
  ('b', '探针·EXPIRED', 'EXPIRED'),
  ('c', '探针·SUSPENDED', 'SUSPENDED'),
  ('d', '探针·DISABLED', 'DISABLED');

UPDATE s3192_anti.t_tenant
SET status = 0, suspend_reason = COALESCE(suspend_reason, '反测：去掉 WHERE'), suspended_at = NOW();
SELECT 'P5 反测 第一遍 变更行数（期望 4 = 全表）' AS probe, ROW_COUNT() AS changed_rows;
SELECT 'P5 反测：去掉 WHERE 时每次执行都会匹配全表（matched_rows = 4，与上一遍无关）' AS probe,
       COUNT(*) AS matched_rows FROM s3192_anti.t_tenant;
-- 等 1.2 秒：NOW() 是秒级精度，不等的话第二遍的 SET 值与现值相同，ROW_COUNT() 会假性为 0
SELECT SLEEP(1.2) AS s3192_sleep_done;
UPDATE s3192_anti.t_tenant
SET status = 0, suspend_reason = COALESCE(suspend_reason, '反测：去掉 WHERE'), suspended_at = NOW();
SELECT 'P5 反测 第二遍 变更行数（期望 > 0 ⇒ 每次全表重写 = 不幂等 = 红）' AS probe, ROW_COUNT() AS changed_rows;

-- 复原：把正式式样（带 WHERE 守卫）放回去 ⇒ 第二遍必为 0（绿）
UPDATE s3192_anti.t_tenant
SET status = 0,
    suspend_reason = COALESCE(suspend_reason, '状态值域收敛订正（原状态值越界）'),
    suspended_at = COALESCE(suspended_at, NOW())
WHERE CAST(status AS CHAR) NOT IN ('0', '1', 'ACTIVE', 'DISABLED');
SELECT 'P5 复原后 匹配行数（期望 0）' AS probe, COUNT(*) AS matched_rows
FROM s3192_anti.t_tenant WHERE CAST(status AS CHAR) NOT IN ('0', '1', 'ACTIVE', 'DISABLED');
UPDATE s3192_anti.t_tenant
SET status = 0,
    suspend_reason = COALESCE(suspend_reason, '状态值域收敛订正（原状态值越界）'),
    suspended_at = COALESCE(suspended_at, NOW())
WHERE CAST(status AS CHAR) NOT IN ('0', '1', 'ACTIVE', 'DISABLED');
SELECT 'P5 复原后 变更行数（期望 0 = 绿）' AS probe, ROW_COUNT() AS changed_rows;
