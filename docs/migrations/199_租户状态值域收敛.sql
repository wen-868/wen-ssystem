-- ============================================
-- 迁移编号：199
-- 描述：租户状态值域收敛 —— t_tenant.status 的越界状态值订正到唯一可写值域（ACTIVE / DISABLED）
-- 创建人：阿坚
-- 日期：2026-10-14
-- 依据：R101-收口总清单 第 59 项 / 派单 S3-192（登记为"存量数据订正迁移"）
-- ============================================
--
-- 一、与派单卡面字面口径的**前提订正**（必须先看，否则会误以为本文件是空转）
--   卡面写的是：把 status IN ('EXPIRED','SUSPENDED') 的行订正为 DISABLED。
--   实际 schema：`t_tenant.status` 是 **TINYINT（1=启用 / 0=停用）**，不是字符串列：
--     · 权威建表：backend/src/shared/migration.ts:539 与 docs/migrations/092_租户ID.sql:76（均 TINYINT）；
--     · docs/evidence/MIG-1/outputs/02-plan.json:2043 的注记「与 092 迁移及生产一致」；
--     · 收口卡 docs/tasks/cards/R101-C4-0-阿坚清账.md:437（A7）判 `t_tenant.status` 为 TINYINT；
--     · docs/migrations/169_tenant_admin_uuid.sql 的生产注释：写 'ACTIVE' 字符串 ⇒ 500；
--     · S3-150 真库实测写字符串 ⇒ ER_TRUNCATED_WRONG_VALUE_FOR_FIELD(1366)。
--   ⇒ 数值列上**不可能存在** 'EXPIRED'/'SUSPENDED' 这类字符串值；而 `status IN ('EXPIRED','SUSPENDED')`
--     在数值列上会被隐式转换（'EXPIRED'→0、'SUSPENDED'→0），等价于 `status = 0`，命中的是**本来就停用**
--     的行 —— 照字面执行会把所有停用行的 suspend_reason 一并改写，且第二遍仍有变更（不幂等）。
--   故本迁移用「**按字符串比较**」的判据，在两种 schema 下语义一致：
--     · TINYINT 列（当前生产形态）：CAST(status AS CHAR) ∈ {'1','0'} ⇒ 越界判据恒不命中 ⇒ 本迁移是 no-op；
--     · VARCHAR(16) 老库（016/029 的声明形态）：'EXPIRED'/'SUSPENDED'/'CLOSED'/'PENDING' 等才被订正。
--   写侧一律写 **0**（= toTenantStatusValue("DISABLED") 的库值）；在 VARCHAR 形态下落到 '0'，
--   读侧 toTenantStatus('0') / platform/tenant-status-stats.service.ts 的 FROZEN_VALUES 都判 DISABLED。
--
-- 二、本迁移**不做**的事（避免越权改业务语义）
--   · 不把"订阅已到期但仍启用"的租户在这里批量停用："到期停用"是订阅到期作业（subscription-expiry.service.ts）
--     的职责；该作业的写语句此前恒 1366 失败，S3-192 已修正 ⇒ 部署后由作业自愈（本文件 §2 只给只读计数）。
--   · 不动 status 为 NULL 的行（CAST(NULL AS CHAR) 为 NULL，NOT IN 判为 UNKNOWN ⇒ 不命中；口径上
--     NULL 被 toTenantStatus 视为 ACTIVE，属既有约定）。
--
-- 三、执行方式（重要）
--   本文件是**数据订正**（UPDATE）。迁移管线的写闸门（MIG-4）默认 block：
--   未设 MIGRATION_WRITE_GATE=allow 时这两条 UPDATE 会被**跳过**并留日志（fail-safe，非缺陷）。
--   需要真正订正时：MIGRATION_WRITE_GATE=allow 启动一次，或按 §2 的读数确认后手工执行 §1。
--
-- ============================================

-- §1 越界状态值 ⇒ DISABLED（库值 0），幂等：WHERE 守卫保证第二遍匹配 0 行
--     suspend_reason / suspended_at 用 COALESCE 保留原值，不覆盖已有原因
UPDATE t_tenant
SET status = 0,
    suspend_reason = COALESCE(suspend_reason, '状态值域收敛订正（原状态值越界）'),
    suspended_at = COALESCE(suspended_at, NOW())
WHERE CAST(status AS CHAR) NOT IN ('0', '1', 'ACTIVE', 'DISABLED');

-- §2 只读读数（本文件不含写业务数据的语句；执行前后各跑一次人工对照）
--    ① 越界状态值行数：执行前 = N（VARCHAR 老库）/ 0（TINYINT 库），执行后必须 = 0
SELECT '越界状态值行数（前后对照，期望 0）' AS item,
       COUNT(*) AS cnt
FROM t_tenant
WHERE CAST(status AS CHAR) NOT IN ('0', '1', 'ACTIVE', 'DISABLED');

--    ② status 分布（前后对照，用于确认没有把"启用"行改坏）
SELECT CAST(status AS CHAR) AS status_raw,
       COUNT(*) AS cnt
FROM t_tenant
GROUP BY CAST(status AS CHAR);

--    ③ 只读：到期未停用的租户数（由修复后的到期作业自愈，本迁移不改）
SELECT '订阅已过期但仍启用的租户数（只读，作业自愈）' AS item,
       COUNT(*) AS cnt
FROM t_tenant t
JOIN t_subscription s ON s.tenant_id = t.id
WHERE s.status = 'ACTIVE'
  AND s.end_date < CURDATE()
  AND CAST(t.status AS CHAR) IN ('1', 'ACTIVE');

-- §3 回滚
--   本迁移只把**越界值**行改到 DISABLED；订正后这些行与"本来就停用"的行在库内不可区分
--   ⇒ 无法逐行反向还原（不提供"猜原值"的反向 SQL，以免造假数据）。
--   如需回到旧值域：从执行前的备份恢复，或按 §2 ① 的读数确认为 0 后不再回滚（无遗留）。
