INSERT INTO t_sys_menu (parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status, tenant_id)
SELECT p.id, 'sale:cancel', '取消销售单', 'BUTTON', NULL, NULL, NULL, 3, 1, 1, p.tenant_id
FROM t_sys_menu p
WHERE p.menu_code = 'sale:record'
  AND p.menu_type = 'MENU'
  AND NOT EXISTS (
    SELECT 1 FROM t_sys_menu d WHERE d.tenant_id = p.tenant_id AND d.menu_code = 'sale:cancel'
  );

SELECT CONCAT('203 sale:cancel 权限点：default 租户命中 ', (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id = 'default' AND menu_code = 'sale:cancel'),
  ' 行；全部租户命中 ', (SELECT COUNT(*) FROM t_sys_menu WHERE menu_code = 'sale:cancel'),
  ' 行；已有菜单的租户数 ', (SELECT COUNT(DISTINCT tenant_id) FROM t_sys_menu),
  ' 个') AS result;

-- ============================================
-- 迁移编号：203
-- 单号：S3-209（跨线 P1：销售单取消端点）
-- 描述：登记 **sale:cancel** 权限点（t_sys_menu BUTTON 行，父菜单 = 销售记录 sale:record）
-- 创建人：阿坚（后端）
-- 日期：2026-10-15
--
-- 一、为什么需要这一步（"先立码再接线"）
--   `docs/migrations/079_权限矩阵.sql` 的销售域只登记了 sale:create / sale:void / sale:edit
--   （BUTTON 行 id 210/211/212），**没有** sale:cancel。权限码在本项目里靠 t_sys_menu 行登记，
--   后台角色页的"可选权限点"树就是从这张表读的 ⇒ 不登记等于该码不可授权、也不可发现。
--   本行即派单卡 §二「先立 sale:cancel 码」的落地。
--
-- 二、幂等（可重复执行，第二遍零行变更）
--   判据 (menu_code, tenant_id)，与唯一键 uk_sys_menu_code_tenant 同口径（NOT EXISTS 守卫）。
--   父行按 menu_code = 'sale:record' 逐租户定位 ⇒ default 与各租户克隆行都能各自补上自己的按钮行
--   （菜单是**租户内**行，不跨租户复用 id，见 198 的菜单克隆口径）。
--   父行缺失的租户（未克隆菜单）本语句整条跳过，不插孤儿行、不报错。
--
-- 三、⚠️ 必须用 run-migration.mjs 执行（否则本语句会被静默跳过）
--   本文件是**数据写语句**，后端启动期外部迁移段（backend/src/shared/migration.ts 第 8 步）有
--   MIG-4 写闸门，默认 MIGRATION_WRITE_GATE=block ⇒ INSERT 会被跳过并各打一行日志，只剩末尾 SELECT。
--   正确执行方式（二选一，由凌舟在生产执行）：
--     node scripts/run-migration.mjs docs/migrations/203_销售单取消权限点.sql
--       或   MIGRATION_WRITE_GATE=allow 重启后端
--   执行后核对：default 租户命中 1 行。登记 ≠ 生效 —— 权限判定读的是 t_sys_role.permissions，
--   本行只负责把码**登记并可授权**，角色授权见下一节。
--
-- 四、角色授权：本迁移**故意不做**
--   授权面已满足业务口径，无需改任何角色数据：
--     SUPER_ADMIN  = ["*"]                     ⇒ 命中
--     STORE_MANAGER= ["store:*","sale:*",...]  ⇒ 命中（sale:* 域通配，生产实值已确认）
--     SALES_STAFF  = ["sale:create","sale:view",...] / STORE_OPERATOR ⇒ 不命中（403，符合"店员不能取消单据"）
--   若后续要给某个非通配角色单独发码，用既有权角色接口在生产配置一次
--   （PUT /api/platform/roles/:id/permissions 或后台权限页），不要把授权写进迁移
--   （写闸门会把它静默吞掉，制造"看起来配了实际没配"的假能力）。
--
-- 五、回滚
--   DELETE FROM t_sys_menu WHERE menu_code = 'sale:cancel'
--
-- 六、执行注意（踩坑日志[63]）
--   可执行语句顶格写在注释块**之前**，注释文字内不出现 ASCII 分号 —— 规避"以注释开头的整块语句被 runner 丢弃"。
-- ============================================
