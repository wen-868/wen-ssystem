-- ============================================================
-- S3-192 探针（A 轨 · 前提订正）：卡面字面口径 与 真实 schema 的差异
--   P1(a1)/P1(a2)/P1(a3) 见 02a1 / 02a2 / 02a3（单跑，分别捕获 1292 / 1366 / 宽松路径）
--   本文件跑 P1(b)/P1(c)（宽松 session：展示隐式转换把"越界判据"变成"命中停用行"）+ P2（严格模式）
-- ============================================================
USE s3192_num;
SET SESSION sql_mode = '';

-- P1(b) 卡面判据 `status IN ('EXPIRED','SUSPENDED')` 在 TINYINT 列上命中哪些行？
SELECT 'P1b: status IN (EXPIRED,SUSPENDED) 命中的行' AS probe;
SELECT id, CAST(status AS CHAR) AS status_raw, status AS status_native
FROM t_tenant
WHERE status IN ('EXPIRED', 'SUSPENDED');

-- P1(c) 对照：原 WHERE 判据 `status = 'ACTIVE'` 在 TINYINT 列上命中哪些行？
SELECT 'P1c: status = ACTIVE 命中的行（期望只该有启用行）' AS probe;
SELECT id, CAST(status AS CHAR) AS status_raw, status AS status_native
FROM t_tenant
WHERE status = 'ACTIVE';

-- 回到产品环境的严格模式再跑修复后的语句（P2）
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';

-- P2 修复后的语句（与产品代码同一形态：写库值 0 + 类型无关 WHERE）
SELECT 'P2: 修复后语句执行前' AS probe;
SELECT id, CAST(status AS CHAR) AS status_raw, suspend_reason FROM t_tenant ORDER BY id;
UPDATE t_tenant
SET status = 0, suspend_reason = '订阅已到期', suspended_at = NOW()
WHERE id = 'num-active' AND CAST(status AS CHAR) IN ('1', 'ACTIVE');
SELECT 'P2: 修复后语句 affectedRows' AS probe, ROW_COUNT() AS affected_rows;
SELECT 'P2: 修复后语句执行后' AS probe;
SELECT id, CAST(status AS CHAR) AS status_raw, suspend_reason,
       (suspended_at IS NOT NULL) AS has_suspended_at
FROM t_tenant ORDER BY id;
