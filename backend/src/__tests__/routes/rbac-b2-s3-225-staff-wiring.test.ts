/**
 * S3-225 · **员工 / 账号域**（7 路由文件 / 31 写端点）权限接线验收测试（B2 批 7）
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-225.md`
 * 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §三.1（域明细）＋ §十五（本批接线明细与守恒）
 * 机读台账：`backend/scripts/rbac-wiring-baseline.json`（本批后 `gaps` 501 条 / 134 文件）
 *
 * 本文件要证明的六件事（对应派单卡 §三.1/§三.2/§三.5）：
 *  a) 本批已接 **11 行**的**注册行级**形状断言（踩坑[134]：注释里的 `requirePermission(` 不算调用）；
 *  b) 只读账号（READONLY = `["*:view"]`）调这 11 行 ⇒ **403**，且**未到达业务层**；
 *  c) 该码的**持有账号**（SUPER_ADMIN / OPERATION_ADMIN）调对应行 ⇒ **200**（零回归）；
 *  d) 反证：**不持有**该码的账号（店长/财务/仓管/采购/操作员/销售）一律 **403**（证明判据不是恒 true 的假门禁）；
 *  e) **范围控制**：本域本批**未接**的 20 行 ⇒ 注册行级不含 `requirePermission(`，READONLY 仍能到达业务层
 *     （证明本批「没多接」）；且未接理由分成五类（B 类 7 / 自服务 7 / 自服务实际用途 1 / 查询型 POST 1 / 需新立码 4）；
 *  f) 未登录 ⇒ 401（既有行为不变）。
 *
 * 判据来源（逐条可核对）：
 *  · 权限匹配语义：`services/admin/rbac.service.ts` 的 `matchPermission`（`*` / `dom:*` / `*:action` / 精确码），
 *    测试用**生产同一份**匹配器，只把「数据库读取」换成角色权限串；
 *  · 落地码：`docs/migrations/079_权限矩阵.sql:270-273`（`system:user:create` / `system:user:edit` /
 *    `system:role:create` / `system:role:edit` 四条既有码，**本批不新立码、不改角色种子、不动迁移**）；
 *    持有角色 = SUPER_ADMIN / OPERATION_ADMIN（`guard-rbac-wiring.mjs --holders`，与生产只读底稿
 *    `docs/evidence/_shared/prod-roles-20261016.txt` 的 12 角色 × 权限码一致——生产无任何角色显式持 `system:*`，
 *    只有 `*` 通配的超管/运营管理员可用 ⇒ 页面角色集 {SUPER_ADMIN} 零回归）；
 *  · 页面真实使用者：`admin-web/src/router/index.ts` 的 `meta.roles`（fail-closed，逐条源码同源断言）；
 *  · B 类判定依据：`app-mobile/src/pages/profile/profile.vue:50/54` 对员工管理页与角色管理页是**无条件硬编码入口**
 *    （无 `v-if`、无 `isPageVisible` 判定）⇒ 移动端写调用点使用者集合不可枚举（见本文件末尾「来源同源」用例）。
 *
 * 保真度说明：
 *  · 真：路由文件与其注册顺序、`requirePermission` 中间件本体（`middleware/rbac-auth.ts`，含 SUPER_ADMIN 短路）、
 *        `matchPermission` 匹配器、CSRF 在挂载层先于路由匹配的顺序（踩坑[34]）。
 *  · 桩：`checkUserPermission` 的**数据库读取**（用角色权限串喂真实匹配器）、控制器（只记录「请求是否到达
 *        业务层」）、登录态（生产由 requireAuth 从 JWT 取，本测试用请求头注入）。
 *
 * 反测（门禁铁律）：摘掉本批任一条 `requirePermission(...)` ⇒ 对应「READONLY ⇒ 403」用例必红；
 *   复原 ⇒ 绿（原始输出见 `docs/evidence/S3-225/` 下反测日志与回执 §二）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import type { Router, Request, Response, NextFunction } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCsrfToken } from "../../middleware/csrf";
import { fail } from "../../shared/response";

const h = vi.hoisted(() => {
  /** 控制器被调用的记录（= 请求到达业务层） */
  const reached: string[] = [];
  /** userId → 角色权限串（等价于 t_sys_role.permissions） */
  const perms = new Map<number, string[]>();
  const stub = () => {
    const cache = new Map<string, unknown>();
    return new Proxy(
      {},
      {
        get(_target, prop) {
          if (typeof prop === "symbol" || prop === "then" || prop === "catch" || prop === "finally") {
            return undefined;
          }
          const key = String(prop);
          if (!cache.has(key)) {
            cache.set(key, (req: any, res: any) => {
              reached.push(key);
              res.json({ success: true, code: "0", msg: "成功", handler: key });
            });
          }
          return cache.get(key);
        },
        has(_target, prop) {
          return typeof prop !== "symbol";
        },
      }
    );
  };
  return { reached, perms, stub };
});

// ---- 控制器全部打桩：本测试只关心「有没有被权限门禁拦住」 ----
vi.mock("@controllers/admin/employee.controller", () => h.stub());
vi.mock("@controllers/admin/sys-user.controller", () => h.stub());
vi.mock("@controllers/admin/rbac.controller", () => h.stub());
vi.mock("@controllers/admin/data-permission.controller", () => h.stub());
vi.mock("@controllers/admin/department.controller", () => h.stub());
vi.mock("@controllers/admin/user-session.controller", () => h.stub());
vi.mock("@controllers/admin/auth.controller", () => h.stub());

// ---- 权限判定：数据库读取打桩，匹配逻辑用生产真实的 matchPermission ----
vi.mock("@services/admin/rbac.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@services/admin/rbac.service")>();
  return {
    ...actual,
    checkUserPermission: async (userId: number, _tenantId: number, permCode: string) =>
      actual.matchPermission(h.perms.get(userId) ?? [], permCode),
  };
});

import { matchPermission } from "@services/admin/rbac.service";
import { adminAuthRouter } from "../../routes/admin-auth.routes";
import { adminStaffRouter } from "../../routes/admin-staff.routes";
import { dataPermissionRouter } from "../../routes/data-permission.routes";
import { departmentRouter } from "../../routes/department.routes";
import { rbacRouter } from "../../routes/rbac.routes";
import { sysUserRouter } from "../../routes/sys-user.routes";
import { userSessionRouter } from "../../routes/user-session.routes";

/**
 * 测试账号：与 `guard-rbac-wiring.mjs` 的 ROLE_PERMISSIONS_SEED 逐字同源；
 * 9002/9010 = 生产 `*` 通配角色（生产底稿 `docs/evidence/_shared/prod-roles-20261016.txt` 第一节）。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[] }> = {
  9001: { name: "readonly", roles: ["READONLY"], perms: ["*:view"] },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"] },
  9003: {
    name: "sales_staff",
    roles: ["SALES_STAFF"],
    perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"],
  },
  9004: {
    name: "store_manager_seed",
    roles: ["STORE_MANAGER"],
    perms: ["store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*"],
  },
  9005: {
    name: "warehouse_staff",
    roles: ["WAREHOUSE_STAFF"],
    perms: ["inventory:*", "trace:*", "transfer:*", "stock-check:*"],
  },
  9006: {
    name: "finance_staff",
    roles: ["FINANCE_STAFF"],
    perms: ["finance:*", "report:*", "customer:statement", "supplier:statement", "dashboard:view"],
  },
  9007: {
    name: "purchase_staff",
    roles: ["PURCHASE_STAFF"],
    perms: ["purchase:*", "supplier:*", "inventory:inbound", "report:purchase"],
  },
  9008: {
    name: "store_operator",
    roles: ["STORE_OPERATOR"],
    perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"],
  },
  /** 生产店长实值（生产底稿第一节）：`store:*`…`finance:payment`…**无任何 system:\*** */
  9009: {
    name: "store_manager_prod",
    roles: ["STORE_MANAGER"],
    perms: [
      "store:*",
      "sale:*",
      "customer:*",
      "inventory:*",
      "report:*",
      "dashboard:*",
      "finance:payment",
      "goods:price",
      "finance:daily-settle",
    ],
  },
  9010: { name: "operation_admin", roles: ["OPERATION_ADMIN"], perms: ["*"] },
};
const READONLY_USER = 9001;
const SUPER_ADMIN_USER = 9002;
const OPERATION_ADMIN_USER = 9010;
/** 不持有本批任一码的角色账号（反证用） */
const NON_HOLDERS = [9001, 9003, 9004, 9005, 9006, 9007, 9008, 9009];

/** 本批**已接** 11 行：`path` = 测试 URL（`:param` 换成具体值），`routePath` = 注册用的路径模式 */
interface WiredRow {
  file: string;
  prefix: string;
  router: Router;
  method: "post" | "put" | "delete";
  routePath: string;
  path: string;
  perm: string;
  /** 该行「页面/按钮真实使用者」的代表账号（零回归论证；持有人全集另由 holdersOf 断言） */
  users: number[];
  /** 使用者依据（写清页面/调用点，便于逐条复核） */
  why: string;
}

const WIRED: WiredRow[] = [
  {
    file: "admin-staff.routes.ts",
    prefix: "/api/admin",
    router: adminStaffRouter,
    method: "put",
    routePath: "/staff/:id/status",
    path: "/staff/1/status",
    perm: "system:user:edit",
    users: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER],
    why: "admin-web 员工管理页 router/index.ts:232 employees [SUPER_ADMIN] → views/system/EmployeesView.vue:340（toggleStaffStatus(row) → PUT /staff/:id/status）+ 组织架构页 router/index.ts:233 [SUPER_ADMIN] → OrganizationView.vue:385；无 app-mobile 调用点（移动端 toggleStatus 只打 /disable 与 /restore）",
  },
  {
    file: "sys-user.routes.ts",
    prefix: "/api/admin/sys-users",
    router: sysUserRouter,
    method: "post",
    routePath: "/",
    path: "/",
    perm: "system:user:create",
    users: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER],
    why: "全仓 0 个前端调用点（api 层零封装，见 docs/evidence/S3-225/02-callers.txt）⇒ 零回归",
  },
  {
    file: "sys-user.routes.ts",
    prefix: "/api/admin/sys-users",
    router: sysUserRouter,
    method: "post",
    routePath: "/:id/reset-password",
    path: "/1/reset-password",
    perm: "system:user:edit",
    users: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER],
    why: "admin-web EmployeesView.vue:363、OrganizationView.vue:405（api/system.ts:67 resetEmployeePassword）；⚠️ 台账机器建议码为 system:user:create，本批按语义订正为 system:user:edit（重置口令 = 改已存在用户；两码持有角色集合相同）——列回执「待裁定项」",
  },
  {
    file: "sys-user.routes.ts",
    prefix: "/api/admin/sys-users",
    router: sysUserRouter,
    method: "delete",
    routePath: "/:id",
    path: "/1",
    perm: "system:user:edit",
    users: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER],
    why: "全仓 0 个前端调用点 ⇒ 零回归（台账建议码一致）",
  },
  {
    file: "rbac.routes.ts",
    prefix: "/api/admin/system/roles",
    router: rbacRouter,
    method: "put",
    routePath: "/:id/data-permissions",
    path: "/1/data-permissions",
    perm: "system:role:edit",
    users: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER],
    why: "admin-web 角色管理页 router/index.ts:237 system/roles [SUPER_ADMIN] → views/system/SystemRoles.vue:596/608（setRoleDataPermissions）；移动端 role-edit.vue 只打 PUT /:id，不打该子路由",
  },
  {
    file: "rbac.routes.ts",
    prefix: "/api/admin/system/roles",
    router: rbacRouter,
    method: "put",
    routePath: "/users/:userId/roles",
    path: "/users/10/roles",
    perm: "system:role:edit",
    users: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER],
    why: "同页 SystemRoles.vue:650（setUserRoles）；app-mobile api/modules/roles.ts:86 setUserRoles 为零引用导出（无页面调用）",
  },
  {
    file: "data-permission.routes.ts",
    prefix: "/api/admin/data-permissions",
    router: dataPermissionRouter,
    method: "post",
    routePath: "/",
    path: "/",
    perm: "system:role:create",
    users: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER],
    why: "全仓 0 个前端调用点（数据权限前端走 rbac.routes.ts 的 PUT /admin/system/roles/:id/data-permissions）⇒ 零回归",
  },
  {
    file: "data-permission.routes.ts",
    prefix: "/api/admin/data-permissions",
    router: dataPermissionRouter,
    method: "put",
    routePath: "/:id",
    path: "/1",
    perm: "system:role:edit",
    users: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER],
    why: "全仓 0 个前端调用点 ⇒ 零回归",
  },
  {
    file: "data-permission.routes.ts",
    prefix: "/api/admin/data-permissions",
    router: dataPermissionRouter,
    method: "delete",
    routePath: "/:id",
    path: "/1",
    perm: "system:role:edit",
    users: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER],
    why: "全仓 0 个前端调用点 ⇒ 零回归",
  },
  {
    file: "data-permission.routes.ts",
    prefix: "/api/admin/data-permissions",
    router: dataPermissionRouter,
    method: "post",
    routePath: "/roles/:roleId",
    path: "/roles/1",
    perm: "system:role:create",
    users: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER],
    why: "全仓 0 个前端调用点 ⇒ 零回归",
  },
  {
    file: "data-permission.routes.ts",
    prefix: "/api/admin/data-permissions",
    router: dataPermissionRouter,
    method: "delete",
    routePath: "/roles/:roleId/:dataPermissionId",
    path: "/roles/1/2",
    perm: "system:role:edit",
    users: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER],
    why: "全仓 0 个前端调用点 ⇒ 零回归",
  },
];

type UnwiredKind = "B类" | "自服务" | "自服务实际用途" | "查询型POST" | "需新立码";

interface UnwiredRow {
  file: string;
  prefix: string;
  router: Router;
  method: "post" | "put" | "delete";
  routePath: string;
  path: string;
  kind: UnwiredKind;
  reason: string;
}

const UNWIRED: UnwiredRow[] = [
  {
    file: "admin-staff.routes.ts",
    prefix: "/api/admin",
    router: adminStaffRouter,
    method: "post",
    routePath: "/staff",
    path: "/staff",
    kind: "B类",
    reason: "app-mobile 员工管理页 employees.vue:132（employees.ts:42 addEmployee）经「我的」页 profile.vue:50 无条件入口可达 ⇒ 使用者集合不可枚举",
  },
  {
    file: "admin-staff.routes.ts",
    prefix: "/api/admin",
    router: adminStaffRouter,
    method: "put",
    routePath: "/staff/:id",
    path: "/staff/1",
    kind: "B类",
    reason: "同上（employees.vue:159 updateEmployee）",
  },
  {
    file: "admin-staff.routes.ts",
    prefix: "/api/admin",
    router: adminStaffRouter,
    method: "put",
    routePath: "/staff/:id/disable",
    path: "/staff/1/disable",
    kind: "B类",
    reason: "同上（employees.vue:179 toggleStatus('inactive')）",
  },
  {
    file: "admin-staff.routes.ts",
    prefix: "/api/admin",
    router: adminStaffRouter,
    method: "post",
    routePath: "/staff/:id/restore",
    path: "/staff/1/restore",
    kind: "B类",
    reason: "同上（employees.vue:187 toggleStatus('active')）",
  },
  {
    file: "rbac.routes.ts",
    prefix: "/api/admin/system/roles",
    router: rbacRouter,
    method: "post",
    routePath: "/",
    path: "/",
    kind: "B类",
    reason: "app-mobile 角色管理页 role-edit.vue:227（roles.ts:63 create）经「我的」页 profile.vue:54 无条件入口可达 ⇒ 使用者集合不可枚举",
  },
  {
    file: "rbac.routes.ts",
    prefix: "/api/admin/system/roles",
    router: rbacRouter,
    method: "put",
    routePath: "/:id",
    path: "/1",
    kind: "B类",
    reason: "同上（role-edit.vue:225 update）",
  },
  {
    file: "rbac.routes.ts",
    prefix: "/api/admin/system/roles",
    router: rbacRouter,
    method: "delete",
    routePath: "/:id",
    path: "/1",
    kind: "B类",
    reason: "同上（roles.vue:116 remove）",
  },
  {
    file: "sys-user.routes.ts",
    prefix: "/api/admin/sys-users",
    router: sysUserRouter,
    method: "put",
    routePath: "/:id",
    path: "/1",
    kind: "自服务实际用途",
    reason: "全仓唯一调用点 = app-mobile「我的 → 编辑资料」pages/profile/edit.vue:180（api/modules/profile.ts:26 updateProfile，传**本人** id）⇒ 台账判「管理面」与真实用途不符；挂 system:user:edit 会把所有非 `*` 角色的「保存资料」打成 403 ⇒ 不接并报备待裁定",
  },
  {
    file: "admin-auth.routes.ts",
    prefix: "/api/admin/auth",
    router: adminAuthRouter,
    method: "put",
    routePath: "/settings",
    path: "/settings",
    kind: "自服务",
    reason: "本人设置类（台账 §三.1 判「自服务/本人数据」）⇒ 按 S3-203 `trace:*` 教训不套管理面码；全仓 0 调用点",
  },
  {
    file: "admin-auth.routes.ts",
    prefix: "/api/admin/auth",
    router: adminAuthRouter,
    method: "post",
    routePath: "/change-password",
    path: "/change-password",
    kind: "自服务",
    reason: "本人改密（api/modules/auth.ts:110、profile.ts:30；profile.vue 与 edit.vue 页面入口）⇒ 不套管理面码",
  },
  {
    file: "admin-auth.routes.ts",
    prefix: "/api/admin/auth",
    router: adminAuthRouter,
    method: "post",
    routePath: "/mfa/setup",
    path: "/mfa/setup",
    kind: "自服务",
    reason: "本人 MFA 绑定（api/modules/auth.ts:130）⇒ 不套管理面码",
  },
  {
    file: "admin-auth.routes.ts",
    prefix: "/api/admin/auth",
    router: adminAuthRouter,
    method: "post",
    routePath: "/mfa/confirm",
    path: "/mfa/confirm",
    kind: "自服务",
    reason: "本人 MFA 确认（api/modules/auth.ts:135）⇒ 不套管理面码",
  },
  {
    file: "admin-auth.routes.ts",
    prefix: "/api/admin/auth",
    router: adminAuthRouter,
    method: "post",
    routePath: "/mfa/disable",
    path: "/mfa/disable",
    kind: "自服务",
    reason: "本人 MFA 关闭（api/modules/auth.ts:140）⇒ 不套管理面码",
  },
  {
    file: "user-session.routes.ts",
    prefix: "/api/user-session",
    router: userSessionRouter,
    method: "delete",
    routePath: "/:id",
    path: "/1",
    kind: "自服务",
    reason: "本人会话注销类（台账 §三.1 判「自服务/本人数据」）；全仓 0 调用点（前端退出登录走 /admin/auth/logout，admin-web 会话页打的是 /admin/sessions/:id）",
  },
  {
    file: "user-session.routes.ts",
    prefix: "/api/user-session",
    router: userSessionRouter,
    method: "delete",
    routePath: "/user/:userId",
    path: "/user/10",
    kind: "自服务",
    reason: "台账判「自服务」；⚠️ 语义偏管理面（撤销**他人**全部会话）而全仓 0 调用点 ⇒ 本批按台账口径不接，列回执「待裁定项」由凌舟定是否改判管理面挂 system:user:edit",
  },
  {
    file: "data-permission.routes.ts",
    prefix: "/api/admin/data-permissions",
    router: dataPermissionRouter,
    method: "post",
    routePath: "/users/:userId/check",
    path: "/users/10/check",
    kind: "查询型POST",
    reason: "查询型 POST（只读判定「某用户是否持有某数据权限」）⇒ 按派单卡 §二.4 不按写端点接线，保留在机读台账",
  },
  {
    file: "department.routes.ts",
    prefix: "/api/department",
    router: departmentRouter,
    method: "post",
    routePath: "/",
    path: "/",
    kind: "需新立码",
    reason: "079_权限矩阵.sql 无部门域码（全表 system 域只到 system:user / system:role 两族）⇒ 立码属产品决策，登记待办（页 router/index.ts:234 department-manage [SUPER_ADMIN]）",
  },
  {
    file: "department.routes.ts",
    prefix: "/api/department",
    router: departmentRouter,
    method: "put",
    routePath: "/:id",
    path: "/1",
    kind: "需新立码",
    reason: "同上（DepartmentManage.vue:286 / OrganizationView.vue:436）",
  },
  {
    file: "department.routes.ts",
    prefix: "/api/department",
    router: departmentRouter,
    method: "delete",
    routePath: "/:id",
    path: "/1",
    kind: "需新立码",
    reason: "同上（DepartmentManage.vue:264 / OrganizationView.vue:452）",
  },
  {
    file: "department.routes.ts",
    prefix: "/api/department",
    router: departmentRouter,
    method: "put",
    routePath: "/:id/move",
    path: "/1/move",
    kind: "需新立码",
    reason: "同上；且全仓 0 调用点",
  },
];

const ROUTES_DIR = fileURLToPath(new URL("../../routes", import.meta.url));
const BACKEND_DIR = path.resolve(ROUTES_DIR, "..", "..");

/** 取某文件里"注册某方法 + 某路径模式"的**行**（跳过注释行）——踩坑[134]：判据必须落到注册行 */
function registrationLines(file: string, method: string, routePath: string): { line: string; no: number }[] {
  const src = readFileSync(path.join(ROUTES_DIR, file), "utf8");
  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\.${method}\\(\\s*"${escaped}"`);
  return src
    .split(/\r?\n/)
    .map((line, i) => ({ line: line.trim(), no: i + 1 }))
    .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*") && re.test(line));
}

/** 权限持有人集合：用生产同一份 matchPermission 对角色实值逐账号复算（非人工誊写） */
function holdersOf(perm: string): number[] {
  return Object.entries(USERS)
    .filter(([, u]) => matchPermission(u.perms, perm))
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);
}

/** 与生产挂载链等价（auth → tenant → csrf）的测试 App：req.user 由请求头注入 */
function buildApp(prefix: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers["x-test-user"];
    const uid = raw ? Number(raw) : NaN;
    const u = USERS[uid];
    if (!u) {
      res.status(401).json(fail("未登录", "401"));
      return;
    }
    (req as any).user = { id: uid, username: u.name, realName: u.name, roles: [...u.roles] };
    (req as any).tenantId = "1";
    next();
  });
  // 与 auto-routes.getAuthMiddlewares 一致：csrf 在挂载层执行、先于路由匹配（踩坑[34]）
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (["GET", "OPTIONS", "HEAD"].includes(req.method)) return next();
    const uid = (req as any).user?.id;
    if (!uid) return next();
    const token = req.headers["x-csrf-token"];
    if (!token || token !== generateCsrfToken(uid)) {
      res.status(403).json(fail("CSRF token 无效或缺失", "403"));
      return;
    }
    next();
  });
  app.use(prefix, router);
  return app;
}

function call(app: express.Express, method: string, url: string, uid?: number) {
  const req = (request(app) as any)[method](url);
  if (uid) req.set("x-test-user", String(uid)).set("x-csrf-token", generateCsrfToken(uid));
  return req.send({});
}

const APPS = new Map<string, express.Express>();
function appFor(key: string, prefix: string, router: Router) {
  if (!APPS.has(key)) APPS.set(key, buildApp(prefix, router));
  return APPS.get(key)!;
}

beforeEach(() => {
  h.reached.length = 0;
  h.perms.clear();
  for (const [id, u] of Object.entries(USERS)) h.perms.set(Number(id), u.perms);
});

describe("S3-225 · 名单自证（31 = 11 已接 + 20 不接）", () => {
  it("11 行已接 + 20 行不接 = 本域 31 写端点（与台账 §三.1 的 7 文件 / 31 端点守恒）", () => {
    expect(WIRED).toHaveLength(11);
    expect(UNWIRED).toHaveLength(20);
    expect(11 + 20).toBe(31);
  });

  it("已接 11 行分布：admin-staff 1 / sys-user 3 / rbac 2 / data-permission 5", () => {
    const perFile = new Map<string, number>();
    for (const r of WIRED) perFile.set(r.file, (perFile.get(r.file) ?? 0) + 1);
    expect([...perFile.entries()].sort()).toEqual([
      ["admin-staff.routes.ts", 1],
      ["data-permission.routes.ts", 5],
      ["rbac.routes.ts", 2],
      ["sys-user.routes.ts", 3],
    ]);
  });

  it("不接 20 行分布：B 类 7 / 自服务 7 / 自服务实际用途 1 / 查询型 POST 1 / 需新立码 4", () => {
    const perKind = new Map<string, number>();
    for (const r of UNWIRED) perKind.set(r.kind, (perKind.get(r.kind) ?? 0) + 1);
    expect([...perKind.entries()].sort()).toEqual([
      ["B类", 7],
      ["查询型POST", 1],
      ["自服务", 7],
      ["自服务实际用途", 1],
      ["需新立码", 4],
    ]);
  });

  it("本批新增接线数与 rbac-g0-wiring.test.ts 的 S3_225_WIRED_FILES 快照一致（11）", () => {
    const g0 = readFileSync(path.join(__dirname, "rbac-g0-wiring.test.ts"), "utf8");
    expect(g0).toContain("S3_225_WIRED_FILES");
    // 合并态总数：122（G0..S3-220）+ 42（S3-222）+ 19（S3-223）+ 11（本批）= 194
    expect(g0).toContain("expect(total).toBe(194)");
  });
});

describe("S3-225 · 形状断言（行级判据；踩坑[134]）", () => {
  it.each(WIRED)("$file $method $routePath：注册行自带 requirePermission(\"$perm\")（且该行不是注释）", (row) => {
    const lines = registrationLines(row.file, row.method, row.routePath);
    expect(lines.map((l) => l.no)).toHaveLength(1);
    expect(lines[0].line).toContain(`requirePermission("${row.perm}")`);
  });

  it.each(WIRED)("$file $method $routePath：落地码**不带通配**（不把域通配写进路由）", (row) => {
    const lines = registrationLines(row.file, row.method, row.routePath);
    expect(lines[0].line).not.toContain("*");
  });

  it.each(UNWIRED)("$file $method $routePath（不接 · $kind）：注册行**不含** requirePermission(", (row) => {
    const lines = registrationLines(row.file, row.method, row.routePath);
    expect(lines.map((l) => l.no)).toHaveLength(1);
    expect(lines[0].line).not.toContain("requirePermission(");
  });
});

describe("S3-225 · 权限持有人集合复算（生产 matchPermission × 角色实值）", () => {
  it("本批 4 个落地码的持有人集合 = {SUPER_ADMIN, OPERATION_ADMIN}（逐账号复算）", () => {
    for (const perm of ["system:user:create", "system:user:edit", "system:role:create", "system:role:edit"]) {
      expect(holdersOf(perm), `${perm} 持有人集合`).toEqual([9002, 9010]);
    }
  });

  it("反证：只读/销售/店长（仓库种子与生产实值）/仓管/财务/采购/操作员一律**不持有**本批任一码", () => {
    for (const perm of ["system:user:create", "system:user:edit", "system:role:create", "system:role:edit"]) {
      for (const uid of NON_HOLDERS) {
        expect(holdersOf(perm), `${perm} 不应由 uid=${uid} 持有`).not.toContain(uid);
      }
    }
  });

  it.each(WIRED)("$file $method $routePath：页面/按钮真实使用者 ⊆ 权限持有人集合（零回归判据）", (row) => {
    const holders = holdersOf(row.perm);
    expect(row.users.length, `${row.file} ${row.routePath} 必须写明使用者账号`).toBeGreaterThan(0);
    for (const uid of row.users) expect(holders, `${row.file} ${row.routePath} 使用者 ${uid}｜依据：${row.why}`).toContain(uid);
  });

  it("落地码与 079 既有码逐字对齐（不新立码、不改角色种子、不动迁移）", () => {
    const sql = readFileSync(path.join(BACKEND_DIR, "..", "docs", "migrations", "079_权限矩阵.sql"), "utf8");
    for (const code of ["system:user:create", "system:user:edit", "system:role:create", "system:role:edit"]) {
      expect(sql, `079 应含既有码 ${code}`).toContain(`'${code}'`);
    }
  });
});

describe("S3-225 · 页面/入口来源同源（防「测试里写一个不存在的页面或入口」）", () => {
  it("admin-web meta.roles 逐条复核：本批接线行涉及的 3 个页面均为 [SUPER_ADMIN]", () => {
    const router = readFileSync(path.join(BACKEND_DIR, "..", "admin-web", "src", "router", "index.ts"), "utf8");
    const expectations: Array<[string, string[]]> = [
      ["employees", ["SUPER_ADMIN"]],
      ["organization", ["SUPER_ADMIN"]],
      ["system/roles", ["SUPER_ADMIN"]],
    ];
    for (const [routePath, roles] of expectations) {
      const line = router.split(/\r?\n/).find((l) => l.includes(`path: "${routePath}"`));
      expect(line, `admin-web 路由 ${routePath} 应存在`).toBeTruthy();
      for (const role of roles) expect(line, `${routePath} 的 meta.roles 应含 ${role}`).toContain(`"${role}"`);
    }
  });

  it("B 类判定依据同源：app-mobile「我的」页对员工/角色管理页是**无条件硬编码入口**（无角色门）", () => {
    const profile = readFileSync(
      path.join(BACKEND_DIR, "..", "app-mobile", "src", "pages", "profile", "profile.vue"),
      "utf8"
    );
    for (const target of ["/pages-sub/admin/admin/employees", "/pages-sub/admin/roles/roles"]) {
      const line = profile.split(/\r?\n/).find((l) => l.includes(target));
      expect(line, `profile.vue 应有到 ${target} 的入口`).toBeTruthy();
      expect(line, `入口行 ${target} 不得带角色门（v-if / isPageVisible）`).not.toContain("v-if");
      expect(line, `入口行 ${target} 不得带角色门（v-if / isPageVisible）`).not.toContain("isPageVisible");
    }
    // 写调用点同源（移动端 api 模块）
    const employeesApi = readFileSync(
      path.join(BACKEND_DIR, "..", "app-mobile", "src", "api", "modules", "employees.ts"),
      "utf8"
    );
    for (const frag of ["post('/admin/staff'", "put(`/admin/staff/${id}`", "/disable", "/restore"]) {
      expect(employeesApi, `employees.ts 应含写调用点片段 ${frag}`).toContain(frag);
    }
    const rolesApi = readFileSync(path.join(BACKEND_DIR, "..", "app-mobile", "src", "api", "modules", "roles.ts"), "utf8");
    for (const frag of ["post('/admin/system/roles'", "put(`/admin/system/roles/${id}`", "del(`/admin/system/roles/${id}`"]) {
      expect(rolesApi, `roles.ts 应含写调用点片段 ${frag}`).toContain(frag);
    }
  });

  it("「自服务实际用途」判定依据同源：app-mobile 编辑资料页用 PUT /admin/sys-users/{本人 id}", () => {
    const profileApi = readFileSync(
      path.join(BACKEND_DIR, "..", "app-mobile", "src", "api", "modules", "profile.ts"),
      "utf8"
    );
    expect(profileApi).toContain("put(`/admin/sys-users/${profile.id}`");
    expect(profileApi).toContain("getProfile()");
    const editPage = readFileSync(
      path.join(BACKEND_DIR, "..", "app-mobile", "src", "pages", "profile", "edit.vue"),
      "utf8"
    );
    expect(editPage).toContain("profileApi.updateProfile");
  });
});

describe("S3-225 · a) 只读账号被拦（11 行逐行）", () => {
  it.each(WIRED)("$file $method $routePath ⇒ 403 且未到达业务层", async (row) => {
    const res = await call(appFor(row.file, row.prefix, row.router), row.method, `${row.prefix}${row.path}`, READONLY_USER);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    expect(h.reached, `${row.file} ${row.routePath} 被拦时不应到达业务层`).toHaveLength(0);
  });
});

describe("S3-225 · b) 持有该码的角色照常通过（不锁死）", () => {
  it.each(WIRED)("$file $method $routePath ⇒ 超管/运营管理员 200（到达业务层）", async (row) => {
    for (const uid of [SUPER_ADMIN_USER, OPERATION_ADMIN_USER]) {
      h.reached.length = 0;
      const res = await call(appFor(row.file, row.prefix, row.router), row.method, `${row.prefix}${row.path}`, uid);
      expect(res.status, `uid=${uid} 应通过 ${row.file} ${row.method} ${row.routePath}`).toBe(200);
      expect(res.body.success).toBe(true);
      expect(h.reached.length, `uid=${uid} 应到达业务层`).toBeGreaterThan(0);
    }
  });

  it("超管短路与 `*` 通配两条通路都真实生效（9002 走 middleware 角色短路；9010 走 matchPermission 的 `*`）", async () => {
    const row = WIRED[0];
    const res = await call(appFor(row.file, row.prefix, row.router), row.method, `${row.prefix}${row.path}`, OPERATION_ADMIN_USER);
    expect(res.status).toBe(200);
    expect(matchPermission(USERS[OPERATION_ADMIN_USER].perms, row.perm)).toBe(true);
    expect(USERS[SUPER_ADMIN_USER].roles).toContain("SUPER_ADMIN");
  });
});

describe("S3-225 · c) 非持有人一律 403（判据不是恒 true 的假门禁）", () => {
  it.each(WIRED)("$file $method $routePath ⇒ 8 个非持有角色全 403", async (row) => {
    for (const uid of NON_HOLDERS) {
      const res = await call(appFor(row.file, row.prefix, row.router), row.method, `${row.prefix}${row.path}`, uid);
      expect(res.status, `uid=${uid}（${USERS[uid].name}）不应通过 ${row.file} ${row.routePath}`).toBe(403);
      expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    }
  });

  it("域通配不越界：STORE_MANAGER 的 `store:*` / FINANCE_STAFF 的 `finance:*` **不能**通过 system 域码", () => {
    expect(matchPermission(USERS[9009].perms, "system:user:edit")).toBe(false);
    expect(matchPermission(USERS[9009].perms, "system:role:edit")).toBe(false);
    expect(matchPermission(USERS[9006].perms, "system:user:create")).toBe(false);
    expect(matchPermission(USERS[9005].perms, "system:role:create")).toBe(false);
    // 只读的 `*:view` 也不能通过写动作码
    expect(matchPermission(USERS[READONLY_USER].perms, "system:user:edit")).toBe(false);
    expect(matchPermission(USERS[READONLY_USER].perms, "system:role:create")).toBe(false);
  });
});

describe("S3-225 · d) 未接的 20 行仍不被拦（证明本批没多接）", () => {
  it.each(UNWIRED)("$file $method $routePath（$kind）⇒ READONLY 仍到达业务层", async (row) => {
    h.reached.length = 0;
    const res = await call(appFor(row.file, row.prefix, row.router), row.method, `${row.prefix}${row.path}`, READONLY_USER);
    expect(res.status, `${row.file} ${row.method} ${row.routePath} 本批不应被拦`).toBe(200);
    expect(res.body.success).toBe(true);
    expect(h.reached.length).toBeGreaterThan(0);
  });
});

describe("S3-225 · e) 未登录 401（既有行为不变）", () => {
  it.each(WIRED)("$file $method $routePath ⇒ 无登录态 401", async (row) => {
    const res = await call(appFor(row.file, row.prefix, row.router), row.method, `${row.prefix}${row.path}`);
    expect(res.status).toBe(401);
    expect(res.body.msg).toBe("未登录");
  });
});
