-- S3-236 真库夹具（迁移 207 **执行前**的最小前置状态）—— 2026-10-17
--
-- 为什么是这个夹具（诚实标注边界）：
--   · 本沙箱里**没有 MySQL 8.0.28**（既有夹具库 `D:\Users\ZXQL\tools\mariadb\data` 在工作树之外，
--     本会话的文件沙箱对该路径只读，提权被拒）；故改用本机既有的 **MariaDB 11.4.5** 便携实例，
--     数据目录**放在工作树内**（`docs/evidence/S3-236/harness/mariadb-data/`，不进 git）。
--   · 本夹具只建 207 真正用到的最小形状（不建 312 张业务表）：`t_sys_menu`（079 第 18-37 行的 DDL
--     逐字复制）+ `t_sys_role`（008 的 DDL + 后续迁移补的 tenant_id/data_scope 列）。
--   · 父行摆 **default 与 demo 两个租户**的 `report/system/store/dashboard` CATALOG 行
--     ⇒ 验证"父行按 menu_code 逐租户定位、各自补自己的按钮行"的多租户行为。
--   · ⚠️ 本夹具**不代表**生产库形状；生产执行与只读复核仍须由凌舟用
--     `node scripts/run-migration.mjs docs/migrations/207_四域权限点立码.sql` 完成。

DROP TABLE IF EXISTS t_sys_menu;
DROP TABLE IF EXISTS t_sys_role;

CREATE TABLE t_sys_menu (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '菜单ID',
  parent_id BIGINT UNSIGNED DEFAULT NULL COMMENT '父菜单ID，NULL=顶级菜单',
  menu_code VARCHAR(64) NOT NULL COMMENT '菜单编码，如 sale:order:view',
  menu_name VARCHAR(64) NOT NULL COMMENT '菜单名称',
  menu_type VARCHAR(16) NOT NULL DEFAULT 'MENU' COMMENT '菜单类型：CATALOG(目录)/MENU(菜单)/BUTTON(按钮)',
  path VARCHAR(255) DEFAULT NULL COMMENT '前端路由路径',
  component VARCHAR(255) DEFAULT NULL COMMENT '前端组件路径',
  icon VARCHAR(64) DEFAULT NULL COMMENT '图标',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号',
  visible TINYINT NOT NULL DEFAULT 1 COMMENT '是否可见：1可见，0隐藏',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0禁用',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sys_menu_code_tenant (menu_code, tenant_id),
  KEY idx_sys_menu_parent_id (parent_id),
  KEY idx_sys_menu_sort (sort_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单权限表';

CREATE TABLE t_sys_role (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  role_code VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  permissions JSON DEFAULT NULL,
  data_scope VARCHAR(32) NOT NULL DEFAULT 'SELF',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role_code (role_code),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统角色';

-- 父行：079 第 90/100/70/1 号 CATALOG 的同形行（default + demo 两个租户各一套）
INSERT INTO t_sys_menu (parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status, tenant_id)
VALUES
  (NULL, 'report',    '报表中心', 'CATALOG', '/report',    'chart',   'chart',   10, 1, 1, 'default'),
  (NULL, 'system',    '系统管理', 'CATALOG', '/system',    'setting', 'setting', 11, 1, 1, 'default'),
  (NULL, 'store',     '门店管理', 'CATALOG', '/store',     'shop',    'shop',     8, 1, 1, 'default'),
  (NULL, 'dashboard', '仪表盘',   'CATALOG', '/dashboard', 'dashboard', 'dashboard', 1, 1, 1, 'default'),
  (NULL, 'report',    '报表中心', 'CATALOG', '/report',    'chart',   'chart',   10, 1, 1, 'demo'),
  (NULL, 'system',    '系统管理', 'CATALOG', '/system',    'setting', 'setting', 11, 1, 1, 'demo'),
  (NULL, 'store',     '门店管理', 'CATALOG', '/store',     'shop',    'shop',     8, 1, 1, 'demo'),
  (NULL, 'dashboard', '仪表盘',   'CATALOG', '/dashboard', 'dashboard', 'dashboard', 1, 1, 1, 'demo');

-- 角色：一个持通配 `*` 的超管 + 一个店长（用于验证"本批零授权"：新码不被任何角色命中，
-- 除非该角色持 `*`；JSON_OVERLAPS 只做**精确值**交集，`*` 不会被算成命中，故期望 0 行）
-- ⚠️ JSON 列用**字符串字面量**赋值（MariaDB 11.4 的 CLI 对 `CAST('[...]' AS JSON)` 在内联 VALUES 里解析异常，
--    实测 ERROR 1064；字符串赋值语义等价，且与 205 种子脚本的写法兼容）
INSERT INTO t_sys_role (role_name, role_code, description, permissions, data_scope, tenant_id)
VALUES
  ('超级管理员', 'SUPER_ADMIN', '夹具超管', '["*"]', 'ALL', 'default'),
  ('店长', 'STORE_MANAGER', '夹具店长', '["store:*","sale:*","report:*","dashboard:*","goods:price"]', 'STORE', 'default');

-- 前置自证（读数由 harness 打印）
SELECT CONCAT('夹具状态：CATALOG 父行 ', (SELECT COUNT(*) FROM t_sys_menu WHERE menu_type = 'CATALOG'),
  ' 行（default 4 / demo 4）；本批 38 码既有行 ', (SELECT COUNT(*) FROM t_sys_menu WHERE menu_code LIKE 'report:%' OR menu_code LIKE 'system:print%' OR menu_code LIKE 'store:hardware%' OR menu_code LIKE 'miniapp:%' OR menu_code LIKE 'dashboard:todo%' OR menu_code LIKE 'dashboard:quick-entry%'),
  ' 行（应为 0）；角色 ', (SELECT COUNT(*) FROM t_sys_role), ' 行') AS result;
