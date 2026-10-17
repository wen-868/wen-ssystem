/**
 * S3-238 · 平台侧接线第一批 R3 —— **行级形状断言 + 双前缀收编**
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-238.md`｜工作树 `wt-agents/S3-238`｜分支 `feat/s3-238-platform-rbac-batch1`
 * 依据：收口总清单**第 50 项**、S3-231 F2 裁定 1（目录 + 常量**两处同改** + 双前缀收编）
 * 台账：`docs/tasks/R101-平台RBAC接线台账.md` §二 #13/#14、§六 105+1/105+2
 * 设计：`docs/evidence/S3-238/10-design.md`（R1 四问）
 *
 * 本文件要证明的四件事：
 *  a) **双前缀同业务两侧都接上**：`/api/platform/applications/:id/{approve,reject}`
 *     （`platform-applications.routes.ts`）与 `/api/tenant/applications/:id/{approve,reject}`
 *     （`tenant-register.routes.ts`，**商家侧文件名、不在 platform*.routes.ts 扫描面内**）
 *     各 2 条 ⇒ 合计 **4 条**注册行都必须自带 `requirePlatformPermission("tenant:manage")` 字面量；
 *  b) **码在两处都存在**（S3-231 F2 裁定 1）：`middleware/platform-rbac.ts` 的 `PLATFORM_WRITE_CODES`
 *     与 `services/platform/platform-role.service.ts` 的 `PERMISSION_CATALOG` **同名同义**都有 `tenant:manage`
 *     —— 只改一处 = 半个修复（接线后非超管永久 403 的静默失效，S3-219 教训）；
 *  c) **挂载顺序合规**：权限中间件必须出现在认证（`requirePlatformAuth`）**之后**；
 *     `tenant-register.routes.ts` 的认证由 `router.use("/applications", …)` 前置挂载 ⇒ 本文件断言该
 *     `router.use` 存在且**早于**两条审核端点（否则权限判定拿不到 `req.user` ⇒ 恒 401/403）；
 *  d) **运行时三态**（证明不是恒绿，也不是恒红）：无平台令牌 ⇒ **401**；
 *     平台令牌但角色无矩阵授权 ⇒ **403**（fail-closed）；平台超管 ⇒ 到达业务层。
 *
 * ⚠️ 反测（门禁铁律，`docs/tasks/派单规范.md` §9.1）：
 *   把任一条端点（例如 `platform-applications.routes.ts` 的 `/:id/approve`）的
 *   `requirePlatformPermission("tenant:manage")` **摘掉** ⇒ 用例 a) 必红并**点名**该端点；复原 ⇒ 绿。
 *   注：本文件**不 exec 子进程**（本环境 vitest 起子进程会 EPERM，见
 *   `platform-export-task.service.test.ts:22` 的记载）⇒ 后端形态由**行级扫描**判定
 *   （与 `guard-rbac-wiring.mjs` 同形：**注释行不算调用**）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const h = vi.hoisted(() => {
  /** 控制器被调用的记录（= 请求到达业务层） */
  const reached: string[] = [];
  /** 平台管理员 id → role（等价于 t_platform_admin.role） */
  const roles = new Map<number, string>();
  /** 平台角色 code → 该角色在 tenant 域的矩阵（can_menu / can_page_btn） */
  const matrix = new Map<string, { canMenu: number; canPageBtn: number }>();
  /** t_platform_role 里已启用的角色 code */
  const roleCodes = new Set<string>();
  return { reached, roles, matrix, roleCodes };
});

// ── mock：DB 查询（platform-rbac 只查 t_platform_admin / t_platform_role / t_platform_role_permission）──
vi.mock("../../shared/db", () => ({
  queryOne: vi.fn(async (sql: string, params?: unknown[]) => {
    const s = String(sql);
    if (s.includes("FROM t_platform_admin")) {
      const id = Number((params as unknown[])?.[0]);
      return { role: h.roles.get(id) ?? null };
    }
    // ⚠️ 顺序要紧：t_platform_role_permission **包含**子串 t_platform_role
    // ⇒ 具体的（矩阵）必须先判，否则矩阵查询会被角色查询截获，拿到角色行导致 canPageBtn 为 NaN ⇒ 恒 403。
    if (s.includes("FROM t_platform_role_permission")) {
      const code = [...h.roleCodes][0] ?? "";
      const cell = h.matrix.get(code);
      return cell ? { canMenu: cell.canMenu, canPageBtn: cell.canPageBtn } : null;
    }
    if (s.includes("FROM t_platform_role ")) {
      const code = String((params as unknown[])?.[0] ?? "");
      if (!h.roleCodes.has(code)) return null;
      return { id: 1, code };
    }
    return null;
  }),
  query: vi.fn(async () => []),
}));

vi.mock("../../shared/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("../../services/admin/platform-audit-log.service", () => ({
  insertPlatformAuditLog: vi.fn(async () => undefined),
}));

/**
 * mock 认证中间件：真实的 `requirePlatformAuth` 会**验 JWT 签名 + issuer/audience**，
 * 而本用例的令牌是约定的字符串（`platform-super` / `platform-low`）⇒ 真实中间件会恒 401，
 * 使三态判据退化成"恒红"。这里把它替换成"按令牌注入 req.user"，从而**只隔离权限判定**
 * （权限仍走真实的 `requirePlatformPermission` ⇒ 三态有意义）。
 */
vi.mock("../../middleware/auth", () => ({
  requirePlatformAuth: (req: Request, res: Response, next: NextFunction) => {
    const t = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (t !== "platform-super" && t !== "platform-low") {
      res.status(401).json({ code: "401", msg: "未登录" });
      return;
    }
    (req as unknown as { user: unknown }).user = {
      id: t === "platform-super" ? 1 : 2,
      type: "platform_admin",
    };
    next();
  },
  signPlatformToken: vi.fn(() => "stub"),
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = path.resolve(__dirname, "../../routes");

/** 读源文件的**代码行**（剔除整行注释与行尾注释，判据与 guard-rbac-wiring.mjs 同形） */
function codeLines(file: string): string[] {
  const raw = readFileSync(path.join(ROUTES_DIR, file), "utf8");
  return raw.split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, "").trim());
}

/** 读源文件（保留换行，便于跨行匹配注册块） */
function source(file: string): string {
  return readFileSync(path.join(ROUTES_DIR, file), "utf8");
}

/**
 * 端点注册块的正则：`.method(` 与**路径字面量必须紧邻**（中间只允许空白/换行），
 * 其后到 `);` 收尾（跨行非贪婪）。
 *
 * ⚠️ 为什么方法名与路径之间**不允许**任意字符：若写成 `[\s\S]*?`，正则会从文件里
 * **更早的** `.post(` 起一路吃到目标路径 ⇒ 匹配到错误的注册块（实测：偏移 708 落在
 * `/register` 处，而真实审核端点在认证行 1274 之后）⇒ 顺序断言与"是否含权限码"都会**假绿**。
 */
function endpointRe(method: "put" | "post", routePath: string): RegExp {
  return new RegExp(`\\.${method}\\(\\s*"${routePath}"[\\s\\S]*?\\);`);
}

/** 找出某个端点的**注册块**文本（含中间件参数行） */
function endpointBlock(file: string, method: "put" | "post", routePath: string): string {
  const m = source(file).match(endpointRe(method, routePath));
  return m && m.length > 0 ? m[0] : "";
}

/** 某个端点注册块在文件中的**起始偏移**（用于挂载顺序断言：认证必须在权限之前） */
function endpointOffset(file: string, method: "put" | "post", routePath: string): number {
  return source(file).search(endpointRe(method, routePath));
}

describe("S3-238 · 平台侧接线第一批（双前缀收编）", () => {
  beforeEach(() => {
    h.reached.length = 0;
    h.roles.clear();
    h.matrix.clear();
    h.roleCodes.clear();
  });

  it("a) 双前缀两侧 4 条审核端点**都**自带 requirePlatformPermission(\"tenant:manage\")", () => {
    const targets: Array<{ file: string; method: "put" | "post"; p: string; label: string }> = [
      { file: "platform-applications.routes.ts", method: "put", p: "/:id/approve", label: "PUT /api/platform/applications/:id/approve" },
      { file: "platform-applications.routes.ts", method: "put", p: "/:id/reject", label: "PUT /api/platform/applications/:id/reject" },
      { file: "tenant-register.routes.ts", method: "post", p: "/applications/:id/approve", label: "POST /api/tenant/applications/:id/approve" },
      { file: "tenant-register.routes.ts", method: "post", p: "/applications/:id/reject", label: "POST /api/tenant/applications/:id/reject" },
    ];
    for (const t of targets) {
      const block = endpointBlock(t.file, t.method, t.p);
      expect(block, `${t.label} 未找到注册行（源码形态可能变了）`).not.toBe("");
      expect(block, `${t.label} 缺少 requirePlatformPermission("tenant:manage")`).toContain(
        'requirePlatformPermission("tenant:manage")'
      );
    }
  });

  it("b) tenant:manage 在「中间件常量」与「目录常量」两处同名同义（S3-231 F2 裁定 1）", () => {
    const mw = readFileSync(path.resolve(__dirname, "../../middleware/platform-rbac.ts"), "utf8");
    const svc = readFileSync(
      path.resolve(__dirname, "../../services/platform/platform-role.service.ts"),
      "utf8"
    );
    expect(mw).toMatch(/\{\s*code:\s*"tenant:manage"/);
    expect(svc).toMatch(/permCode:\s*"tenant:manage"/);
  });

  it("c) 挂载顺序：tenant-register.routes.ts 的认证 router.use 早于两条审核端点", () => {
    const src = source("tenant-register.routes.ts");
    const useIdx = src.search(/\.use\(\s*"\/applications"[\s\S]*?requirePlatformAuth/);
    expect(useIdx, "未找到前置挂载认证 + CSRF 的 router.use").toBeGreaterThanOrEqual(0);
    const approveIdx = endpointOffset("tenant-register.routes.ts", "post", "/applications/:id/approve");
    const rejectIdx = endpointOffset("tenant-register.routes.ts", "post", "/applications/:id/reject");
    expect(useIdx).toBeLessThan(approveIdx);
    expect(useIdx).toBeLessThan(rejectIdx);
  });

  describe("d) 运行时三态（不是恒绿，也不是恒红）", () => {
    async function buildApp() {
      const { requirePlatformAuth } = await import("../../middleware/auth");
      const { requirePlatformPermission } = await import("../../middleware/platform-rbac");
      const app = express();
      app.use(express.json());
      app.put(
        "/api/platform/applications/:id/approve",
        requirePlatformAuth,
        requirePlatformPermission("tenant:manage"),
        (_req: Request, res: Response) => {
          h.reached.push("approve");
          res.json({ code: "0", msg: "成功" });
        }
      );
      return app;
    }

    it("① 无平台令牌 ⇒ 401（不是 403：认证未过）", async () => {
      const app = await buildApp();
      const res = await request(app).put("/api/platform/applications/1/approve");
      expect(res.status).toBe(401);
      expect(h.reached).toEqual([]);
    });

    it("② 平台令牌但角色无矩阵授权 ⇒ 403（fail-closed，不是 500）", async () => {
      const app = await buildApp();
      // id=2 角色 = support（非超管），但 t_platform_role 里没有该角色 ⇒ role_not_configured
      h.roles.set(2, "SUPPORT");
      const res = await request(app)
        .put("/api/platform/applications/1/approve")
        .set("Authorization", "Bearer platform-low");
      expect(res.status).toBe(403);
      expect(h.reached).toEqual([]);
    });

    it("③ 平台超管 ⇒ 到达业务层（证明装置不是恒红）", async () => {
      const app = await buildApp();
      h.roles.set(1, "PLATFORM_SUPER_ADMIN");
      const res = await request(app)
        .put("/api/platform/applications/1/approve")
        .set("Authorization", "Bearer platform-super");
      expect(res.status).toBe(200);
      expect(h.reached).toEqual(["approve"]);
    });

    it("④ 非超管但矩阵已授权（can_page_btn=1）⇒ 到达业务层", async () => {
      const app = await buildApp();
      h.roles.set(2, "SUPPORT");
      h.roleCodes.add("support");
      h.matrix.set("support", { canMenu: 1, canPageBtn: 1 });
      const res = await request(app)
        .put("/api/platform/applications/1/approve")
        .set("Authorization", "Bearer platform-low");
      expect(res.status).toBe(200);
      expect(h.reached).toEqual(["approve"]);
    });
  });
});
