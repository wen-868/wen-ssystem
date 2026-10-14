-- ============================================================
-- S3-195 跨租户真库夹具（真库 = 本机私有 MariaDB 127.0.0.1:3406 的 s3195_full 库；
--   结构由**产品自己的迁移管线**建出，本文件只造探针数据）
-- ⚠️ 全部是**构造的探针数据**（租户 id 带 s3195- 前缀），不是生产读数、不是产品数据。
-- 目的：租户 A 的凭证 + 租户 B 的资源 id ⇒ 必须 404 且 B 的资源零变化（不得被领走/买走/成团）。
-- ============================================================

-- ① 两个租户（t_tenant 的 NOT NULL 列：id / name）
DELETE FROM t_tenant WHERE id IN ('s3195-A', 's3195-B');
INSERT INTO t_tenant (id, name, tenant_code, company_name, contact_person, contact_mobile, status, review_status)
VALUES ('s3195-A', 'S3-195 探针租户 A', 'T-S3195-A', 'S3-195 探针公司 A', '探针A', '13800000001', 1, 'APPROVED');
INSERT INTO t_tenant (id, name, tenant_code, company_name, contact_person, contact_mobile, status, review_status)
VALUES ('s3195-B', 'S3-195 探针租户 B', 'T-S3195-B', 'S3-195 探针公司 B', '探针B', '13800000002', 1, 'APPROVED');

-- ② 优惠券模板：9001 = B 的（跨租户攻击目标）；9002 = A 自己的（阳性对照，证明夹具链路可用）
DELETE FROM t_coupon_template WHERE id IN (9001, 9002);
INSERT INTO t_coupon_template
  (id, tenant_id, template_code, template_name, coupon_type, coupon_value, min_purchase, applicable_scope,
   total_quantity, issued_quantity, used_quantity, per_limit, valid_type, valid_start, valid_end, status)
VALUES
  (9001, 's3195-B', 'S3195-B-9001', 'B 的探针券（跨租户攻击目标）', 'AMOUNT', 10.00, 0.00, 'ALL',
   10, 0, 0, 1, 'FIXED', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY), 'ACTIVE'),
  (9002, 's3195-A', 'S3195-A-9002', 'A 自己的探针券（阳性对照）', 'AMOUNT', 10.00, 0.00, 'ALL',
   10, 0, 0, 1, 'FIXED', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY), 'ACTIVE');

-- ③ 秒杀：9101 = B 的
DELETE FROM t_flash_sale WHERE id = 9101;
INSERT INTO t_flash_sale
  (id, tenant_id, name, product_id, sku_id, flash_price, original_price, quantity, total_stock, sold_count,
   limit_per_user, start_time, end_time, status)
VALUES
  (9101, 's3195-B', 'B 的探针秒杀', 1, 1, 9.90, 19.90, 10, 10, 0, 1,
   DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 1 DAY), 'ACTIVE');

-- ④ 拼团：活动 9102 + 团 9201（团队状态须为 PENDING、expires_at 未到才可加入）
DELETE FROM t_group_buy_team WHERE id = 9201;
DELETE FROM t_group_buy WHERE id = 9102;
INSERT INTO t_group_buy
  (id, tenant_id, name, product_id, sku_id, group_price, original_price, min_group_size, max_group_size,
   target_size, current_size, sold_count, total_stock, start_time, end_time, status)
VALUES
  (9102, 's3195-B', 'B 的探针拼团活动', 1, 1, 19.90, 39.90, 2, 2, 2, 1, 0, 10,
   DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 1 DAY), 'ACTIVE');
INSERT INTO t_group_buy_team
  (id, tenant_id, activity_id, current_size, target_size, max_group_size, group_price, original_price,
   sold_count, total_stock, status, expires_at)
VALUES
  (9201, 's3195-B', 9102, 1, 2, 2, 19.90, 39.90, 0, 10, 'PENDING', DATE_ADD(NOW(), INTERVAL 1 DAY));

-- ⑤ 清掉探针用户的历史券（幂等）
DELETE FROM t_user_coupon WHERE user_id = 9501;

-- ⑥ ⚠️ 夹具侧临时补丁（**只在本探针库上执行，不属产品改动**）：
--    真库实测发现 `t_user_coupon.source` 是 NOT NULL 且无默认值（语料 018_phase10_marketing.sql:54），
--    而 `claimCoupon()` 的 INSERT 未写该列 ⇒ 即便租户匹配，真库上领券也回
--    400「缺少必填参数：source」（error-handler 对 MySQL 1364 的映射）。这是**既有缺陷**（本单不改业务逻辑，
--    已在回执「范围外发现」登记）。为了让**阳性对照**（A 领自己的券）能走到落库这一步、从而证明跨租户 404
--    不是"整条链路都坏了"，在此**仅对探针库**给该列补一个默认值；产品代码/语料一行未改。
ALTER TABLE t_user_coupon MODIFY COLUMN source VARCHAR(32) NOT NULL DEFAULT 'RECEIVE' COMMENT '来源（RECEIVE/SEND/ACTIVITY）';

-- ⑦ ⚠️ 夹具侧第二个补丁（同样**只在本探针库上执行**）：`claimCoupon()` 把
--    `valid_start/valid_end` 以 **ISO-8601 带 T/Z 的字符串**写进 DATETIME 列 ⇒ 真库严格模式下
--    报 1292 ER_TRUNCATED_WRONG_VALUE（真库实测原文见 tenant-isolation-*.log）⇒ 即便租户匹配也是 500。
--    这同样是既有缺陷（已登记「范围外发现」，本单不改业务代码）。为了让**隔离判据**（tenant 过滤）
--    在**写入路径**上可观测（否则写入永远在落库那一步就挂，跨租户与同租户分不出来），
--    在此仅把探针库的两列放宽为字符串列；产品代码/语料一行未改。
ALTER TABLE t_user_coupon MODIFY COLUMN valid_start VARCHAR(40) NOT NULL COMMENT '生效时间（探针库放宽为字符串列，见注释⑦）';
ALTER TABLE t_user_coupon MODIFY COLUMN valid_end VARCHAR(40) NOT NULL COMMENT '失效时间（探针库放宽为字符串列，见注释⑦）';
