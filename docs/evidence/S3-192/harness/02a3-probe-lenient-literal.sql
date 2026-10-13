-- S3-192 探针 P1(a3)：把 session sql_mode 放宽后（模拟"非严格/MySQL 隐式转换"路径）跑**卡面原语句**
--   看点：语句"不报错"时到底改了谁 —— 若命中"已停用"行、而"启用"行纹丝不动，则证明卡面判据语义反了
USE s3192_num;
SET SESSION sql_mode = '';
UPDATE t_tenant SET status = 'EXPIRED', suspend_reason = '订阅已到期', suspended_at = NOW()
 WHERE id = 'num-active' AND status = 'ACTIVE';
SELECT 'P1a3: affectedRows（0 = 目标行没被匹配）' AS probe, ROW_COUNT() AS affected_rows;
SELECT 'P1a3: 全表状态' AS probe;
SELECT id, CAST(status AS CHAR) AS status_raw, suspend_reason FROM t_tenant ORDER BY id;
SELECT 'P1a3: 判据命中谁 —— status IN (EXPIRED,SUSPENDED) 在数值列上等价于 status = 0' AS probe;
SELECT id, CAST(status AS CHAR) AS status_raw FROM t_tenant WHERE status IN ('EXPIRED', 'SUSPENDED');
SELECT 'P1a3: 对照 —— status = ACTIVE 同样只命中 status = 0' AS probe;
SELECT id, CAST(status AS CHAR) AS status_raw FROM t_tenant WHERE status = 'ACTIVE';
