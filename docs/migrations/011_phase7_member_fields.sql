-- 编号: 011, 描述: 客户表扩展字段, 创建人: 阿坚, 日期: 2026-07-06

-- 客户表新增字段：地址、备注
-- 执行时间：2026-06-21

USE liquor_inventory;

ALTER TABLE member
  ADD COLUMN address VARCHAR(255) DEFAULT NULL COMMENT '客户地址' AFTER mobile,
  ADD COLUMN remark VARCHAR(500) DEFAULT NULL COMMENT '备注' AFTER address;

-- 添加索引以便查询
ALTER TABLE member
  ADD KEY idx_member_address (address(50));
