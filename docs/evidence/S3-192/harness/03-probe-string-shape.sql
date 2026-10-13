-- S3-192 探针 P3（A/B 对照）：同一条修复后语句跑在**字符串列**形态（016/029 声明的 VARCHAR(16)）上的行为
--   期望：能正确命中"当前启用"行（ACTIVE），并把 status 写成可判为 DISABLED 的库值
USE s3192_str;
SELECT 'P3: 执行前' AS probe;
SELECT id, status, suspend_reason FROM t_tenant ORDER BY id;
UPDATE t_tenant
SET status = 0, suspend_reason = '订阅已到期', suspended_at = NOW()
WHERE id = 'str-active' AND CAST(status AS CHAR) IN ('1', 'ACTIVE');
SELECT 'P3: affectedRows' AS probe, ROW_COUNT() AS affected_rows;
SELECT 'P3: 执行后' AS probe;
SELECT id, status, suspend_reason FROM t_tenant ORDER BY id;
