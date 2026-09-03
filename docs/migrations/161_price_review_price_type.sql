ALTER TABLE t_price_review ADD COLUMN price_type VARCHAR(16) NOT NULL DEFAULT 'RETAIL' COMMENT '价格档位：COST成本/RETAIL零售/WHOLESALE批发/MINIAPP小程序/STORE门店';

-- 编号: 161, 描述: 建议核价单表增加价格档位列（核价页支持系统五档价格分别核价）
-- 创建人: 凌舟, 日期: 2026-09-01
-- 说明: 146 号文件建表无该列，此处增量补列；列已存在时迁移按 ER_DUP_FIELDNAME 静默跳过，重复执行无副作用。
