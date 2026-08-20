ALTER TABLE t_miniapp_order ADD COLUMN deleted_at DATETIME DEFAULT NULL COMMENT '删除时间（软删，列表过滤）';

-- 编号: 156, 描述: 小程序订单软删标记（已取消/已完成订单可删除，列表与详情过滤）
-- 创建人: 系统, 日期: 2026-08-15
-- 注意: 文件头不写注释(自动迁移按分号拆分,注释污染首条语句被丢弃),说明放文件末尾。幂等: safeExec 对 ER_DUP_FIELDNAME 做模式匹配跳过。
