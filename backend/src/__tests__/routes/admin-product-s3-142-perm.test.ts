/**
 * S3-142 · 手工建品（POST /api/admin/products）权限接线验收测试
 *
 * 证明三件事（对应派单卡「验收标准（硬）」①）：
 *   a) 无 `goods:create` 的账号（READONLY = `["*:view"]`）⇒ **403**，且**未到达业务层**；
 *   b) 持 `goods:create` 的账号 / SUPER_ADMIN（`["*"]`）⇒ 通过权限判定并**到达业务层**；
 *   c) 未登录 ⇒ **401**（既有认证行为不变，认证先于权限）。
 *
 * 保真度说明：
 *   · 真：`routes/admin-product.routes.ts` 的注册顺序、`requirePermission` 中间件本体、
 *        `matchPermission` 匹配器（含 `*` / `*:action` 语义）、CSRF 校验顺序（生产在挂载层、先于路由匹配）。
 *   · 桩：角色权限串的数据库读取（用 079 种子口径喂真实匹配器）、控制器（只记录"请求是否到达业务层"）、
 *        登录态（生产由 requireAuth 从 JWT 取，本测试用请求头注入）。
 *
 * 反测（门禁铁律）：临时摘掉 `POST /products` 的 `requirePermission(PERM_GOODS_CREATE)` ⇒
 *   本文件 `READONLY ⇒ 403` 用例必红。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import type { Request, Response, NextFunction } from "express";
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
          if (typeof prop === "symbol" || prop === "then" || prop === "catch" || prop === "finally") return undefined;
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

// 控制器全部打桩：本文件只关心"有没有被权限门禁拦住"
vi.mock("@controllers/admin/product.controller", () => h.stub());
vi.mock("@controllers/admin/product-image.controller", () => h.stub());
vi.mock("@controllers/admin/stock-warning.controller", () => h.stub());
vi.mock("@controllers/admin/category.controller", () => h.stub());

// 权限判定：数据库读取打桩，匹配逻辑用真实 matchPermission
vi.mock("@services/admin/rbac.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@services/admin/rbac.service")>();
  return {
    ...actual,
    checkUserPermission: async (userId: number, _tenantId: number, permCode: string) =>
      actual.matchPermission(h.perms.get(userId) ?? [], permCode),
  };
});

import { adminProductRouter } from "../../routes/admin-product.routes";

/** 测试账号：权限串照抄 `docs/migrations/079_权限矩阵.sql` 的角色种子口径 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[] }> = {
  9001: { name: "smoke_bot", roles: ["READONLY"], perms: ["*:view"] },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"] },
  // 079 权限矩阵：店长/管理员持 goods:create（新增商品）
  9004: { name: "store_manager", roles: ["STORE_MANAGER"], perms: ["store:*", "goods:create", "goods:edit"] },
  9003: { name: "sales_staff", roles: ["SALES_STAFF"], perms: ["sale:create", "sale:view"] },
};
const READONLY_USER = 9001;
const SUPER_ADMIN_USER = 9002;
const GOODS_CREATE_USER = 9004;

function buildApp() {
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
  app.use("/api/admin", adminProductRouter);
  return app;
}

function callCreate(uid?: number) {
  const req = request(buildApp()).post("/api/admin/products");
  if (uid) req.set("x-test-user", String(uid)).set("x-csrf-token", generateCsrfToken(uid));
  return req.send({ name: "S3-142 手建商品" });
}

beforeEach(() => {
  h.reached.length = 0;
  h.perms.clear();
  for (const [id, u] of Object.entries(USERS)) h.perms.set(Number(id), u.perms);
});

describe("S3-142 建品权限接线 · 无权限被拦（未到达业务层）", () => {
  it("READONLY（*:view）调 POST /api/admin/products ⇒ 403 + 点名 goods:create，且未到达业务层", async () => {
    const res = await callCreate(READONLY_USER);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toBe("无权限执行此操作，需要权限: goods:create");
    expect(res.body.handler).toBeUndefined();
    expect(h.reached).toEqual([]);
  });

  it("SALES_STAFF（无 goods:create）⇒ 同样 403（证明拦的是 goods:create，不是某个特定角色）", async () => {
    const res = await callCreate(9003);
    expect(res.status).toBe(403);
    expect(res.body.msg).toBe("无权限执行此操作，需要权限: goods:create");
    expect(h.reached).toEqual([]);
  });

  it("无登录态 ⇒ 401（认证先于权限；既有行为不变）", async () => {
    const res = await callCreate();
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
    expect(res.body.msg).toBe("未登录");
    expect(h.reached).toEqual([]);
  });
});

describe("S3-142 建品权限接线 · 有权角色照常通过（不锁死）", () => {
  it("持 goods:create（STORE_MANAGER）⇒ 到达业务层", async () => {
    const res = await callCreate(GOODS_CREATE_USER);
    expect(res.status).toBe(200);
    expect(res.body.handler).toBe("createProduct");
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("SUPER_ADMIN（[\"*\"]）⇒ 到达业务层", async () => {
    const res = await callCreate(SUPER_ADMIN_USER);
    expect(res.status).toBe(200);
    expect(res.body.handler).toBe("createProduct");
  });
});
