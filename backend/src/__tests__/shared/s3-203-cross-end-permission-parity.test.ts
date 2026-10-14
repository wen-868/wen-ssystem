/**
 * S3-203 门禁·**同一角色在工作台与移动端必须解析出同一权限集合**
 * （处置卡 §6.2.3 / §6.3 追加验收判据）
 *
 * ── 防的是什么 ────────────────────────────────────────────────────────
 *   提取前，同一角色在两端的权限来源是**两套**：
 *     · 工作台 `/api/admin/auth/login` → `t_sys_role.permissions`（随角色配置变化）；
 *     · 移动端 `getCurrentUser()`    → 服务端**硬编码数组**
 *       `["dashboard.view", "order.view", …]`（角色配置改了不会跟）。
 *   这就是业主说的「各端出现不同的帐号权限」。本文件把"同源"钉成机械判据。
 *
 * ── 判据 ──────────────────────────────────────────────────────────────
 *   ① 同一账号经工作台登录 / 移动端登录 / 移动端 `/me` 三条路径解析出的 `permissions`
 *      必须**逐条相同**，且等于 DB（`t_sys_role.permissions`）里的那一份；
 *   ② 反向自证：那条历史硬编码清单（`dashboard.view` 等）**不得**再出现在移动端返回里，
 *      也不得再出现在后端源码与 `app-mobile/src` 里（否则"第二套口径"又回来了）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** DB 里那份唯一权限集合（本文件把它当作"真值"） */
const DB_PERMISSIONS = ["goods:view", "sale:create", "inventory:view", "report:export"];
/** S3-203 之前移动端硬编码的"第二套口径"（出现即判红） */
const LEGACY_HARDCODED = [
  "dashboard.view",
  "order.view",
  "order.deliver",
  "order.complete",
  "inventory.view",
  "customer.view",
  "receivable.view",
  "report.view",
];

const mocks = vi.hoisted(() => ({
  queryOne: vi.fn(),
  query: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  verifyPassword: vi.fn(),
  signToken: vi.fn(),
  getUserAccessInfo: vi.fn(),
  generateCsrfToken: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));
vi.mock("../../shared/password", () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: vi.fn(),
  hashPasswordSync: vi.fn(),
  validatePassword: () => ({ valid: true, errors: [] }),
}));
vi.mock("../../middleware/auth", () => ({
  signToken: mocks.signToken,
  getUserAccessInfo: mocks.getUserAccessInfo,
  // 登录结果里的 TTL 常量也由该模块导出，需一并给出（本用例只比对权限集合，不校验 TTL）
  MERCHANT_TOKEN_TTL_DEFAULT: "4h",
  MERCHANT_TOKEN_TTL_REMEMBER_ME: "30d",
  MERCHANT_TOKEN_TTL_SECONDS: { "4h": 4 * 3600, "30d": 30 * 24 * 3600 },
}));
vi.mock("../../middleware/csrf", () => ({
  generateCsrfToken: mocks.generateCsrfToken,
}));

import { login as workspaceLogin } from "../../services/admin/auth.service";
import { login as mobileLogin, getCurrentUser } from "../../services/store/auth.service";

/** 同一个账号（租户 default 的店长）在两端的 DB 视图完全一致 */
const ACCOUNT = {
  id: 42,
  username: "store_manager",
  password_hash: "v2$hash",
  real_name: "默认店长",
  store_id: 1,
  status: 1,
  tenant_id: "default",
  login_fail_count: 0,
  locked_until: null,
  mfa_secret: null,
  mfa_enabled: 0,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.queryOne.mockResolvedValue(ACCOUNT);
  mocks.verifyPassword.mockResolvedValue(true);
  mocks.signToken.mockReturnValue("token");
  mocks.getUserAccessInfo.mockReturnValue({ accessModes: ["CASHIER"], defaultMode: "CASHIER" });
  mocks.generateCsrfToken.mockReturnValue("csrf");
  // 所有 SQL 走同一份假库：角色/权限查询都返回同一行（role_code + permissions）
  const rows = [{ role_code: "STORE_MANAGER", permissions: JSON.stringify(DB_PERMISSIONS) }];
  mocks.query.mockImplementation((sql: string) =>
    String(sql).includes("FROM t_sys_user_role ur") ? Promise.resolve(rows) : Promise.resolve([])
  );
  mocks.queryWithTenant.mockResolvedValue([]);
  mocks.queryOneWithTenant.mockResolvedValue(null);
});

describe("S3-203 跨端权限口径一致（工作台 ⇄ 移动端同角色 = 同一权限集合）", () => {
  it("① 三条路径解析出的 permissions 逐条相同，且都等于 t_sys_role.permissions", async () => {
    const ws = await workspaceLogin("store_manager", "pw");
    const mob = await mobileLogin("store_manager", "pw");
    const me = await getCurrentUser({
      id: 42,
      username: "store_manager",
      storeId: 1,
      roles: ["STORE_MANAGER"],
      tenantId: "default",
    });

    expect(ws.user.permissions).toEqual(DB_PERMISSIONS);
    expect(mob.user.permissions).toEqual(DB_PERMISSIONS);
    expect(me.permissions).toEqual(DB_PERMISSIONS);
    // 逐条相同（不只是集合相等）
    expect(mob.user.permissions).toEqual(ws.user.permissions);
    expect(me.permissions).toEqual(ws.user.permissions);
  });

  it("② 反向自证：移动端返回里不得再出现历史硬编码那份清单", async () => {
    const mob = await mobileLogin("store_manager", "pw");
    const me = await getCurrentUser({ id: 42, username: "store_manager", storeId: 1, tenantId: "default" });
    for (const legacy of LEGACY_HARDCODED) {
      expect(mob.user.permissions).not.toContain(legacy);
      expect(me.permissions).not.toContain(legacy);
    }
  });

  it("② 静态面：后端与移动端源码中都不得再出现那套硬编码权限码", () => {
    const repoRoot = join(__dirname, "../../../..");
    const targets = [
      join(repoRoot, "backend/src/services/store/auth.service.ts"),
      ...listSourceFiles(join(repoRoot, "app-mobile/src")),
    ];
    const offenders: string[] = [];
    for (const file of targets) {
      const text = readFileSync(file, "utf8");
      for (const legacy of LEGACY_HARDCODED) {
        if (text.includes(`"${legacy}"`) || text.includes(`'${legacy}'`)) {
          offenders.push(`${file}: ${legacy}`);
        }
      }
    }
    expect(offenders).toEqual([]);
    // 且移动端登录服务必须**引用**唯一出处（而不是自己拼一份）
    const storeService = readFileSync(join(repoRoot, "backend/src/services/store/auth.service.ts"), "utf8");
    expect(storeService).toContain("shared/user-permissions");
  });
});

/** 递归列出源码文件（只取 .ts/.vue/.js） */
function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|vue|js)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}
