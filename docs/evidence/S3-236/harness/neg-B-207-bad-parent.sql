INSERT INTO t_sys_menu (parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status, tenant_id)
SELECT p.id, c.code, c.name, 'BUTTON', NULL, NULL, NULL, c.sort_no, 1, 1, p.tenant_id
FROM t_sys_menu p
JOIN (
  SELECT 'report:custom:create' AS code, '新建自定义报表' AS name, 1 AS sort_no, 'report' AS parent_code
  UNION ALL SELECT 'report:custom:edit' AS code, '编辑自定义报表' AS name, 2 AS sort_no, 'report' AS parent_code
  UNION ALL SELECT 'report:custom:delete' AS code, '删除自定义报表' AS name, 3 AS sort_no, 'report' AS parent_code
  UNION ALL SELECT 'report:custom:generate' AS code, '生成自定义报表' AS name, 4 AS sort_no, 'report' AS parent_code
  UNION ALL SELECT 'report:schedule:create' AS code, '新建报表定时任务' AS name, 5 AS sort_no, 'report' AS parent_code
  UNION ALL SELECT 'report:schedule:edit' AS code, '编辑报表定时任务' AS name, 6 AS sort_no, 'report' AS parent_code
  UNION ALL SELECT 'report:schedule:delete' AS code, '删除报表定时任务' AS name, 7 AS sort_no, 'report' AS parent_code
  UNION ALL SELECT 'report:schedule:toggle' AS code, '启停报表定时任务' AS name, 8 AS sort_no, 'report' AS parent_code
  UNION ALL SELECT 'report:schedule:run' AS code, '手动执行报表定时任务' AS name, 9 AS sort_no, 'report' AS parent_code
  UNION ALL SELECT 'report:permission:edit' AS code, '维护报表权限' AS name, 10 AS sort_no, 'report' AS parent_code
  UNION ALL SELECT 'report:export' AS code, '导出报表' AS name, 11 AS sort_no, 'report' AS parent_code
  UNION ALL SELECT 'system:print-record:create' AS code, '保存打印记录' AS name, 12 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'system:print-record:reprint' AS code, '重打小票' AS name, 13 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'system:print-template:create' AS code, '新建打印模板' AS name, 14 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'system:print-template:edit' AS code, '编辑打印模板' AS name, 15 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'system:print-template:delete' AS code, '删除打印模板' AS name, 16 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'system:print-template:reset' AS code, '重置打印模板' AS name, 17 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'system:print-template:set-default' AS code, '设为默认打印模板' AS name, 18 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'store:hardware:config-edit' AS code, '编辑硬件配置' AS name, 19 AS sort_no, 'store' AS parent_code
  UNION ALL SELECT 'store:hardware:config-test' AS code, '测试硬件配置' AS name, 20 AS sort_no, 'store' AS parent_code
  UNION ALL SELECT 'store:hardware:announce' AS code, '云喇叭播报' AS name, 21 AS sort_no, 'store' AS parent_code
  UNION ALL SELECT 'store:hardware:box-pay' AS code, '收银盒支付' AS name, 22 AS sort_no, 'store' AS parent_code
  UNION ALL SELECT 'store:hardware:box-config-edit' AS code, '编辑收银盒配置' AS name, 23 AS sort_no, 'store' AS parent_code
  UNION ALL SELECT 'store:hardware:box-config-test' AS code, '测试收银盒配置' AS name, 24 AS sort_no, 'store' AS parent_code
  UNION ALL SELECT 'store:hardware:unionpay-test' AS code, '测试云闪付' AS name, 25 AS sort_no, 'store' AS parent_code
  UNION ALL SELECT 'miniapp:config:edit' AS code, '编辑小程序配置' AS name, 26 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'miniapp:package:upload-key' AS code, '上传小程序密钥' AS name, 27 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'miniapp:package:build' AS code, '构建小程序包' AS name, 28 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'miniapp:package:publish' AS code, '发布小程序' AS name, 29 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'miniapp:order-sync:retry' AS code, '小程序订单同步重试' AS name, 30 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'dashboard:todo:create' AS code, '新建待办' AS name, 31 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'dashboard:todo:complete' AS code, '完成待办' AS name, 32 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'dashboard:todo:dismiss' AS code, '忽略待办' AS name, 33 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'dashboard:todo:delete' AS code, '删除待办' AS name, 34 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'dashboard:quick-entry:create' AS code, '新建快捷入口' AS name, 35 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'dashboard:quick-entry:sort' AS code, '调整快捷入口排序' AS name, 36 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'dashboard:quick-entry:edit' AS code, '编辑快捷入口' AS name, 37 AS sort_no, 'system' AS parent_code
  UNION ALL SELECT 'dashboard:quick-entry:delete' AS code, '删除快捷入口' AS name, 38 AS sort_no, 'system' AS parent_code

) c
WHERE p.menu_code = 'no_such_parent'
  AND p.menu_type = 'CATALOG'
  AND p.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM t_sys_menu d WHERE d.tenant_id = p.tenant_id AND d.menu_code = c.code
  );

SELECT CONCAT('207 立码核对：38 码全租户命中 ', (SELECT COUNT(*) FROM t_sys_menu WHERE menu_code IN ('report:custom:create', 'report:custom:edit', 'report:custom:delete', 'report:custom:generate', 'report:schedule:create', 'report:schedule:edit', 'report:schedule:delete', 'report:schedule:toggle', 'report:schedule:run', 'report:permission:edit', 'report:export', 'system:print-record:create', 'system:print-record:reprint', 'system:print-template:create', 'system:print-template:edit', 'system:print-template:delete', 'system:print-template:reset', 'system:print-template:set-default', 'store:hardware:config-edit', 'store:hardware:config-test', 'store:hardware:announce', 'store:hardware:box-pay', 'store:hardware:box-config-edit', 'store:hardware:box-config-test', 'store:hardware:unionpay-test', 'miniapp:config:edit', 'miniapp:package:upload-key', 'miniapp:package:build', 'miniapp:package:publish', 'miniapp:order-sync:retry', 'dashboard:todo:create', 'dashboard:todo:complete', 'dashboard:todo:dismiss', 'dashboard:todo:delete', 'dashboard:quick-entry:create', 'dashboard:quick-entry:sort', 'dashboard:quick-entry:edit', 'dashboard:quick-entry:delete')),
  ' 行；default 租户命中 ', (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id = 'default' AND menu_code IN ('report:custom:create', 'report:custom:edit', 'report:custom:delete', 'report:custom:generate', 'report:schedule:create', 'report:schedule:edit', 'report:schedule:delete', 'report:schedule:toggle', 'report:schedule:run', 'report:permission:edit', 'report:export', 'system:print-record:create', 'system:print-record:reprint', 'system:print-template:create', 'system:print-template:edit', 'system:print-template:delete', 'system:print-template:reset', 'system:print-template:set-default', 'store:hardware:config-edit', 'store:hardware:config-test', 'store:hardware:announce', 'store:hardware:box-pay', 'store:hardware:box-config-edit', 'store:hardware:box-config-test', 'store:hardware:unionpay-test', 'miniapp:config:edit', 'miniapp:package:upload-key', 'miniapp:package:build', 'miniapp:package:publish', 'miniapp:order-sync:retry', 'dashboard:todo:create', 'dashboard:todo:complete', 'dashboard:todo:dismiss', 'dashboard:todo:delete', 'dashboard:quick-entry:create', 'dashboard:quick-entry:sort', 'dashboard:quick-entry:edit', 'dashboard:quick-entry:delete')),
  ' 行；本批父行缺失的码数 ', (SELECT COUNT(*) FROM (
     SELECT c.code,
            (SELECT COUNT(*) FROM t_sys_menu p
              WHERE p.menu_code = 'no_such_parent' AND p.menu_type = 'CATALOG' AND p.parent_id IS NULL) AS parents,
            (SELECT COUNT(*) FROM t_sys_menu n WHERE n.menu_code = c.code) AS inserted
     FROM (
       SELECT 'report:custom:create' AS code, 'report' AS parent_code
       UNION ALL SELECT 'report:custom:edit' AS code, 'report' AS parent_code
       UNION ALL SELECT 'report:custom:delete' AS code, 'report' AS parent_code
       UNION ALL SELECT 'report:custom:generate' AS code, 'report' AS parent_code
       UNION ALL SELECT 'report:schedule:create' AS code, 'report' AS parent_code
       UNION ALL SELECT 'report:schedule:edit' AS code, 'report' AS parent_code
       UNION ALL SELECT 'report:schedule:delete' AS code, 'report' AS parent_code
       UNION ALL SELECT 'report:schedule:toggle' AS code, 'report' AS parent_code
       UNION ALL SELECT 'report:schedule:run' AS code, 'report' AS parent_code
       UNION ALL SELECT 'report:permission:edit' AS code, 'report' AS parent_code
       UNION ALL SELECT 'report:export' AS code, 'report' AS parent_code
       UNION ALL SELECT 'system:print-record:create' AS code, 'system' AS parent_code
       UNION ALL SELECT 'system:print-record:reprint' AS code, 'system' AS parent_code
       UNION ALL SELECT 'system:print-template:create' AS code, 'system' AS parent_code
       UNION ALL SELECT 'system:print-template:edit' AS code, 'system' AS parent_code
       UNION ALL SELECT 'system:print-template:delete' AS code, 'system' AS parent_code
       UNION ALL SELECT 'system:print-template:reset' AS code, 'system' AS parent_code
       UNION ALL SELECT 'system:print-template:set-default' AS code, 'system' AS parent_code
       UNION ALL SELECT 'store:hardware:config-edit' AS code, 'store' AS parent_code
       UNION ALL SELECT 'store:hardware:config-test' AS code, 'store' AS parent_code
       UNION ALL SELECT 'store:hardware:announce' AS code, 'store' AS parent_code
       UNION ALL SELECT 'store:hardware:box-pay' AS code, 'store' AS parent_code
       UNION ALL SELECT 'store:hardware:box-config-edit' AS code, 'store' AS parent_code
       UNION ALL SELECT 'store:hardware:box-config-test' AS code, 'store' AS parent_code
       UNION ALL SELECT 'store:hardware:unionpay-test' AS code, 'store' AS parent_code
       UNION ALL SELECT 'miniapp:config:edit' AS code, 'system' AS parent_code
       UNION ALL SELECT 'miniapp:package:upload-key' AS code, 'system' AS parent_code
       UNION ALL SELECT 'miniapp:package:build' AS code, 'system' AS parent_code
       UNION ALL SELECT 'miniapp:package:publish' AS code, 'system' AS parent_code
       UNION ALL SELECT 'miniapp:order-sync:retry' AS code, 'system' AS parent_code
       UNION ALL SELECT 'dashboard:todo:create' AS code, 'system' AS parent_code
       UNION ALL SELECT 'dashboard:todo:complete' AS code, 'system' AS parent_code
       UNION ALL SELECT 'dashboard:todo:dismiss' AS code, 'system' AS parent_code
       UNION ALL SELECT 'dashboard:todo:delete' AS code, 'system' AS parent_code
       UNION ALL SELECT 'dashboard:quick-entry:create' AS code, 'system' AS parent_code
       UNION ALL SELECT 'dashboard:quick-entry:sort' AS code, 'system' AS parent_code
       UNION ALL SELECT 'dashboard:quick-entry:edit' AS code, 'system' AS parent_code
       UNION ALL SELECT 'dashboard:quick-entry:delete' AS code, 'system' AS parent_code
     ) c
   ) x WHERE x.parents > 0 AND x.inserted = 0),
  '（父行要求取 079 既有 CATALOG 码：report / system / store）') AS result;

SELECT CONCAT('207 幂等自证：本批码重复行数（应为 0）= ',
  (SELECT COUNT(*) FROM (
     SELECT menu_code, tenant_id FROM t_sys_menu WHERE menu_code IN ('report:custom:create', 'report:custom:edit', 'report:custom:delete', 'report:custom:generate', 'report:schedule:create', 'report:schedule:edit', 'report:schedule:delete', 'report:schedule:toggle', 'report:schedule:run', 'report:permission:edit', 'report:export', 'system:print-record:create', 'system:print-record:reprint', 'system:print-template:create', 'system:print-template:edit', 'system:print-template:delete', 'system:print-template:reset', 'system:print-template:set-default', 'store:hardware:config-edit', 'store:hardware:config-test', 'store:hardware:announce', 'store:hardware:box-pay', 'store:hardware:box-config-edit', 'store:hardware:box-config-test', 'store:hardware:unionpay-test', 'miniapp:config:edit', 'miniapp:package:upload-key', 'miniapp:package:build', 'miniapp:package:publish', 'miniapp:order-sync:retry', 'dashboard:todo:create', 'dashboard:todo:complete', 'dashboard:todo:dismiss', 'dashboard:todo:delete', 'dashboard:quick-entry:create', 'dashboard:quick-entry:sort', 'dashboard:quick-entry:edit', 'dashboard:quick-entry:delete')
     GROUP BY menu_code, tenant_id HAVING COUNT(*) > 1
   ) dup)) AS result;

SELECT CONCAT('207 零角色授权自证：持本批任一新码的角色行数（应为 0）= ',
  (SELECT COUNT(*) FROM (
     SELECT r.id FROM t_sys_role r
      WHERE r.permissions IS NOT NULL
        AND JSON_VALID(r.permissions) = 1
        AND EXISTS (
          SELECT 1 FROM (
            SELECT 'report:custom:create' AS code
            UNION ALL
            SELECT 'report:custom:edit' AS code
            UNION ALL
            SELECT 'report:custom:delete' AS code
            UNION ALL
            SELECT 'report:custom:generate' AS code
            UNION ALL
            SELECT 'report:schedule:create' AS code
            UNION ALL
            SELECT 'report:schedule:edit' AS code
            UNION ALL
            SELECT 'report:schedule:delete' AS code
            UNION ALL
            SELECT 'report:schedule:toggle' AS code
            UNION ALL
            SELECT 'report:schedule:run' AS code
            UNION ALL
            SELECT 'report:permission:edit' AS code
            UNION ALL
            SELECT 'report:export' AS code
            UNION ALL
            SELECT 'system:print-record:create' AS code
            UNION ALL
            SELECT 'system:print-record:reprint' AS code
            UNION ALL
            SELECT 'system:print-template:create' AS code
            UNION ALL
            SELECT 'system:print-template:edit' AS code
            UNION ALL
            SELECT 'system:print-template:delete' AS code
            UNION ALL
            SELECT 'system:print-template:reset' AS code
            UNION ALL
            SELECT 'system:print-template:set-default' AS code
            UNION ALL
            SELECT 'store:hardware:config-edit' AS code
            UNION ALL
            SELECT 'store:hardware:config-test' AS code
            UNION ALL
            SELECT 'store:hardware:announce' AS code
            UNION ALL
            SELECT 'store:hardware:box-pay' AS code
            UNION ALL
            SELECT 'store:hardware:box-config-edit' AS code
            UNION ALL
            SELECT 'store:hardware:box-config-test' AS code
            UNION ALL
            SELECT 'store:hardware:unionpay-test' AS code
            UNION ALL
            SELECT 'miniapp:config:edit' AS code
            UNION ALL
            SELECT 'miniapp:package:upload-key' AS code
            UNION ALL
            SELECT 'miniapp:package:build' AS code
            UNION ALL
            SELECT 'miniapp:package:publish' AS code
            UNION ALL
            SELECT 'miniapp:order-sync:retry' AS code
            UNION ALL
            SELECT 'dashboard:todo:create' AS code
            UNION ALL
            SELECT 'dashboard:todo:complete' AS code
            UNION ALL
            SELECT 'dashboard:todo:dismiss' AS code
            UNION ALL
            SELECT 'dashboard:todo:delete' AS code
            UNION ALL
            SELECT 'dashboard:quick-entry:create' AS code
            UNION ALL
            SELECT 'dashboard:quick-entry:sort' AS code
            UNION ALL
            SELECT 'dashboard:quick-entry:edit' AS code
            UNION ALL
            SELECT 'dashboard:quick-entry:delete' AS code
          ) c
           WHERE JSON_CONTAINS(r.permissions, JSON_QUOTE(c.code)) = 1
        )
   ) holder), '（另附机读读数：0 即零角色授权）') AS result;

SELECT (SELECT COUNT(*) FROM (
     SELECT r.id FROM t_sys_role r
      WHERE r.permissions IS NOT NULL
        AND JSON_VALID(r.permissions) = 1
        AND EXISTS (
          SELECT 1 FROM (
            SELECT 'report:custom:create' AS code
            UNION ALL
            SELECT 'report:custom:edit' AS code
            UNION ALL
            SELECT 'report:custom:delete' AS code
            UNION ALL
            SELECT 'report:custom:generate' AS code
            UNION ALL
            SELECT 'report:schedule:create' AS code
            UNION ALL
            SELECT 'report:schedule:edit' AS code
            UNION ALL
            SELECT 'report:schedule:delete' AS code
            UNION ALL
            SELECT 'report:schedule:toggle' AS code
            UNION ALL
            SELECT 'report:schedule:run' AS code
            UNION ALL
            SELECT 'report:permission:edit' AS code
            UNION ALL
            SELECT 'report:export' AS code
            UNION ALL
            SELECT 'system:print-record:create' AS code
            UNION ALL
            SELECT 'system:print-record:reprint' AS code
            UNION ALL
            SELECT 'system:print-template:create' AS code
            UNION ALL
            SELECT 'system:print-template:edit' AS code
            UNION ALL
            SELECT 'system:print-template:delete' AS code
            UNION ALL
            SELECT 'system:print-template:reset' AS code
            UNION ALL
            SELECT 'system:print-template:set-default' AS code
            UNION ALL
            SELECT 'store:hardware:config-edit' AS code
            UNION ALL
            SELECT 'store:hardware:config-test' AS code
            UNION ALL
            SELECT 'store:hardware:announce' AS code
            UNION ALL
            SELECT 'store:hardware:box-pay' AS code
            UNION ALL
            SELECT 'store:hardware:box-config-edit' AS code
            UNION ALL
            SELECT 'store:hardware:box-config-test' AS code
            UNION ALL
            SELECT 'store:hardware:unionpay-test' AS code
            UNION ALL
            SELECT 'miniapp:config:edit' AS code
            UNION ALL
            SELECT 'miniapp:package:upload-key' AS code
            UNION ALL
            SELECT 'miniapp:package:build' AS code
            UNION ALL
            SELECT 'miniapp:package:publish' AS code
            UNION ALL
            SELECT 'miniapp:order-sync:retry' AS code
            UNION ALL
            SELECT 'dashboard:todo:create' AS code
            UNION ALL
            SELECT 'dashboard:todo:complete' AS code
            UNION ALL
            SELECT 'dashboard:todo:dismiss' AS code
            UNION ALL
            SELECT 'dashboard:todo:delete' AS code
            UNION ALL
            SELECT 'dashboard:quick-entry:create' AS code
            UNION ALL
            SELECT 'dashboard:quick-entry:sort' AS code
            UNION ALL
            SELECT 'dashboard:quick-entry:edit' AS code
            UNION ALL
            SELECT 'dashboard:quick-entry:delete' AS code
          ) c
           WHERE JSON_CONTAINS(r.permissions, JSON_QUOTE(c.code)) = 1
        )
   ) holder) AS roles_holding_new_codes,
  (SELECT COUNT(*) FROM t_sys_menu WHERE menu_code IN ('report:custom:create', 'report:custom:edit', 'report:custom:delete', 'report:custom:generate', 'report:schedule:create', 'report:schedule:edit', 'report:schedule:delete', 'report:schedule:toggle', 'report:schedule:run', 'report:permission:edit', 'report:export', 'system:print-record:create', 'system:print-record:reprint', 'system:print-template:create', 'system:print-template:edit', 'system:print-template:delete', 'system:print-template:reset', 'system:print-template:set-default', 'store:hardware:config-edit', 'store:hardware:config-test', 'store:hardware:announce', 'store:hardware:box-pay', 'store:hardware:box-config-edit', 'store:hardware:box-config-test', 'store:hardware:unionpay-test', 'miniapp:config:edit', 'miniapp:package:upload-key', 'miniapp:package:build', 'miniapp:package:publish', 'miniapp:order-sync:retry', 'dashboard:todo:create', 'dashboard:todo:complete', 'dashboard:todo:dismiss', 'dashboard:todo:delete', 'dashboard:quick-entry:create', 'dashboard:quick-entry:sort', 'dashboard:quick-entry:edit', 'dashboard:quick-entry:delete')) AS total_38codes,
  (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id = 'default' AND menu_code IN ('report:custom:create', 'report:custom:edit', 'report:custom:delete', 'report:custom:generate', 'report:schedule:create', 'report:schedule:edit', 'report:schedule:delete', 'report:schedule:toggle', 'report:schedule:run', 'report:permission:edit', 'report:export', 'system:print-record:create', 'system:print-record:reprint', 'system:print-template:create', 'system:print-template:edit', 'system:print-template:delete', 'system:print-template:reset', 'system:print-template:set-default', 'store:hardware:config-edit', 'store:hardware:config-test', 'store:hardware:announce', 'store:hardware:box-pay', 'store:hardware:box-config-edit', 'store:hardware:box-config-test', 'store:hardware:unionpay-test', 'miniapp:config:edit', 'miniapp:package:upload-key', 'miniapp:package:build', 'miniapp:package:publish', 'miniapp:order-sync:retry', 'dashboard:todo:create', 'dashboard:todo:complete', 'dashboard:todo:dismiss', 'dashboard:todo:delete', 'dashboard:quick-entry:create', 'dashboard:quick-entry:sort', 'dashboard:quick-entry:edit', 'dashboard:quick-entry:delete')) AS default_tenant_rows,
  (SELECT COUNT(*) FROM (
     SELECT menu_code, tenant_id FROM t_sys_menu WHERE menu_code IN ('report:custom:create', 'report:custom:edit', 'report:custom:delete', 'report:custom:generate', 'report:schedule:create', 'report:schedule:edit', 'report:schedule:delete', 'report:schedule:toggle', 'report:schedule:run', 'report:permission:edit', 'report:export', 'system:print-record:create', 'system:print-record:reprint', 'system:print-template:create', 'system:print-template:edit', 'system:print-template:delete', 'system:print-template:reset', 'system:print-template:set-default', 'store:hardware:config-edit', 'store:hardware:config-test', 'store:hardware:announce', 'store:hardware:box-pay', 'store:hardware:box-config-edit', 'store:hardware:box-config-test', 'store:hardware:unionpay-test', 'miniapp:config:edit', 'miniapp:package:upload-key', 'miniapp:package:build', 'miniapp:package:publish', 'miniapp:order-sync:retry', 'dashboard:todo:create', 'dashboard:todo:complete', 'dashboard:todo:dismiss', 'dashboard:todo:delete', 'dashboard:quick-entry:create', 'dashboard:quick-entry:sort', 'dashboard:quick-entry:edit', 'dashboard:quick-entry:delete')
     GROUP BY menu_code, tenant_id HAVING COUNT(*) > 1
   ) dup) AS duplicate_pairs;

-- ============================================
-- 迁移编号：207
-- 单号：S3-236（立码第二批 · 四域 38 码）
-- 描述：把四域 38 个新权限码登记进 t_sys_menu（BUTTON 行，父行 = 各租户的域 CATALOG 行）
-- 创建人：阿坚（后端 / 权限）｜执行卡：docs/tasks/inbox/ACTIVE-S3-236.md（+ DSH 派单卡的三条更正）
-- 日期：2026-10-17
--
-- 一、本迁移只做一件事：**立码**（38 个新码登记进 t_sys_menu），**不接任何业务路由**
--   · 本仓"权限码靠 t_sys_menu 行登记才可授权 / 可发现"（同 S3-209 `sale:cancel`、S3-232 的 204 口径）；
--   · 38 码与 backend/src/shared/batch2-permission-codes.ts 的 BATCH2_PERMISSION_CATALOG **逐字同源**
--     （目录↔迁移双向一致断言见 backend/src/__tests__/shared/batch2-permission-codes.test.ts）；
--   · 码表来源 = docs/tasks/R101-待立码清单-五域.md §二（照抄，禁止自拟）：
--   · 报表域 11 码：`report:custom:create`、`report:custom:edit`、`report:custom:delete`、`report:custom:generate`、`report:schedule:create`、`report:schedule:edit`、`report:schedule:delete`、`report:schedule:toggle`、`report:schedule:run`、`report:permission:edit`、`report:export`
--   · 硬件/打印域 14 码：`system:print-record:create`、`system:print-record:reprint`、`system:print-template:create`、`system:print-template:edit`、`system:print-template:delete`、`system:print-template:reset`、`system:print-template:set-default`、`store:hardware:config-edit`、`store:hardware:config-test`、`store:hardware:announce`、`store:hardware:box-pay`、`store:hardware:box-config-edit`、`store:hardware:box-config-test`、`store:hardware:unionpay-test`
--   · 小程序/移动端域 5 码：`miniapp:config:edit`、`miniapp:package:upload-key`、`miniapp:package:build`、`miniapp:package:publish`、`miniapp:order-sync:retry`
--   · 工作台/待办消息域 8 码：`dashboard:todo:create`、`dashboard:todo:complete`、`dashboard:todo:dismiss`、`dashboard:todo:delete`、`dashboard:quick-entry:create`、`dashboard:quick-entry:sort`、`dashboard:quick-entry:edit`、`dashboard:quick-entry:delete`
--   · 不立码的既有裁定（卡 §三，本迁移**不涉及**）：硬件回调 2 条（公开端点）、
--     `miniapp:wechat:decrypt-phone`（requireWxAuth 域，另立小单）、`wb-notifications` 3 条（自服务）。
--
-- 二、本批**默认不发任何角色码**（卡 §二.3）：本迁移**没有任何 UPDATE t_sys_role / INSERT t_sys_role_permission**；
--   末尾第 3 条只读 SELECT 就是"零授权"的自证读数（按生产同一份 matchPermission 语义的 JSON_OVERLAPS 复算）。
--   · 为什么不补 t_sys_role_permission：该表全仓无人读，授权判定只读 t_sys_role.permissions（S3-232 裁定 3）。
--   · 若某码必须发给某在用角色 ⇒ **只登记、在回传卡请凌舟裁**，不得自行发码（卡 §二.3）。
--
-- 三、幂等（可重复执行，第二遍**零行变更**）
--   · 菜单行按 (menu_code, tenant_id) 判定（与唯一键 uk_sys_menu_code_tenant 同口径，NOT EXISTS 守卫）；
--   · 父行按 menu_code = 'report' / 'system' / 'store' / 'dashboard'（079 既有 CATALOG 码）逐租户定位
--     ⇒ default 与各租户克隆行各自补自己的按钮行；父行缺失的租户（尚未克隆菜单的空库/灾备库）
--     该条整条跳过，**不插孤儿行、不报错**；
--   · 为什么用 NOT EXISTS 而不是 INSERT IGNORE：INSERT IGNORE 会把**其它**错误（列不匹配、超长）
--     一起吞掉，留下"看起来成功其实没插"的假绿（技术债铁律：绕过 ≠ 修复）。
--
-- 四、⚠️ 父行口径（本迁移的**唯一自主判定**，已登记回传卡"待裁定项"）
--   · 报表 11 码 → 079 第 90 号 CATALOG `report`（报表中心）；
--   · 硬件/打印 14 码 → 打印留痕/模板 7 码挂 079 第 100 号 CATALOG `system`（与 app-mobile 菜单码
--     `system:print` 同域），硬件配置 7 码挂 079 第 70 号 CATALOG `store`（硬件配置挂在门店域）；
--   · 工作台 8 码 → 079 第 1 号 CATALOG `dashboard`（仪表盘/工作台）；
--   · 小程序 5 码 → ⚠️ **079 里没有 `miniapp` CATALOG 行**（`miniapp:*` 只作为模块码族出现在
--     079 第 92 行 CUSTOMER_SERVICE 的角色权限串里）⇒ 本迁移按"父行必须存在、不得插孤儿行"的口径
--     把 5 码挂到 `system` CATALOG（管理面系统配置），**不新建目录行**（新建目录=改菜单结构，越出"只立码"）。
--     备选方案（凌舟裁）：另立小单加 `miniapp` CATALOG 行后再把这 5 行改挂过去。
--
-- 五、⚠️ 必须用 run-migration.mjs 执行（否则本文件的数据写语句会被静默跳过）
--   本文件是**数据写语句**（INSERT ... SELECT），后端启动期外部迁移段（backend/src/shared/migration.ts
--   第 8 步）有 MIG-4 写闸门，默认 MIGRATION_WRITE_GATE=block ⇒ INSERT 会被跳过并打一行日志，
--   只剩末尾三条 SELECT。正确执行方式（由凌舟在生产执行）：
--     node scripts/run-migration.mjs docs/migrations/207_四域权限点立码.sql
--       或   MIGRATION_WRITE_GATE=allow 重启后端
--   执行后核对末尾 SELECT 的三个读数：38 码全租户命中 = 租户数 × 38、default 租户命中 38、
--   重复行 0、持本批新码的角色行 0。
--
-- 六、回滚（逐条给出）
--   DELETE FROM t_sys_menu WHERE menu_code IN (
--     'report:custom:create', 'report:custom:edit', 'report:custom:delete', 'report:custom:generate', 'report:schedule:create', 'report:schedule:edit', 'report:schedule:delete', 'report:schedule:toggle', 'report:schedule:run', 'report:permission:edit', 'report:export', 'system:print-record:create', 'system:print-record:reprint', 'system:print-template:create', 'system:print-template:edit', 'system:print-template:delete', 'system:print-template:reset', 'system:print-template:set-default', 'store:hardware:config-edit', 'store:hardware:config-test', 'store:hardware:announce', 'store:hardware:box-pay', 'store:hardware:box-config-edit', 'store:hardware:box-config-test', 'store:hardware:unionpay-test', 'miniapp:config:edit', 'miniapp:package:upload-key', 'miniapp:package:build', 'miniapp:package:publish', 'miniapp:order-sync:retry', 'dashboard:todo:create', 'dashboard:todo:complete', 'dashboard:todo:dismiss', 'dashboard:todo:delete', 'dashboard:quick-entry:create', 'dashboard:quick-entry:sort', 'dashboard:quick-entry:edit', 'dashboard:quick-entry:delete');
--   本迁移无角色授权变更 ⇒ **无需**回滚任何 t_sys_role.permissions。
-- ============================================
