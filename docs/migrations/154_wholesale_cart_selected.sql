ALTER TABLE t_wholesale_cart ADD COLUMN selected TINYINT NOT NULL DEFAULT 1 COMMENT '选中状态：1选中 0未选中';

-- 编号: 154, 描述: 批发购物车增加选中状态列（小程序端全选/单选结算交互）
-- 创建人: Codex, 日期: 2026-08-15
-- 注意: 文件头不写注释(自动迁移按分号拆分,注释污染首条语句被丢弃),说明放文件末尾。幂等: safeExec 对 ER_DUP_FIELDNAME 做模式匹配跳过。
