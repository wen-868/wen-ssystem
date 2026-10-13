-- S3-192 探针 P1(a1)：**只跑卡面语句的 WHERE 判据**在 TINYINT 列上的行为（严格模式，默认 sql_mode）
--   期望：ERROR 1292（Truncated incorrect DECIMAL value: 'ACTIVE'）⇒ 判据本身就不成立
USE s3192_num;
SELECT id, status FROM t_tenant WHERE status = 'ACTIVE';
