CREATE TABLE IF NOT EXISTS t_referral_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  inviter_tenant_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '邀请人租户ID（逻辑引用 t_tenant.id，类型对齐 varchar(36)，不建物理外键）',
  invitee_tenant_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '被邀请人租户ID（逻辑引用 t_tenant.id，同型对齐，不建物理外键）',
  invitee_tenant_code VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '被邀请人租户编码快照（NULL=未填写，不得用空串冒充未填写）',
  reward_points INT NOT NULL DEFAULT 0 COMMENT '本条奖励积分（按 20% 口径计算，且受年度上限 60000 截断；0=本年度额度已满本条不累计）',
  reward_basis VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '计奖基数口径（如 subscribe_amount＝订阅实收口径；只存口径名，不存金额）',
  status VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING-待发放/GRANTED-已发放/REVOKED-已冲回',
  granted_at DATETIME NULL COMMENT '发放时间（status=GRANTED 时填写；NULL=尚未发放）',
  remark VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '备注（NULL=未填写，不得用空串冒充；年度上限截断原因写在此列）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（同时是年度上限的计年依据）',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_invitee (invitee_tenant_id),
  KEY idx_referral_inviter_created (inviter_tenant_id, created_at),
  KEY idx_referral_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='老带新台账（C6-3-2b：一被邀请租户一条，只记奖励积分口径，无任何金额列）';

SELECT COUNT(*) AS c195_new_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_referral_ledger';

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_referral_ledger'
   AND COLLATION_NAME IS NOT NULL
 ORDER BY COLUMN_NAME;

SELECT INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS index_cols
 FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_referral_ledger'
 GROUP BY INDEX_NAME, NON_UNIQUE
 ORDER BY INDEX_NAME;

SELECT COUNT(*) AS c195_row_count FROM t_referral_ledger;

-- ============================================
-- 迁移编号：195
-- 描述：R101-C6-3-2b 老带新台账（单张新表，纯 DDL 零预置数据）
-- 创建人：阿坚（后端 + saas-admin）
-- 日期：2026-10-02
-- 依据：docs/tasks/cards/R101-派单-20260929-C6-3-2b.md §三（逐列口径 + uk_invitee 硬约束）
--       docs/智享全链_总后台建设规划_v1.3.html 4.9（老带新奖励 20%、积分年度上限 60k）
--       docs/tasks/cards/R101-C6-3-凌舟裁定（待接入剩余 43 处的分批与口径）.md §5.2（归因落点定案）
-- 编号顺延：本单开工时仓内最大编号为 192，2026-10-02 派单修订钉死本单从 195 起
--   （193 = S3-147 租户班次类型，194 = 预留 S3-151 条码唯一键改造）——见回传卡"编号自证"一节。
-- 年度上限口径（卡 §三 二选一，本单选「截断」）：单条 reward_points = min(floor(基数 × 20%),
--   60000 − 该邀请人**同年**status<>'REVOKED' 的 reward_points 合计)。剩余额度为 0 时本条记 0 分，
--   原因写入 remark。⇒ 任何情况下同一邀请人同一自然年的累计都不超过 60000（口径与验证方法见回传卡）。
-- 为什么年度按 created_at 自然年：本表无账期列，台账登记时间即计入时间，口径单一可复算。
-- 一被邀请租户一条（卡 §三 硬约束）：UNIQUE KEY uk_invitee (invitee_tenant_id)。重复登记由服务层先查一次
--   （409 + 明确中文文案），并发撞唯一键（ER_DUP_ENTRY）同样按 409 报，不落 500。
-- 逻辑引用不建物理外键（卡 §三 硬约束）：inviter_tenant_id / invitee_tenant_id 取 varchar(36)，与
--   被引用列 t_tenant.id（029_add_tenant.sql 与 016_phase9_tenant_subscription.sql 均为 VARCHAR(36)）同型。
-- 文本列全部**显式** COLLATE utf8mb4_0900_ai_ci（卡 §三 硬约束），不依赖库默认，表级同样显式声明。
-- 零金额（红线①）：本表不含任何金额列（无 amount、无 commission_rate、无 settle、无 withdraw），
--   reward_basis 只存**口径名**，reward_points 只存积分（1 积分 = 1 元的换算发生在业务域，本表不做）。
-- 语句位置：可执行语句（1 条 CREATE TABLE + 4 条跑后核对 SELECT）顶格放在注释块之前
--   —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」。注释文字内不出现 ASCII 分号。
-- 幂等（精确表述）：本仓无迁移账本表，每次后端启动都会重跑本文件。CREATE TABLE IF NOT EXISTS 重跑时整条被
--   safeExec 跳过（表已存在）⇒ 已建表不重复建。本文件无任何数据写语句、重跑无副作用。
-- 零预置数据（卡内硬口径）：迁移只做结构，不写任何种子行。文件末尾第 4 条跑后核对 SELECT 对本表做 COUNT，
--   恒 0 行是**预期结果**，不是缺陷。
