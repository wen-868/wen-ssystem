SET @s3199_fk169 = (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't_tenant_admin' AND CONSTRAINT_NAME = 't_tenant_admin_ibfk_1');
SET @s3199_ddl169 = IF(@s3199_fk169 > 0, 'ALTER TABLE t_tenant_admin DROP FOREIGN KEY t_tenant_admin_ibfk_1', 'SELECT ''S3-199-169：本库已无该外键，DROP 整句跳过（幂等）'' AS s3199_step');
PREPARE s3199_stmt169 FROM @s3199_ddl169;
EXECUTE s3199_stmt169;
DEALLOCATE PREPARE s3199_stmt169;
ALTER TABLE t_tenant_admin MODIFY COLUMN `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID（UUID，对齐 t_tenant.id）';
ALTER TABLE t_tenant_admin MODIFY COLUMN `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID（关联 t_sys_user.id）';
SELECT COUNT(*) AS c169_tenant_admin_fk_left FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't_tenant_admin' AND CONSTRAINT_NAME = 't_tenant_admin_ibfk_1';
-- 编号: 169, 描述: 修正 t_tenant_admin 租户/用户 ID 列类型。
-- 该表 tenant_id 原为 int 且外键指向不存在的 tenant 表，user_id 原为 int；
-- 而审核流程(tenant-register.service approveTenantApplication)写入的租户 ID 是
-- randomUUID() 字符串、用户 ID 是 t_sys_user 的 int unsigned 自增值。
-- 生产实证：审核事务在此表 INSERT 时类型不匹配，叠加 t_tenant 缺 name 列、
-- t_tenant.status 传 'ACTIVE' 字符串三个 bug，导致平台总台"审核通过"自上线
-- 以来全部 500 失败（8 条注册申请全部滞留 PENDING 的根因）。
-- 表当前为空(0 行)，无数据迁移风险。DROP FOREIGN KEY 重复执行报 1091 由
-- safeExec 记录跳过，不阻断启动；MODIFY 为幂等操作。
-- 创建人: 凌舟, 日期: 2026-09-08
--
-- ============================================
-- 补记（S3-199 · 收口总清单第 64 项，2026-10-14）——为什么本迁移只 DROP、不重建外键
--   本条 DROP 是「清掉坏外键」与「改列类型」的必要前置，不代表取消本表的引用保护：
--   ① 被删的 t_tenant_admin_ibfk_1 指向**不存在的表**（016/034 原文 `REFERENCES tenant(id)` 缺 t_ 前缀，
--      runner 的 addTablePrefix 只对可识别表名补前缀），属历史残留约束 —— 不先 DROP 就无法
--      MODIFY tenant_id 的类型（列上挂外键时不能改型）。
--   ② 「不重建」是**已裁定口径**：`docs/tasks/cards/R101-S3-158-凌舟验收.md` 裁定 2（2026-10-06）——
--      t_tenant_admin 取 VARCHAR(36)、**不建物理外键**，理由＝生产存量即「无外键」形状（与生产一致优先）、
--      避免出现第三份口径、本仓多处已刻意不用物理外键（分库与迁移负担）。
--      `192_租户建租户与归因落点补列.sql:35` 与 `:110` 复述并落地同一口径。
--   ③ 故本表 tenant_id 无 DB 级引用保护属**有意为之**（S3-199 定性结论，非漏配），完整性由应用层保证：
--      唯一键 uk_tenant_user + 唯一写入口 `backend/src/services/tenant-register.service.ts:308`
--      （同事务内先建 t_tenant 再写本表）。
--   ④ 将来若需 DB 级保护、或引入租户物理删除：**必须另立单并先取得裁定**（新增外键会改变生产既有形状，
--      ON DELETE 级联语义也须一并定死）。本文件本次不做任何语句变更。
-- ============================================
--
-- ============================================
-- 修订记录（S3-199 · 2026-10-14 · 阿坚/后端）
--   何时：2026-10-14   何人：阿坚   为什么/依据：收口总清单第 64 项 + `R101-S3-158-凌舟验收.md` 裁定 1
--   改了什么：第 1 条语句 `ALTER TABLE t_tenant_admin DROP FOREIGN KEY t_tenant_admin_ibfk_1` 原为**无守卫**
--     （表上无该外键时报 ER_CANT_DROP_FIELD_OR_KEY 1091，safeExec 不认 1091 ⇒ 记 **失败**），
--     现改为 `information_schema.REFERENTIAL_CONSTRAINTS` 守卫 + `PREPARE/EXECUTE`（先例 081 / 194 / 196）：
--     外键在 ⇒ 照旧 DROP；外键不在（生产存量即此形态、以及本库第二遍起）⇒ 整句跳过（改执行一条 SELECT 占位），
--     **不再产生任何报错行**（runner 只对失败/跳过记日志，SELECT 不写日志 ⇒ 判据是"失败行数 0"）。
--     另在两条 MODIFY 之后追加一条跑后核对 SELECT（给出去向外键残留计数）。
--   为什么必须改（实测证据）：同一库第二遍跑迁移 ⇒ `[migration] 169_tenant_admin_uuid.sql 失败: Can't DROP
--     't_tenant_admin_ibfk_1'`（MySQL 报 1091，原文其后接英文提示 check that column/key exists）
--     —— 见 `docs/evidence/S3-199/**` runB 原始日志。
--     生产自 2026-09-08 起本表就没有该外键 ⇒ **每次重启都恒报一条失败**，属 [78] 型「恒红掩蔽真错误」。
--   语义与结果：DROP 的**结果态不变**（该外键在两种情况下都不存在），列类型口径不变；本修订不新增/不改约束。
--   两路验证（S3-158 裁定 1 条件④）：全新空库第一遍 + 同库第二遍，均见 `docs/evidence/S3-199/**`。
--   回退：把上述 5 条守卫语句换回 1 条无守卫 DROP 即可（回退即恢复"第二遍恒红"）。
-- ============================================
