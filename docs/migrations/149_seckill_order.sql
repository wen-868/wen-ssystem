ALTER TABLE t_seckill_product ADD COLUMN seckill_stock INT NOT NULL DEFAULT 0 COMMENT '秒杀总库存(与 total_stock 同义, admin 秒杀管理写入)' AFTER seckill_price;
ALTER TABLE t_seckill_product ADD COLUMN start_time DATETIME DEFAULT NULL COMMENT '秒杀开始时间' AFTER limit_per_user;
ALTER TABLE t_seckill_product ADD COLUMN end_time DATETIME DEFAULT NULL COMMENT '秒杀结束时间' AFTER start_time;
ALTER TABLE t_seckill_product ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/ACTIVE/PAUSED/ENDED' AFTER end_time;
ALTER TABLE t_seckill_product ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT '' COMMENT '租户ID' AFTER status;

CREATE TABLE IF NOT EXISTS t_seckill_order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '秒杀订单ID',
  order_no VARCHAR(32) NOT NULL COMMENT '秒杀订单号(前缀MK+日期8位+5位随机)',
  activity_id INT NOT NULL COMMENT '秒杀活动ID(t_seckill_product.id)',
  product_id INT NOT NULL COMMENT '商品ID',
  member_id INT NOT NULL COMMENT '下单用户ID(会员ID)',
  member_name VARCHAR(64) DEFAULT NULL COMMENT '用户姓名快照',
  member_mobile VARCHAR(20) DEFAULT NULL COMMENT '用户手机号快照',
  quantity INT NOT NULL DEFAULT 1 COMMENT '购买数量',
  seckill_price DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '秒杀单价快照',
  original_price DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '原价快照',
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '订单金额',
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING_PAY' COMMENT '状态: PENDING_PAY/PAID/CANCELLED/EXPIRED',
  paid_at DATETIME DEFAULT NULL COMMENT '支付时间',
  cancelled_at DATETIME DEFAULT NULL COMMENT '取消时间',
  cancel_reason VARCHAR(255) DEFAULT NULL COMMENT '取消原因',
  tenant_id VARCHAR(36) NOT NULL DEFAULT '' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_seckill_order_no (order_no),
  KEY idx_seckill_order_activity (activity_id),
  KEY idx_seckill_order_member (member_id),
  KEY idx_seckill_order_status (status),
  KEY idx_seckill_order_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='秒杀订单表(社区营销秒杀参与记录)';

-- 编号: 149, 描述: 秒杀表结构修复 + 秒杀订单表(R100-01 遗留：buySeckill 仅扣库存未落库,参与记录无数据源)
-- 创建人: 凌舟, 日期: 2026-08-15
-- 注意: 文件头不写注释(自动迁移按分号拆分,注释污染首条语句被丢弃),说明放文件末尾。
-- 幂等: migration.ts safeExec 对 "Duplicate column name" 错误做模式匹配跳过,可重复执行。
-- 背景: 036/039 建表仅含 activity_id/total_stock/available_stock, 而 seckill.service.ts(admin) 写入
--       seckill_stock/start_time/end_time/status, community-marketing.service.ts 查询又依赖 status/
--       start_time/end_time/tenant_id 等列——表结构与代码漂移,真实库秒杀列表/下单会报列不存在。
--       本迁移幂等补列 + 建 t_seckill_order, 使 admin 秒杀管理与社区营销秒杀共用同一张表并落库参与记录。
