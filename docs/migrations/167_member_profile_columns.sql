ALTER TABLE t_member ADD COLUMN `card_no` VARCHAR(32) DEFAULT NULL COMMENT '会员卡号';
ALTER TABLE t_member ADD COLUMN `gender` VARCHAR(8) DEFAULT NULL COMMENT '性别: 男/女/未填写';
ALTER TABLE t_member ADD COLUMN `birthday` DATE DEFAULT NULL COMMENT '生日';
ALTER TABLE t_member ADD COLUMN `province` VARCHAR(32) DEFAULT NULL COMMENT '省份';
ALTER TABLE t_member ADD COLUMN `city` VARCHAR(32) DEFAULT NULL COMMENT '城市';
ALTER TABLE t_member ADD COLUMN `district` VARCHAR(32) DEFAULT NULL COMMENT '区/县';
ALTER TABLE t_member ADD COLUMN `tags` VARCHAR(255) DEFAULT NULL COMMENT '标签,逗号分隔';
-- 编号: 167, 描述: 会员表补字段——原稿客户详情含 卡号/性别/生日/省市区/标签 编辑, 会员表缺列
-- (此前详情页这些行只能标注"后端对接中")。幂等可重复执行(safeExec 对 ER_DUP_FIELDNAME 跳过)。
-- 顶格书写规避启动迁移的注释丢弃 bug。创建人: 凌舟, 日期: 2026-09-06
