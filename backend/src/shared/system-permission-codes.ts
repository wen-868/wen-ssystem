/**
 * S3-232（立码第一批 · D6）：系统设置 / 基础域 14 个新权限码的**唯一出处**
 *
 * 一、为什么要有这个文件（本仓既有口径，不是新发明）
 *   · 项目口径：**目录走代码常量、迁移只做 DDL**（先例：`platform-role.service.ts` 的 PERMISSION_CATALOG、
 *     `app-mobile-menu-catalog.ts`、`goods-permission-codes.ts` / `sale-permission-codes.ts` /
 *     `library-permission-codes.ts` 三个 per-域常量文件）；
 *   · 本仓**不存在** `user-permissions.ts` 里的 `PERMISSION_CATALOG`（派单卡 §二.1 按平台侧命名写的，
 *     平台侧目录在 `services/platform/platform-role.service.ts:138`；商家侧目录就是本文件这种 per-域常量）
 *     ⇒ 按卡外纪律「只登记差异、不猜」，差异已写进 `docs/tasks/inbox/ACTIVE-回执-S3-232.md` §六。
 *
 * 二、这 14 个码怎么来的（依据 = 派单卡 §一.2 + 台账 §三.9，逐条可复算）
 *   台账 `docs/tasks/R101-RBAC接线缺口清单.md` §三.9 里判「管理面 / 是 / 无现成码 ⇒ 需先立权限点」的有 22 条，
 *   本单按 §六 卡外纪律 + S3-205 §10.3 的**既有改判**拆成三段（22 = 14 + 2 + 6）：
 *     · **14 条立码**（本文件 + `docs/migrations/204_系统设置域权限点立码.sql`）；
 *     · **2 条已改判消费者端**（`notification.routes.ts` 的两条小程序通知写端点，§10.3 已更正 §三.9 的
 *       1186–1187 行：消费者 `roles` 恒空 ⇒ 商家权限码不适用，接了必 403）⇒ **不立码**；
 *     · **6 条登记差异 / 待裁定**（本人头像、前端错误上报、分享链接收款、App 离线同步 3 条）⇒ **不立码**，
 *       逐条给证据与建议去向，见 `docs/tasks/R101-待立码清单-五域.md` §二。
 *
 * 三、命名规范（照派单卡 §一.2 与授权模型提案 §三）
 *   · `模块:子域:动作`，模块名取自 `docs/migrations/079_权限矩阵.sql` 的既有模块码（本域全部落 `system`，
 *     079 第 100 号一级目录 `system` 系统管理）；
 *   · **不新增 `xxx:manage` 一类的"万能码"**（提案 §三 明文禁止）；
 *   · 同一语义跨端点**同名同码**（本域无重复语义，14 端点 ↔ 14 码一一对应）。
 *
 * 四、持有者口径（为什么本单**不给任何角色发码**）
 *   生产只读底稿 `docs/evidence/_shared/prod-menu-grants-all-20261016.txt`：`system:*` 全部菜单只授予
 *   `OPERATION_ADMIN`（0 账号）/ `READONLY`（只读观察员，1 账号冒烟）/ `STORE_ADMIN`（0 账号，旧词表）
 *   ⇒ 没有任何**在用写角色**看得见这些页面，属提案 §〇·I1' 的 ①③ 组合（持码者 ∪ 菜单未对在用写角色开放），
 *   故**只立码、不授权**（授权留给后续接线批按 I1' 判定）。唯一例外是 D1 的
 *   `STORE_MANAGER ← goods:create | goods:edit`，它落在迁移 204 与 ops 脚本里，不在本文件。
 *
 * 五、前端入口（派单卡 §二.4 要求登记到位）
 *   本仓前端**不引用商家权限码**（`meta.roles` 按角色收口，见 `admin-web/src/router/index.ts`），
 *   故"入口登记"是**登记表**而非代码改动：见 `docs/tasks/R101-待立码清单-五域.md` §三
 *   （14 码里 1 码有前端调用点、其余 13 码"暂无前端入口，仅后端授权位"）。
 */

/** 预警处理：`PUT /api/admin/alerts/:id/handle`（alert.routes.ts:10，处理库存/效期预警） */
export const PERM_SYSTEM_ALERT_HANDLE = "system:alert:handle";
/** 预警规则维护：`PUT /api/admin/alerts/rules/:id`（alert.routes.ts:12） */
export const PERM_SYSTEM_ALERT_RULE_EDIT = "system:alert:rule-edit";
/** 手动触发预警检查：`POST /api/admin/alerts/check`（alert.routes.ts:13） */
export const PERM_SYSTEM_ALERT_CHECK = "system:alert:check";
/** 执行数据归档：`POST /api/admin/archive/execute`（archive.routes.ts:8） */
export const PERM_SYSTEM_ARCHIVE_EXECUTE = "system:archive:execute";
/** 通知标记已读：`PUT /api/admin/notifications/:id/read`（notification.routes.ts:14） */
export const PERM_SYSTEM_NOTIFICATION_READ = "system:notification:read";
/** 通知全部已读：`POST /api/admin/notifications/read-all`（notification.routes.ts:15） */
export const PERM_SYSTEM_NOTIFICATION_READ_ALL = "system:notification:read-all";
/** 发送通知：`POST /api/admin/notifications/send`（notification.routes.ts:16） */
export const PERM_SYSTEM_NOTIFICATION_SEND = "system:notification:send";
/** 删除通知：`DELETE /api/admin/notifications/:id`（notification.routes.ts:18） */
export const PERM_SYSTEM_NOTIFICATION_DELETE = "system:notification:delete";
/** 批量删除通知：`POST /api/admin/notifications/batch-delete`（notification.routes.ts:19） */
export const PERM_SYSTEM_NOTIFICATION_BATCH_DELETE = "system:notification:batch-delete";
/** 发送测试推送：`POST /api/admin/push/test`（push.routes.ts:35；控制器内已有 SUPER_ADMIN/OPERATION_ADMIN/BOSS 角色硬校验） */
export const PERM_SYSTEM_PUSH_TEST = "system:push:test";
/** 新增短信模板：`POST /api/admin/sms-templates/`（sms-template.routes.ts:15） */
export const PERM_SYSTEM_SMS_TEMPLATE_CREATE = "system:sms-template:create";
/** 编辑短信模板：`PUT /api/admin/sms-templates/:id`（sms-template.routes.ts:16） */
export const PERM_SYSTEM_SMS_TEMPLATE_EDIT = "system:sms-template:edit";
/** 删除短信模板：`DELETE /api/admin/sms-templates/:id`（sms-template.routes.ts:17） */
export const PERM_SYSTEM_SMS_TEMPLATE_DELETE = "system:sms-template:delete";
/** 执行数据库迁移：`POST /api/system/migrate`（system.routes.ts:11，运维入口） */
export const PERM_SYSTEM_MIGRATION_RUN = "system:migration:run";

/** 目录条目：一个码 = 一个能力单元，端点为其授权面（用路由注册行定位，不写漂移行号） */
export interface SystemPermissionEntry {
  /** 权限码（`模块:子域:动作`） */
  code: string;
  /** 模块名（取 079 既有模块码 ⇒ 本域全部 `system`） */
  module: string;
  /** 中文名（写进 `t_sys_menu.menu_name`，与迁移 204 逐字同值） */
  name: string;
  /** 动作（`模块:子域:动作` 的第三段） */
  action: string;
  /** 路由文件（相对 `backend/src/routes/`） */
  routeFile: string;
  /** 该码覆盖的写端点（`METHOD /api/...`，路径字面量，供断言逐条核对） */
  endpoints: ReadonlyArray<string>;
  /** 注册进 `t_sys_menu` 的父行 menu_code（本域统一挂在 079 的 `system` 一级目录下） */
  menuParent: string;
  /** 前端入口（有则写页面路径，无则写"暂无前端入口，仅后端授权位"） */
  frontendEntry: string;
}

/** 14 个新码的目录（顺序 = 迁移 204 里的 `sort_no` 顺序，逐行一一对应） */
export const SYSTEM_PERMISSION_CATALOG: ReadonlyArray<SystemPermissionEntry> = [
  {
    code: PERM_SYSTEM_ALERT_HANDLE,
    module: "system",
    name: "处理预警",
    action: "handle",
    routeFile: "alert.routes.ts",
    endpoints: ["PUT /api/admin/alerts/:id/handle"],
    menuParent: "system",
    frontendEntry: "暂无前端入口，仅后端授权位（admin-web/src/api/alert.ts:9 有封装、全仓无页面调用点）",
  },
  {
    code: PERM_SYSTEM_ALERT_RULE_EDIT,
    module: "system",
    name: "维护预警规则",
    action: "rule-edit",
    routeFile: "alert.routes.ts",
    endpoints: ["PUT /api/admin/alerts/rules/:id"],
    menuParent: "system",
    frontendEntry: "暂无前端入口，仅后端授权位（admin-web/src/api/alert.ts:19 有封装、全仓无页面调用点）",
  },
  {
    code: PERM_SYSTEM_ALERT_CHECK,
    module: "system",
    name: "手动预警检查",
    action: "check",
    routeFile: "alert.routes.ts",
    endpoints: ["POST /api/admin/alerts/check"],
    menuParent: "system",
    frontendEntry: "暂无前端入口，仅后端授权位（定时/运维触发）",
  },
  {
    code: PERM_SYSTEM_ARCHIVE_EXECUTE,
    module: "system",
    name: "执行数据归档",
    action: "execute",
    routeFile: "archive.routes.ts",
    endpoints: ["POST /api/admin/archive/execute"],
    menuParent: "system",
    frontendEntry: "暂无前端入口，仅后端授权位",
  },
  {
    code: PERM_SYSTEM_NOTIFICATION_READ,
    module: "system",
    name: "通知标记已读",
    action: "read",
    routeFile: "notification.routes.ts",
    endpoints: ["PUT /api/admin/notifications/:id/read"],
    menuParent: "system",
    frontendEntry: "app-mobile/src/api/modules/notifications.ts:139（消息页；属 B 类，权限门由 S3-230 补）",
  },
  {
    code: PERM_SYSTEM_NOTIFICATION_READ_ALL,
    module: "system",
    name: "通知全部已读",
    action: "read-all",
    routeFile: "notification.routes.ts",
    endpoints: ["POST /api/admin/notifications/read-all"],
    menuParent: "system",
    frontendEntry: "app-mobile/src/api/modules/notifications.ts:166 区段（消息页批量已读；同上 B 类）",
  },
  {
    code: PERM_SYSTEM_NOTIFICATION_SEND,
    module: "system",
    name: "发送通知",
    action: "send",
    routeFile: "notification.routes.ts",
    endpoints: ["POST /api/admin/notifications/send"],
    menuParent: "system",
    frontendEntry: "admin-web/src/views/inventory/InventoryPriceQuote.vue:256（报价管理页，meta.roles=[SUPER_ADMIN]）",
  },
  {
    code: PERM_SYSTEM_NOTIFICATION_DELETE,
    module: "system",
    name: "删除通知",
    action: "delete",
    routeFile: "notification.routes.ts",
    endpoints: ["DELETE /api/admin/notifications/:id"],
    menuParent: "system",
    frontendEntry: "app-mobile/src/api/modules/notifications.ts:161（消息页；同上 B 类）",
  },
  {
    code: PERM_SYSTEM_NOTIFICATION_BATCH_DELETE,
    module: "system",
    name: "批量删除通知",
    action: "batch-delete",
    routeFile: "notification.routes.ts",
    endpoints: ["POST /api/admin/notifications/batch-delete"],
    menuParent: "system",
    frontendEntry: "app-mobile/src/api/modules/notifications.ts:169（消息页批量删除；同上 B 类）",
  },
  {
    code: PERM_SYSTEM_PUSH_TEST,
    module: "system",
    name: "发送测试推送",
    action: "test",
    routeFile: "push.routes.ts",
    endpoints: ["POST /api/admin/push/test"],
    menuParent: "system",
    frontendEntry: "暂无前端入口，仅后端授权位（控制器已有角色硬校验，接线时须与该角色集合对齐）",
  },
  {
    code: PERM_SYSTEM_SMS_TEMPLATE_CREATE,
    module: "system",
    name: "新增短信模板",
    action: "create",
    routeFile: "sms-template.routes.ts",
    endpoints: ["POST /api/admin/sms-templates/"],
    menuParent: "system",
    frontendEntry: "暂无前端入口，仅后端授权位（saas-admin 的 /platform/sms-templates 属平台域，另立单）",
  },
  {
    code: PERM_SYSTEM_SMS_TEMPLATE_EDIT,
    module: "system",
    name: "编辑短信模板",
    action: "edit",
    routeFile: "sms-template.routes.ts",
    endpoints: ["PUT /api/admin/sms-templates/:id"],
    menuParent: "system",
    frontendEntry: "暂无前端入口，仅后端授权位",
  },
  {
    code: PERM_SYSTEM_SMS_TEMPLATE_DELETE,
    module: "system",
    name: "删除短信模板",
    action: "delete",
    routeFile: "sms-template.routes.ts",
    endpoints: ["DELETE /api/admin/sms-templates/:id"],
    menuParent: "system",
    frontendEntry: "暂无前端入口，仅后端授权位",
  },
  {
    code: PERM_SYSTEM_MIGRATION_RUN,
    module: "system",
    name: "执行数据库迁移",
    action: "run",
    routeFile: "system.routes.ts",
    endpoints: ["POST /api/system/migrate"],
    menuParent: "system",
    frontendEntry: "暂无前端入口，仅后端授权位（运维入口）",
  },
];

/** 14 个新码（顺序同目录，供断言与门禁核对） */
export const SYSTEM_PERMISSION_CODES: ReadonlyArray<string> = SYSTEM_PERMISSION_CATALOG.map(
  (e) => e.code
);

/** 目录条数（**域数/条数断言**的唯一出处：派单卡 §二.5 要求同步的门禁数字） */
export const SYSTEM_PERMISSION_COUNT = SYSTEM_PERMISSION_CATALOG.length;

/** 本批立码覆盖的写端点条数（与台账 §三.9「22 = 14 立码 + 2 已改判 + 6 登记」的 14 逐条对齐） */
export const SYSTEM_PERMISSION_ENDPOINT_COUNT = SYSTEM_PERMISSION_CATALOG.reduce(
  (sum, e) => sum + e.endpoints.length,
  0
);

/** 模块白名单：079_权限矩阵.sql 的既有模块码（本域全部 `system`，扩域时不许自造模块名） */
export const SYSTEM_PERMISSION_MODULES: ReadonlyArray<string> = ["system"];

/** 禁止的"万能码"动作（授权模型提案 §三：商家侧不再新增 `xxx:manage`） */
export const FORBIDDEN_PERMISSION_ACTIONS: ReadonlyArray<string> = ["manage"];

/** D1：给 `STORE_MANAGER` 增补的两个商品写码（**不含 `goods:delete`**） */
export const D1_STORE_MANAGER_GRANTED_CODES: ReadonlyArray<string> = ["goods:create", "goods:edit"];

/** D1 明确**不得**增补的码（删除属高风险，留给超管/运营；提案 §二·D1） */
export const D1_STORE_MANAGER_FORBIDDEN_CODES: ReadonlyArray<string> = ["goods:delete"];

/** 本批立码的迁移文件（断言"目录 ↔ 迁移一致"时读取的唯一文件） */
export const SYSTEM_PERMISSION_MIGRATION = "204_系统设置域权限点立码.sql";
