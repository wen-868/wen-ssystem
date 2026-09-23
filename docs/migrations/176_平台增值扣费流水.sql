CREATE TABLE IF NOT EXISTS t_platform_addon_charge (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  charge_no VARCHAR(64) NOT NULL COMMENT '扣费单号（shared/id.makeBizNo）',
  item VARCHAR(32) NOT NULL COMMENT '增值项：STORAGE/API/SMS',
  quantity DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT '超出用量（口径随 item：STORAGE=GB、API=次、SMS=条）',
  unit_price DECIMAL(12,4) DEFAULT NULL COMMENT '单价快照（元/4位小数，来自 billing:addon_price；NULL=单价未配置）',
  amount DECIMAL(12,2) DEFAULT NULL COMMENT '扣费金额（元/2位小数；单价未配置时为 NULL，不出账）',
  period_start DATE DEFAULT NULL COMMENT '计费周期开始',
  period_end DATE DEFAULT NULL COMMENT '计费周期结束',
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/CHARGED/CANCELLED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_addon_charge_no (charge_no),
  KEY idx_addon_tenant (tenant_id),
  KEY idx_addon_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台增值扣费流水';

SELECT COUNT(*) AS platform_addon_charge_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_platform_addon_charge';

-- ============================================
-- 迁移编号：176
-- 描述：平台增值扣费流水表 t_platform_addon_charge（R101-C4-1b 段一 / 包B · 缺口 G04/R04）
-- 创建人：阿坚
-- 日期：2026-09-24
-- 依据：docs/tasks/cards/R101-C4-0-阿坚清账.md §八 草案 A1（凌舟批「只批 1 张新表」）
--       + docs/tasks/cards/R101-派单-20260924-C4-1b.md §二.段一.2
-- 幂等：建表语句自带 IF NOT EXISTS，可重复执行；**不含任何外键约束**（零外键）。
-- 语句位置：可执行语句（建表 + 跑后核对 SELECT）顶格放在注释块之前
--       —— 规避 migration.ts 第 8 步「以注释开头的整块语句被丢弃」缺陷（踩坑日志 [63]）。
--       注意：第 8 步先按 ASCII 分号切块，再丢弃所有以 `--` 开头的块 ⇒ 注释块只能整体放在文件末尾，
--       **且注释文字内不得出现 ASCII 分号**（否则注释会被切成两半，后半段成为「伪语句」被执行管线误执行）。
--       跑后核对 SELECT 是最后一条可执行语句（与已合并的 175_open_platform_api_call_daily.sql 同形）。
-- 边界（硬约束遵守声明）：
--   ① 只新增本表，**不含任何 ALTER 语句**，不改动任何既有表/列；
--   ② 不建同义表：调用量日统计一律复用 C3 既有表 t_open_api_call_daily（175），本表不承载 API 调用量；
--   ③ 不建外键：t_tenant_id / charge_no 的一致性由服务层保证（与生产「零外键」口径一致）。
-- 写入方边界（诚实声明，非本批次实现）：本表**当前无写入方** —— 增值计费引擎（提量统计 + 单价快照 + 出账）
--       未落地（C4-0 清账 §十一 A11：config/api-billing.ts ENABLED=false）⇒ 在读端点接入前，
--       GET /api/platform/billing/addon-charges 在真库如实返回空列表（不造流水）。
-- 回滚（须由人工在真库执行）：删除表 t_platform_addon_charge
--       （执行管线会跳过删表语句，故本文件内**没有**回滚语句；回滚前须备份已产生的流水）。
-- ============================================
