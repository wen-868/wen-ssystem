CREATE TABLE IF NOT EXISTS t_tenant_attribution (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  tenant_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '租户ID（逻辑引用 t_tenant.id，类型对齐 varchar(36)，不建物理外键）',
  promo_code_id BIGINT UNSIGNED NULL COMMENT '推广码ID（逻辑引用 t_promo_code.id，同型对齐，不建物理外键；NULL=非推广码归因）',
  agent_id BIGINT UNSIGNED NULL COMMENT '代理商ID（逻辑引用 t_agent.id，同型对齐，不建物理外键；NULL=非代理商归因）',
  attributed_at DATETIME NOT NULL COMMENT '归因写入时间',
  attribution_type VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '归因类型：AGENT-代理商邀请/PROMO-渠道推广码/REFERRAL-老带新（本单只写 AGENT 与 PROMO，REFERRAL 归 C6-3-2b）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenant_attr (tenant_id),
  KEY idx_attr_promo_code (promo_code_id),
  KEY idx_attr_agent (agent_id),
  KEY idx_attr_type (attribution_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='租户归因明细（C6-3-2a：一租户一条归因，无任何金额列）';

SELECT COUNT(*) AS c189_new_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_tenant_attribution';

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_tenant_attribution'
   AND COLLATION_NAME IS NOT NULL
 ORDER BY COLUMN_NAME;

SELECT COUNT(*) AS c189_row_count FROM t_tenant_attribution;

-- ============================================
-- 迁移编号：189
-- 描述：R101-C6-3-2a 租户归因明细（单张新表，纯 DDL 零预置数据）
-- 创建人：阿坚（后端）
-- 日期：2026-10-01
-- 依据：docs/tasks/cards/R101-派单-20260929-C6-3-2a.md §三②（逐列口径）
--       docs/tasks/cards/R101-C6-3-凌舟裁定（待接入剩余 43 处的分批与口径）.md §5.2 裁定第 2/3 条
--       （归因明细另建关联表，承载"代理商优先于老带新"，未带码/未带代理商的租户不写归因行）
-- 落点（卡 §四，业主 2026-09-27 口径"自注册不需要分配归属"）：平台侧**开租户**与**订阅审核通过**两步，
--   由服务层内部调用 platform-tenant-attribution.service 写入，**不新增任何对外端点**。
-- 一租户一条（卡内硬约束）：UNIQUE KEY uk_tenant_attr (tenant_id)。重复归因由服务层先查一次并在并发下兜住
--   ER_DUP_ENTRY，按 **409 + 明确文案**拒绝（卡 §四允许"409 / 幂等拒绝"二选一，本单选 409，回传卡已写明）。
-- 至少一个非空（卡 §三②）：promo_code_id 与 agent_id 由**服务层校验**至少一个非空；**不在库里加 CHECK 约束**
--   （MySQL 8 的 CHECK 在老版本/兼容模式下表现不一致，仓内既有迁移亦无 CHECK 先例）。
-- t_tenant.source 既有取值（MANUAL/SELF_REGISTER/INVITATION）**一字不改**：本文件不 ALTER t_tenant、不新增
--   t_tenant.source 的取值定义；归因与渠道路径的关系落本表，来源列只由服务层写既有三取值之一。
-- 为什么不建物理外键（卡内硬约束）：同 184/185/186/187/188，仓内一律不建物理外键。tenant_id 取 varchar(36)
--   是与被引用列 t_tenant.id 同型（016_phase9_tenant_subscription.sql:11 / 029_add_tenant.sql:3 均为 VARCHAR(36) ID）。
-- 文本列全部**显式** COLLATE utf8mb4_0900_ai_ci（卡内硬约束），不依赖库默认；表级同样显式声明。
-- 语句位置：可执行语句（1 条 CREATE TABLE + 3 条跑后核对 SELECT）顶格放在注释块之前
--   —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」。注释文字内不出现 ASCII 分号。
-- 幂等（精确表述）：本仓无迁移账本表，每次后端启动都会重跑本文件。CREATE TABLE IF NOT EXISTS 重跑时整条被
--   safeExec 跳过（表已存在）⇒ 已建表不重复建；本文件无任何数据写语句、重跑无副作用。
-- 零预置数据（卡内硬口径 + MIG-4 写闸门默认 block）：迁移只做结构，不写任何种子行（INSERT 命中 0）。
--   文件末尾第 3 条跑后核对 SELECT 对本表做 COUNT，恒 0 行是**预期结果**，不是缺陷。

