-- S3-196 · 端到端夹具（只作用于本单自建 scratch 库 s3196_e2e / s3196_e2e_base；生产库零写操作）
-- 口径：消费者身份 = 绑定到该租户的会员（t_member，按 openid 匹配；用户 id 即 t_member.id）

-- 1) 消费者会员：openid 必须与端到端用的微信令牌 payload 一致
DELETE FROM t_member WHERE openid = 'openid-s196';
INSERT INTO t_member (tenant_id, openid, mobile, name, customer_type, settlement_type, status)
VALUES ('default', 'openid-s196', '13900009999', 'S196消费者', 'RETAIL', 'CASH', 1);

-- 2) 可领取的优惠券模板（营销 claim 端点用）
DELETE FROM t_coupon_template WHERE tenant_id = 'default' AND template_code = 'S196CPN';
INSERT INTO t_coupon_template
  (template_code, template_name, coupon_type, coupon_value, min_purchase, per_limit,
   valid_type, valid_start, valid_end, status, tenant_id)
VALUES
  ('S196CPN', 'S196 测试券', 'FIXED', 10.00, 0.00, 1,
   'FIXED', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY), 'ACTIVE', 'default');

-- 3) 会员的站内通知（通知「标记已读」端点用）
DELETE FROM t_notification WHERE tenant_id = 'default' AND title = 'S196 测试通知';
INSERT INTO t_notification (tenant_id, recipient_id, recipient_type, title, content, type, is_read)
SELECT 'default', m.id, 'CONSUMER', 'S196 测试通知', '用于 S3-196 端到端验证', 'SYSTEM', 0
FROM t_member m WHERE m.openid = 'openid-s196' AND m.tenant_id = 'default';

-- 4) 复核读数
SELECT m.id AS member_id, m.tenant_id, m.openid, m.status FROM t_member m WHERE m.openid = 'openid-s196';
SELECT t.id AS template_id, t.status FROM t_coupon_template t WHERE t.template_code = 'S196CPN';
SELECT n.id AS notification_id, n.recipient_id, n.is_read FROM t_notification n WHERE n.title = 'S196 测试通知';
