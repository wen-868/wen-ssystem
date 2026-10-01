/**
 * R101-C6-4-1：COPY 调取端点「注册 + 权限接线」测试
 *
 * 保真度（哪些是真的、哪些是桩）：
 *  · 真：两个真实路由文件（routes/admin-library.routes.ts、routes/platform-library.routes.ts）与其注册路径/顺序、
 *        requirePermission 中间件本体、matchPermission 匹配器（* / dom:* / *:action 语义）、requirePlatformAuth 本体、
 *        生产挂载链等价的 csrf 顺序（挂载层、先于路由匹配）。
 *  · 桩：控制器（只记录"请求是否到达业务层"）、checkUserPermission 的**数据库读取**（用 079 种子权限串喂真实匹配器）。
 *
 * 断言四件事：
 *  ① 租户侧 4 条端点全部注册在既有前缀 /api/admin/library（不新开前缀，不造动作动词路径）
 *  ② 只读角色 READONLY（["*:view"]）⇒ 3 条读端点 200、写端点 403 且**未到达业务层**（读写分离的机制证明）
 *  ③ 无 library 域权限的 SALES_STAFF ⇒ 4 条全 403；持权角色 ⇒ 4 条全 200；未登录 ⇒ 401
 *  ④ 平台侧 4 条注册 + P5（stats/category-dist）**未注册**（Q9：无类目载体）⇒ 带平台令牌得 404
 *
 * 反测（门禁铁律）：摘掉 POST /copies 的 requirePermission(PERM_LIBRARY_COPY) ⇒ READONLY 用例必红；
 *   把权限码从代码常量换成字面量以外的任意值 ⇒ 持权角色用例必红。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import type { Router, Request, Response, NextFunction } from "express";
import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "node:url";
import { generateCsrfToken } from "../../middleware/csrf";
import { fail } from "../../shared/response";

const h = vi.hoisted(() => {
  /** 到达业务层（控制器被调用）的 handler 名 */
  const reached: string[] = [];
  /** userId → 角色权限串（等价 t_sys_role.permissions） */
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
              res.json({ code: "0", msg: "成功", handler: key });
            });
          }
          return cache.get(key);
        },
        has() {
          return true;
        },
      }
    );
  };
  return { reached, perms, stub };
});

vi.mock("@controllers/admin/library-copy.controller", () => h.stub());
vi.mock("@controllers/admin/library.controller", () => h.stub());
vi.mock("@controllers/platform/library.controller", () => h.stub());
vi.mock("@controllers/platform/library-call-log.controller", () => h.stub());

// 权限判定：数据库读取打桩（数据取 079 种子口径），匹配逻辑用真实 matchPermission
vi.mock("@services/admin/rbac.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@services/admin/rbac.service")>();
  return {
    ...actual,
    checkUserPermission: async (userId: number, _tenantId: number, permCode: string) =>
      actual.matchPermission(h.perms.get(userId) ?? [], permCode),
  };
});

import { adminLibraryRouter, routeConfig as adminLibraryRouteConfig } from "../../routes/admin-library.routes";
import {
  platformLibraryRouter,
  routeConfig as platformLibraryRouteConfig,
} from "../../routes/platform-library.routes";

/** 测试账号：只读/超管照抄 079 种子；两个持权角色按立项草案 §5.3 授权表补 library:view + library:copy */
const USERS: Record<number, { name: string; roles: string[]; perms: string[] }> = {
  9101: { name: "readonly", roles: ["READONLY"], perms: ["*:view"] },
  9102: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"] },
  9103: { name: "sales_staff", roles: ["SALES_STAFF"], perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"] },
  9104: {
    name: "store_manager",
    roles: ["STORE_MANAGER"],
    perms: ["store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*", "library:view", "library:copy"],
  },
  9105: {
    name: "purchase_staff",
    roles: ["PURCHASE_STAFF"],
    perms: ["purchase:*", "supplier:*", "inventory:inbound", "report:purchase", "library:view", "library:copy"],
  },
};
const READONLY = 9101;
const SUPER_ADMIN = 9102;
const SALES = 9103;
const STORE_MANAGER = 9104;
const PURCHASE = 9105;

type TenantRow = { method: "get" | "post"; path: string; perm: string; allow: number[] };
/** 租户侧 4 条（路径逐字 = 立项草案 §4.2 T1~T4） */
const TENANT_ROWS: TenantRow[] = [
  { method: "get", path: "/spus", perm: "library:view", allow: [SUPER_ADMIN, STORE_MANAGER, PURCHASE, READONLY] },
  { method: "get", path: "/spus/123", perm: "library:view", allow: [SUPER_ADMIN, STORE_MANAGER, PURCHASE, READONLY] },
  { method: "get", path: "/copies", perm: "library:view", allow: [SUPER_ADMIN, STORE_MANAGER, PURCHASE, READONLY] },
  { method: "post", path: "/copies", perm: "library:copy", allow: [SUPER_ADMIN, STORE_MANAGER, PURCHASE] },
];

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
    (req as any).user = { id: uid, username: u.name, realName: u.name, roles: [...u.roles], tenantId: "t-001" };
    (req as any).tenantId = "t-001";
    next();
  });
  // 与 auto-routes.getAuthMiddlewares 一致：csrf 在挂载层、先于路由匹配
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (["GET", "OPTIONS", "HEAD"].includes(req.method)) return next();
    const uid = (req as any).user?.id;
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

const tenantApp = buildApp("/api/admin/library", adminLibraryRouter);

function callTenant(row: TenantRow, uid?: number) {
  const req = request(tenantApp)[row.method](`/api/admin/library${row.path}`);
  if (uid) req.set("x-test-user", String(uid)).set("x-csrf-token", generateCsrfToken(uid));
  return req.send({});
}

const PLATFORM_TOKEN = jwt.sign({ type: "platform_admin", id: 42, username: "lingzhou" }, process.env.JWT_SECRET as string, {
  algorithm: "HS256",
  issuer: "zhixiang-platform",
  audience: "zhixiang-platform-client",
  expiresIn: "1h",
});

beforeEach(() => {
  h.reached.length = 0;
  h.perms.clear();
  for (const [id, u] of Object.entries(USERS)) h.perms.set(Number(id), u.perms);
});

describe("C6-4-1 · 租户侧注册与权限接线", () => {
  it("① 注册前缀与鉴权口径不变（/api/admin/library + requireAuthWithTenant）", () => {
    expect(adminLibraryRouteConfig.prefix).toBe("/api/admin/library");
    expect(adminLibraryRouteConfig.auth).toBe("requireAuthWithTenant");
  });

  it("① 权限码取自代码常量文件（Q8 ①：代码常量 + 授权另行落）", () => {
    const src = readFileSync(fileURLToPath(new URL("../../routes/admin-library.routes.ts", import.meta.url)), "utf-8");
    expect(src).toContain('from "../shared/library-permission-codes"');
    expect(src).toContain("requirePermission(PERM_LIBRARY_COPY)");
    expect(src).toContain("requirePermission(PERM_LIBRARY_VIEW)");
    expect(src).not.toMatch(/requirePermission\("library:/);
  });

  it.each(TENANT_ROWS)("② 未登录 ⇒ 401：$method $path", async (row) => {
    const res = await callTenant(row);
    expect(res.status).toBe(401);
    expect(h.reached).toHaveLength(0);
  });

  it.each(TENANT_ROWS)("③ 无 library 域权限（SALES_STAFF）⇒ 403 且未到业务层：$method $path", async (row) => {
    const res = await callTenant(row, SALES);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(h.reached).toHaveLength(0);
  });

  it.each(TENANT_ROWS)("④ 持权角色（门店店长/采购员/超管）⇒ 200：$method $path", async (row) => {
    for (const uid of row.allow.filter((id) => id !== READONLY)) {
      h.reached.length = 0;
      const res = await callTenant(row, uid);
      expect(res.status, `uid=${uid} ${row.method} ${row.path}`).toBe(200);
      expect(h.reached).toHaveLength(1);
    }
  });

  it("② 只读角色 READONLY（*:view）⇒ 读端点 200、写端点 403（读写分离的机制证明）", async () => {
    const readRows = TENANT_ROWS.filter((row) => row.method === "get");
    const writeRows = TENANT_ROWS.filter((row) => row.method === "post");
    expect(readRows.length).toBe(3);
    expect(writeRows.length).toBe(1);

    for (const row of readRows) {
      h.reached.length = 0;
      const res = await callTenant(row, READONLY);
      expect(res.status, `${row.method} ${row.path}`).toBe(200);
    }

    h.reached.length = 0;
    for (const row of writeRows) {
      const res = await callTenant(row, READONLY);
      expect(res.status).toBe(403);
    }
    expect(h.reached).toHaveLength(0);
  });

  it("① 路径逐字：/spus、/spus/:id、/copies（GET/POST）四条可达；自拟动作路径 404", async () => {
    for (const row of TENANT_ROWS) {
      h.reached.length = 0;
      const ok = await callTenant(row, SUPER_ADMIN);
      expect(ok.status, `${row.method} ${row.path}`).toBe(200);
    }
    const bogus = await request(tenantApp).get("/api/admin/library/spus/123/copy").set("x-test-user", String(SUPER_ADMIN));
    expect(bogus.status).toBe(404);
  });
});

describe("C6-4-1 · 平台侧注册（含 Q9：P5 不注册）", () => {
  const platformApp = express();
  platformApp.use(express.json());
  platformApp.use("/api/platform/library", platformLibraryRouter);

  it("④ 注册前缀与鉴权口径不变（/api/platform/library + requirePlatformAuth）", () => {
    expect(platformLibraryRouteConfig.prefix).toBe("/api/platform/library");
    expect(platformLibraryRouteConfig.auth).toBe("requirePlatformAuth");
  });

  it("④ 无令牌 ⇒ 401（认证在路由匹配前拦截）", async () => {
    const res = await request(platformApp).get("/api/platform/library/call-logs");
    expect(res.status).toBe(401);
  });

  it("④ 带令牌 ⇒ 4 条统计端点全部注册（200 + 到达业务层）", async () => {
    const paths = ["/api/platform/library/call-logs", "/api/platform/library/stats", "/api/platform/library/stats/rank", "/api/platform/library/stats/trend"];
    for (const path of paths) {
      h.reached.length = 0;
      const res = await request(platformApp).get(path).set("Authorization", `Bearer ${PLATFORM_TOKEN}`);
      expect(res.status, path).toBe(200);
      expect(h.reached, path).toHaveLength(1);
    }
  });

  it("④ P5 类目分布**未注册**（Q9 无类目载体）⇒ 带令牌得 404；不存在资源同样 404（踩坑[155]强证据口径）", async () => {
    const categoryDist = await request(platformApp)
      .get("/api/platform/library/stats/category-dist")
      .set("Authorization", `Bearer ${PLATFORM_TOKEN}`);
    expect(categoryDist.status).toBe(404);

    const bogus = await request(platformApp)
      .get("/api/platform/library/__c641_not_exist__")
      .set("Authorization", `Bearer ${PLATFORM_TOKEN}`);
    expect(bogus.status).toBe(404);
  });

  it("④ 平台侧不出现任何租户私有档案字段（边界铁律：只看调取事实）", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../services/platform/library-call-log.service.ts", import.meta.url)),
      "utf-8"
    );
    // 先剥注释再扫描：铁律的对象是**代码引用**，不是注释里的说明文字。
    // （同族教训：踩坑 [84]/[142]/[153]——文本扫描会被注释/行尾骗过。）
    const code = stripComments(src);
    // 反向自证：剥注释不得把代码也剥空（否则断言退化成"扫空串＝永远绿"）
    expect(code).toContain("FROM t_library_call_log");
    for (const forbidden of ["t_product_spu", "t_product_sku", "t_product_price", "cost_price", "retail_price", "hit_count"]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });
});

/**
 * 剥掉源码里的注释（只剥注释，不改代码语义），供"禁字段不得出现"类文本扫描使用。
 *  · 行注释：`//`、`--`、`#`（覆盖 TS 与内嵌 SQL 两种注释习惯）
 *  · 块注释：`/* … *\/`
 *  · 行尾：先归一 `\r\n` —— 本仓 `core.autocrlf=true`，未归一的行尾会让锚点在 `\r` 前失配（踩坑 [84]/[142]）。
 * 说明：本函数按字符扫描，不识别字符串字面量内部的 `//`（被扫对象为服务源码，已确认无 URL 字面量）；
 *      若日后被扫文件出现 `http://` 之类字面量，需在此补字符串状态机后再用。
 */
function stripComments(source: string): string {
  const text = source.replace(/\r\n/g, "\n");
  let out = "";
  let i = 0;
  let inBlock = false;
  let inLine = false;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (inBlock) {
      if (ch === "*" && next === "/") {
        inBlock = false;
        i += 2;
        continue;
      }
      if (ch === "\n") out += "\n";
      i += 1;
      continue;
    }
    if (inLine) {
      if (ch === "\n") {
        inLine = false;
        out += "\n";
      }
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlock = true;
      i += 2;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLine = true;
      i += 2;
      continue;
    }
    if (ch === "-" && next === "-") {
      inLine = true;
      i += 2;
      continue;
    }
    if (ch === "#") {
      inLine = true;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}
