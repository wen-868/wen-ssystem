ALTER TABLE t_tenant ADD COLUMN tenant_code VARCHAR(32) NULL COMMENT '租户编码（唯一，应用层生成；NULL=历史行未填写）';
ALTER TABLE t_tenant ADD UNIQUE KEY uk_tenant_code (tenant_code);
ALTER TABLE t_tenant ADD COLUMN company_name VARCHAR(128) NULL COMMENT '公司名称（016 定义为 NOT NULL；全新库因建表被跳过而缺列，本迁移补齐）';
ALTER TABLE t_tenant ADD COLUMN company_short_name VARCHAR(64) NULL COMMENT '公司简称';
ALTER TABLE t_tenant ADD COLUMN contact_person VARCHAR(64) NULL COMMENT '联系人';
ALTER TABLE t_tenant ADD COLUMN contact_mobile VARCHAR(20) NULL COMMENT '联系电话';
ALTER TABLE t_tenant ADD COLUMN contact_email VARCHAR(128) NULL COMMENT '联系邮箱';
ALTER TABLE t_tenant ADD COLUMN province VARCHAR(64) NULL COMMENT '省份';
ALTER TABLE t_tenant ADD COLUMN city VARCHAR(64) NULL COMMENT '城市';
ALTER TABLE t_tenant ADD COLUMN district VARCHAR(64) NULL COMMENT '区县';
ALTER TABLE t_tenant ADD COLUMN address VARCHAR(255) NULL COMMENT '详细地址';
ALTER TABLE t_tenant ADD COLUMN business_license VARCHAR(128) NULL COMMENT '营业执照号';
ALTER TABLE t_tenant ADD COLUMN legal_person VARCHAR(64) NULL COMMENT '法人代表';
ALTER TABLE t_tenant ADD COLUMN industry VARCHAR(64) NULL COMMENT '所属行业';
ALTER TABLE t_tenant ADD COLUMN company_scale VARCHAR(32) NULL COMMENT '公司规模';
ALTER TABLE t_tenant ADD COLUMN source VARCHAR(32) NULL DEFAULT 'MANUAL' COMMENT '来源（MANUAL/SELF_REGISTER/INVITATION，既有三取值不改）';
ALTER TABLE t_tenant ADD COLUMN suspend_reason VARCHAR(255) NULL COMMENT '停用原因';
ALTER TABLE t_tenant ADD COLUMN suspended_at DATETIME NULL COMMENT '停用时间';
ALTER TABLE t_tenant ADD COLUMN remark VARCHAR(500) NULL COMMENT '备注';
ALTER TABLE t_tenant_register_application ADD COLUMN promo_code VARCHAR(32) NULL COMMENT '注册携带的渠道推广码（NULL=未携带，官网自注册不分配归属）';
ALTER TABLE t_tenant_register_application ADD COLUMN agent_id BIGINT UNSIGNED NULL COMMENT '注册携带的代理商ID（NULL=未携带，逻辑引用 t_agent.id，不建物理外键）';
ALTER TABLE t_tenant_register_application ADD INDEX idx_tra_promo_code (promo_code);
ALTER TABLE t_sys_user ADD COLUMN mobile VARCHAR(20) NULL COMMENT '手机号（与 phone 同义；建租户/审核通过写管理员账号时使用，全新库缺列）';
CREATE TABLE IF NOT EXISTS t_tenant_admin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID（UUID，对齐 t_tenant.id）',
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID（关联 t_sys_user.id）',
  role VARCHAR(32) NOT NULL DEFAULT 'ADMIN' COMMENT '角色（ADMIN/SUPER_ADMIN）',
  is_primary TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否主管理员',
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_user (tenant_id, user_id),
  INDEX idx_tenant_admin_tenant (tenant_id),
  INDEX idx_tenant_admin_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户管理员表（S3-144：对齐 t_tenant.id UUID，不建物理外键）';

SELECT COUNT(*) AS c192_tenant_new_columns FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_tenant'
   AND COLUMN_NAME IN ('tenant_code', 'company_name', 'contact_person', 'source');

SELECT COUNT(*) AS c192_application_new_columns FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_tenant_register_application'
   AND COLUMN_NAME IN ('promo_code', 'agent_id');

SELECT COUNT(*) AS c192_tenant_code_unique_index FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_tenant'
   AND INDEX_NAME = 'uk_tenant_code';

SELECT COUNT(*) AS c192_sys_user_mobile FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_sys_user'
   AND COLUMN_NAME = 'mobile';

SELECT COUNT(*) AS c192_tenant_admin_table FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_tenant_admin';

-- ============================================
-- 迁移编号：192
-- 描述：S3-144 建租户/注册归因落点补列（t_tenant 补 016 缺列 + 注册申请携带邀请码/代理商）
-- 创建人：阿坚（后端）
-- 日期：2026-10-02
-- 依据：docs/evidence/S3-144/派单-S3-144-活动任务卡.md §二 A/B/C、§四（归因口径底线）、
--       凌舟补充 §2（全新库 t_tenant 缺列预判）与 §3（迁移 192 编号唯一，由 B/C/D 组承载）
--
-- 一、为什么要补 t_tenant 的列（P1 真缺陷，凌舟补充 §2 待实测证实）
--   backend/src/shared/migration.ts 第 1 步先 `CREATE TABLE IF NOT EXISTS t_tenant`
--   （只有 id/name/contact_name/contact_phone/plan/status/expire_at/时间列），
--   第 8 步才跑 docs/migrations/*.sql。此时 016/029 的 `CREATE TABLE IF NOT EXISTS t_tenant`
--   因表已存在整条被 safeExec 跳过 ⇒ 016 定义的 tenant_code/company_name/company_short_name/
--   contact_person/contact_mobile/contact_email/province/city/district/address/business_license/
--   legal_person/industry/company_scale/source/suspend_reason/suspended_at/remark 在全新库上**根本不存在**。
--   后果：`platform-tenant.service.createTenant` 与 `tenant-register.service.approveTenantApplication`
--   的 INSERT 都会 `Unknown column` 直接失败（验收③"新环境可复现"在 main 上不成立）。
--   本迁移以最小改动把这批列补齐（只碰 t_tenant 与 t_tenant_register_application 两张表，
--   不动任何与"建租户/归因"无关的表）。
--
-- 二、列可空与约束口径（为什么不是照抄 016 的 NOT NULL）
--   本仓无迁移账本表、每次启动重跑全部迁移，且 MIG-4 写闸门默认 block（后端不改数据行）。
--   现有库/全新库都可能有"历史行"（如内置 default 租户）。若直接 ADD COLUMN ... NOT NULL UNIQUE，
--   多行同时取隐式默认空串会撞唯一键（ER_DUP_ENTRY，被 safeExec 静默跳过）⇒ 列加不上、缺陷仍在。
--   故：tenant_code 先以 NULL 加入、再建唯一索引（MySQL 唯一索引允许多个 NULL），
--   历史行如实保持 NULL=未填写，新行一律由应用层生成非空唯一编码。
--   其余列按"NULL=未填写"加入（应用层写入时必填），source 带 DEFAULT 'MANUAL'（与 016 注释一致）。
--
-- 三、t_tenant_register_application 增列（B 项选甲：邀请码/推广码注册的可用宿主）
--   promo_code VARCHAR(32) NULL 与 agent_id BIGINT UNSIGNED NULL：注册申请阶段随申请落库，
--   审批通过（approveTenantApplication）时解析并写 t_tenant_attribution。
--   边界：两列均 NULL ⇒ 官网自注册，不分配归属（不写归因行），t_tenant.source = SELF_REGISTER；
--   带 promo_code 或 agent_id ⇒ 邀请码注册，写归因行，t_tenant.source = INVITATION。
--   为什么不建物理外键：仓内既有迁移一律"唯一索引 + 应用层保证"，外键在 runner 下曾多次致全新库失败。
--
-- 三点五、t_sys_user.mobile（同为"建租户"链路缺列）
--   建租户两条链路都会写管理员账号的 mobile：
--   platform-tenant.service.createTenant 与 tenant-register.service.approveTenantApplication 都 INSERT
--   t_sys_user (..., mobile, ...)。而 migration.ts 第 0 步建的 t_sys_user 只有 phone、没有 mobile，
--   152 也只补了 department_id/position_id/password/role/is_default ⇒ 全新库上两条建租户链路都会
--   `Unknown column 'mobile'`。按"被写入列同义补齐"口径加 mobile（与既有 phone 同义，NULL=未填写），
--   不新增/改写任何已存在的列。
--
-- 三点六、t_tenant_admin（建租户链路缺表）
--   016/034 里的 t_tenant_admin 定义 tenant_id INT + `FOREIGN KEY (tenant_id) REFERENCES tenant(id)`，
--   而 runner 的 addTablePrefix 会把 REFERENCES tenant(id) 改写成 REFERENCES t_tenant(id)，
--   与 t_tenant.id VARCHAR(36) 类型不符 ⇒ 这条 CREATE TABLE 在全新库上因外键失败被 safeExec 静默跳过，
--   表根本建不出来（169 修的正是这张表，也就无从谈起）。后果：approveTenantApplication 第 4 步
--   `INSERT INTO t_tenant_admin` 必然 ER_NO_SUCH_TABLE。
--   本迁移按 169 的最终口径（tenant_id VARCHAR(36) / user_id BIGINT UNSIGNED / 不建物理外键）补建该表，
--   表已存在（生产/老库）时 CREATE TABLE IF NOT EXISTS 整条跳过，不动既有结构与数据。
--
-- 四、幂等与写闸门
--   本文件只有 ALTER 与 SELECT，无任何数据写语句（INSERT/UPDATE/DELETE），MIG-4 写闸门默认 block 下
--   全部照常执行。重跑时 ADD COLUMN/ADD INDEX 报 ER_DUP_FIELDNAME/ER_DUP_KEYNAME 由 safeExec 跳过，
--   无副作用。可执行语句顶格放在注释块之前，规避踩坑日志 [63] 的"以注释开头的整块语句被丢弃"。
--   注释文字内不出现 ASCII 分号。
