/**
 * S3-209 · 销售单取消端点的**权限接线**验收测试
 *
 * 派单卡：docs/tasks/inbox/ACTIVE-S3-209.md §三.5（无 `sale:cancel` 的角色 ⇒ 403；有码 ⇒ 通过）
 *
 * 保真度（与 rbac-g1/g2-wiring.test.ts 同口径）：
 *   · 真：路由文件与其注册行、`requirePermission` 中间件本体、真实 `matchPermission`
 *     （含 `*` / `<dom>:*` / `*:<action>` 三种通配语义）、CSRF 挂载顺序、`routeConfig.auth` 声明；
 *   · 桩：`checkUserPermission` 的**数据库读取**（用生产角色实值权限串喂真实匹配器）、控制器
 *     （只记录"请求是否到达业务层"）、登录态（生产由 requireAuth 从 JWT 取，本测试用请求头注入 ——
 *     见 `docs/evidence/S3-209/harness.mjs` 的真库真 HTTP 版本）。
 *
 * 反测（门禁铁律）：摘掉 `admin-order.routes.ts` 该行的 `requirePermission(PERM_SALE_CANCEL)`
 *   ⇒「无码角色 ⇒ 403」三条用例必红（会变成 200）；复原后回绿。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCsrfToken } from "../../middleware/csrf";
import { fail } from "../../shared/response";

const h = vi.hoisted(() => {
  /** 控制器到达记录（= 请求穿过了权限门禁） */
  const reached: string[] = [];
  /** userId → 角色权限串（等价于 t_sys_role.permissions） */
  const perms = new Map<number, string[]>();
  const stub = () => {
    const cache = new Map<string, unknown>();
    return new Proxy(
      {},
      {
        get(_t, prop) {
          if (typeof prop === "symbol" || prop === "then" || prop === "catch" || prop === "finally") {
            return undefined;
          }
          const key = String(prop);
          if (!cache.has(key)) {
            cache.set(key, (req: any, res: any) => {
              reached.push(key);
              res.json({ success: true, code: "0", msg: "成功", handler: key, params: req.params ?? {} });
            });
          }
          return cache.get(key);
        },
        has(_t, prop) {
          return typeof prop !== "symbol";
        },
      }
    );
  };
  return { reached, perms, stub };
});

vi.mock("@controllers/admin/order.controller", () => h.stub());

vi.mock("@services/admin/rbac.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@services/admin/rbac.service")>();
  return {
    ...actual,
    checkUserPermission: async (userId: number, _tenantId: number, permCode: string) =>
      actual.matchPermission(h.perms.get(userId) ?? [], permCode),
  };
});

import { PERM_SALE_CANCEL } from "../../shared/sale-permission-codes";
import { adminOrderRouter, routeConfig as adminOrderRouteConfig } from "../../routes/admin-order.routes";

/**
 * 权限串取**生产角色实值**口径（与 rbac-g1/g2-wiring.test.ts 的 USERS 同源：
 * 079 角色种子 + docs/ops/S3-122-F4-finance-daily-settle.sql 头注的生产实值）。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[] }> = {
  /** 只读观察员：["*:view"] ⇒ 动作通配只命中 `:view` 结尾的码，**不**命中 sale:cancel */
  9101: { name: "readonly", roles: ["READONLY"], perms: ["*:view"] },
  9102: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"] },
  /** 销售员：精确码 sale:create / sale:view，**无** sale:cancel */
  9103: {
    name: "sales_staff",
    roles: ["SALES_STAFF"],
    perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"],
  },
  /** 门店操作员（F4 订正后的生产实值）：有 sale:create/sale:return，**无** sale:cancel */
  9104: {
    name: "store_operator",
    roles: ["STORE_OPERATOR"],
    perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"],
  },
  /** 只持精确码 sale:cancel 的账号（"有码 ⇒ 通过"的**最小授权**证明） */
  9105: { name: "cancel_only", roles: ["CUSTOM"], perms: ["sale:cancel"] },
  /** 门店店长**生产实值**（sale:* 域通配 ⇒ 命中 sale:cancel） */
  9106: {
    name: "store_manager_prod",
    roles: ["STORE_MANAGER"],
    perms: [
      "store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*",
      "finance:payment", "goods:price", "finance:daily-settle",
    ],
  },
  /** 对照组：持 sale:void（079 既有码）但**不持** sale:cancel ⇒ 证明判据不是"sale: 前缀"而是具体码 */
  9107: { name: "sale_void_holder", roles: ["CUSTOM"], perms: ["sale:view", "sale:void"] },
};

const ROUTES_DIR = fileURLToPath(new URL("../../routes", import.meta.url));
/** 对外 URL = 生产前缀 /api/admin ＋ 路由文件的注册路径（与 routes/admin-order.routes.ts 的 routeConfig 一致） */
const CANCEL_PATH = "/api/admin/sale-bills/XS202610150001/cancel";

function buildApp() {
  const app = express();
  app.use(express.json());
  // 与生产挂载链等价：requireAuthWithTenant（认证 + 租户）→ csrfMiddleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers["x-test-user"];
    const uid = raw ? Number(raw) : NaN;
    const u = USERS[uid];
    if (!u) {
      res.status(401).json(fail("未登录", "401"));
      return;
    }
    (req as any).user = { id: uid, username: u.name, realName: u.name, roles: [...u.roles] };
    (req as any).tenantId = "default";
    next();
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers["x-test-user"];
    const uid = raw ? Number(raw) : NaN;
    if (!uid) return next();
    const token = req.headers["x-csrf-token"];
    if (!token || token !== generateCsrfToken(uid)) {
      res.status(403).json(fail("CSRF token 无效或缺失", "403"));
      return;
    }
    next();
  });
  app.use("/api/admin", adminOrderRouter);
  return app;
}

const app = buildApp();

function callCancel(uid?: number) {
  const req = request(app).post(CANCEL_PATH);
  if (uid) req.set("x-test-user", String(uid)).set("x-csrf-token", generateCsrfToken(uid));
  return req.send({ reason: "客户不要了", source: "ai" });
}

/** 取某文件里"注册某方法 + 某路径模式"的**注册行**（跳过注释行）——踩坑[134]：判据必须落到注册行 */
function registrationLines(file: string, method: "get" | "post", routePath: string): { line: string; no: number }[] {
  const src = readFileSync(path.join(ROUTES_DIR, file), "utf8");
  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\.${method}\\(\\s*"${escaped}"`);
  return src
    .split(/\r?\n/)
    .map((line, i) => ({ line: line.trim(), no: i + 1 }))
    .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*") && re.test(line));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.reached.length = 0;
  h.perms.clear();
  for (const [uid, u] of Object.entries(USERS)) h.perms.set(Number(uid), u.perms);
});

describe("S3-209 · POST /api/admin/sale-bills/:billNo/cancel 权限门禁", () => {
  it("未登录 ⇒ 401（认证先于授权）", async () => {
    const res = await request(app).post(CANCEL_PATH).send({});
    expect(res.status).toBe(401);
    expect(h.reached).toEqual([]);
  });

  it("READONLY（[\"*:view\"]，无 sale:cancel）⇒ 403 且**未到达**控制器", async () => {
    const res = await callCancel(9101);
    expect(res.status).toBe(403);
    expect(String(res.body?.msg)).toContain("sale:cancel");
    expect(h.reached).toEqual([]);
  });

  it("SALES_STAFF（sale:create/sale:view 精确码）⇒ 403", async () => {
    const res = await callCancel(9103);
    expect(res.status).toBe(403);
    expect(h.reached).toEqual([]);
  });

  it("STORE_OPERATOR（生产实值，无 sale:*）⇒ 403", async () => {
    const res = await callCancel(9104);
    expect(res.status).toBe(403);
    expect(h.reached).toEqual([]);
  });

  it("持 sale:void（079 既有码）但无 sale:cancel ⇒ 403（判据落到具体码，不是 sale: 前缀）", async () => {
    const res = await callCancel(9107);
    expect(res.status).toBe(403);
    expect(h.reached).toEqual([]);
  });

  it("精确持码 sale:cancel ⇒ 200 且到达控制器（最小授权）", async () => {
    const res = await callCancel(9105);
    expect(res.status).toBe(200);
    expect(h.reached).toEqual(["cancelSaleBill"]);
    expect(res.body?.handler).toBe("cancelSaleBill");
    expect(res.body?.params?.billNo).toBe("XS202610150001");
  });

  it("STORE_MANAGER 生产实值（sale:* 域通配）⇒ 200（卡面：店长可取消，符合业务）", async () => {
    const res = await callCancel(9106);
    expect(res.status).toBe(200);
    expect(h.reached).toEqual(["cancelSaleBill"]);
  });

  it("SUPER_ADMIN（`*`）⇒ 200", async () => {
    const res = await callCancel(9102);
    expect(res.status).toBe(200);
    expect(h.reached).toEqual(["cancelSaleBill"]);
  });

  it("CSRF 缺失 ⇒ 403（写方法不接受无令牌请求，与生产挂载链一致）", async () => {
    const res = await request(app)
      .post(CANCEL_PATH)
      .set("x-test-user", "9102")
      .send({ reason: "x" });
    expect(res.status).toBe(403);
    expect(h.reached).toEqual([]);
  });
});

describe("S3-209 · 注册行形状断言（踩坑[134]：判据落在注册行，不看注释）", () => {
  it("cancel 注册行含 requirePermission(PERM_SALE_CANCEL)，且常量值就是 sale:cancel", async () => {
    expect(PERM_SALE_CANCEL).toBe("sale:cancel");
    const lines = registrationLines("admin-order.routes.ts", "post", "/sale-bills/:billNo/cancel");
    expect(lines).toHaveLength(1);
    expect(lines[0].line).toContain("requirePermission(PERM_SALE_CANCEL)");
    expect(lines[0].line).toContain("orderController.cancelSaleBill");
  });

  it("同前缀的既有写端点未接线（对照：证明形状断言有分辨力）", async () => {
    const unwired = registrationLines("admin-order.routes.ts", "post", "/orders/:orderNo/cancel");
    expect(unwired).toHaveLength(1);
    expect(unwired[0].line).not.toContain("requirePermission");
  });

  it("routeConfig.auth = requireAuthWithTenant（认证 + 租户隔离 + CSRF，不走 none 旁路）", () => {
    expect(adminOrderRouteConfig.auth).toBe("requireAuthWithTenant");
    expect(adminOrderRouteConfig.prefix).toBe("/api/admin");
  });
});
