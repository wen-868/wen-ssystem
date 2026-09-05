ALTER TABLE t_transfer_order_item MODIFY COLUMN `transfer_no` VARCHAR(32) DEFAULT NULL COMMENT '调拨编号(094老列,放宽以兼容新明细写法)';
ALTER TABLE t_points_record MODIFY COLUMN `member_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '会员ID(小程序会员积分明细)';
ALTER TABLE t_points_record MODIFY COLUMN `change_points` INT DEFAULT NULL COMMENT '变动积分(正=获得,负=消耗,小程序设计)';
ALTER TABLE t_points_record MODIFY COLUMN `balance_points` INT DEFAULT NULL COMMENT '变动后余额(小程序设计)';
ALTER TABLE t_points_record MODIFY COLUMN `source_type` VARCHAR(32) DEFAULT NULL COMMENT '来源类型';
ALTER TABLE t_points_record MODIFY COLUMN `source_no` VARCHAR(32) DEFAULT NULL COMMENT '来源单号';
ALTER TABLE t_points_record MODIFY COLUMN `user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '用户ID(营销积分明细)';
ALTER TABLE t_points_record MODIFY COLUMN `amount` INT DEFAULT NULL COMMENT '积分变动数(营销积分设计)';
ALTER TABLE t_points_record MODIFY COLUMN `balance` INT DEFAULT NULL COMMENT '变动后余额(营销积分设计)';
-- 编号: 164, 描述: 放宽混型表的老 NOT NULL 列——线上 t_points_record 按 108 表型建表(member_id/change_points/balance_points
-- 等为 NOT NULL 无默认), 071 表型的 INSERT 必然 500; t_transfer_order_item 保留 094 的 transfer_no NOT NULL,
-- 与新明细写法(不带单号)冲突。全部改为可空, 各代服务的 INSERT 均可落库。若列不存在(safeExec ER_BAD_FIELD_ERROR)自动跳过。
-- 每条语句顶格书写规避启动迁移的注释丢弃 bug。创建人: 凌舟, 日期: 2026-09-05
