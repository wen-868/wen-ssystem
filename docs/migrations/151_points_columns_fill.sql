ALTER TABLE t_points_record ADD COLUMN member_id BIGINT UNSIGNED DEFAULT NULL COMMENT '会员ID(小程序会员积分明细)' AFTER id;
ALTER TABLE t_points_record ADD COLUMN change_points INT DEFAULT NULL COMMENT '变动积分(正=获得,负=消耗,小程序设计)' AFTER type;
ALTER TABLE t_points_record ADD COLUMN balance_points INT DEFAULT NULL COMMENT '变动后余额(小程序设计)' AFTER change_points;
ALTER TABLE t_points_record ADD COLUMN user_id BIGINT UNSIGNED DEFAULT NULL COMMENT '用户ID(营销积分明细)' AFTER id;
ALTER TABLE t_points_record ADD COLUMN amount INT DEFAULT NULL COMMENT '积分变动数(营销积分设计)' AFTER type;
ALTER TABLE t_points_record ADD COLUMN balance INT DEFAULT NULL COMMENT '变动后余额(营销积分设计)' AFTER amount;
ALTER TABLE t_points_record ADD COLUMN source_id VARCHAR(64) DEFAULT NULL COMMENT '来源ID(小程序/营销积分设计)' AFTER source_type;
ALTER TABLE t_points_record ADD INDEX idx_points_record_user (user_id);
ALTER TABLE t_points_record ADD INDEX idx_points_record_member (member_id);

ALTER TABLE t_points_rule ADD COLUMN earn_ratio DECIMAL(6,4) DEFAULT 0 COMMENT '消费积分比例(营销积分设计)' AFTER earn_rate;
ALTER TABLE t_points_rule ADD COLUMN redeem_ratio DECIMAL(6,4) DEFAULT 100 COMMENT '积分兑换比例(1积分可抵金额,营销积分设计)' AFTER earn_ratio;
ALTER TABLE t_points_rule ADD COLUMN min_redeem_amount DECIMAL(10,2) DEFAULT 0 COMMENT '最低兑换金额(营销积分设计)' AFTER redeem_ratio;
ALTER TABLE t_points_rule ADD COLUMN max_redeem_ratio DECIMAL(6,4) DEFAULT 0.5 COMMENT '最高抵扣比例(营销积分设计)' AFTER min_redeem_amount;
ALTER TABLE t_points_rule ADD COLUMN expire_days INT NOT NULL DEFAULT 365 COMMENT '积分有效天数(营销积分设计)' AFTER max_redeem_ratio;

-- 编号: 151, 描述: 积分表补列——t_points_record 兼容三套服务引用(071客户积分/108小程序会员积分/旧营销积分), t_points_rule 补营销积分规则列
-- 创建人: Codex, 日期: 2026-08-15
-- 背景: 服务端存在三套 t_points_record 列引用(071 customer_id/points/balance_after/source_no; 108 member_id/change_points/balance_points/source_id; 旧营销积分 user_id/amount/balance/source_id), 迁移 CREATE IF NOT EXISTS 只会按首次定义建表, 其余服务的 SQL 在真实库必然报未知列 500。本迁移幂等补齐缺失列与索引, 三套引用全部可用。
-- 注意: 文件头不写注释(自动迁移按分号拆分,注释污染首条语句被丢弃),说明放文件末尾。
-- 幂等: migration.ts safeExec 对 ER_DUP_FIELDNAME/ER_DUP_KEYNAME 做模式匹配跳过,可重复执行。
