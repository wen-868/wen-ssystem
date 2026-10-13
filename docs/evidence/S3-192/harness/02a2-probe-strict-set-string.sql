-- S3-192 探针 P1(a2)：**只跑卡面语句的 SET 部分**（写字符串状态，WHERE 只用主键）在 TINYINT 列上的行为
--   期望：ERROR 1366（Incorrect integer value: 'EXPIRED'）⇒ 写侧同样不成立
--   （同一缺陷 S3-150 已在真库复现 1366，见 docs/tasks/cards/R101-S3-150-阿坚回传.md 反测①）
USE s3192_num;
UPDATE t_tenant SET status = 'EXPIRED', suspend_reason = '订阅已到期', suspended_at = NOW()
 WHERE id = 'num-active';
SELECT id, CAST(status AS CHAR) AS status_raw, suspend_reason FROM t_tenant WHERE id = 'num-active';
