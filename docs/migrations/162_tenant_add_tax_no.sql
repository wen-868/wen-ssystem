ALTER TABLE t_tenant ADD COLUMN tax_no VARCHAR(64) DEFAULT NULL COMMENT '纳税人识别号（税号）';

-- 编号: 162, 描述: 租户表增加税号列（企业信息维护 taxNo 字段落地所需）
-- 创建人: 阿澈, 日期: 2026-09-04
-- 说明: 前端 TenantInfo.taxNo 与后端 sys-config.service.ts 的 SELECT tax_no AS taxNo 已就绪，但生产库 t_tenant 缺该列，
--       导致企业信息页"税号"恒为 null。本迁移增量补列，列已存在时按 ER_DUP_FIELDNAME 静默跳过，重复执行无副作用。
