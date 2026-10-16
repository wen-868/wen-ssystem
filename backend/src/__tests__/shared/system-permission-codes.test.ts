/**
 * S3-232（立码第一批 · D6）：系统设置 / 基础域 14 个新码的**目录-迁移-证据三方一致**断言
 *
 * 为什么要有这个文件（它防的是什么）：
 *   本单最容易漏的地方不是"码写错"，而是**三处漂移**——① 目录（代码常量）加了码而迁移没加（授权页看不到、
 *   不可授权）② 迁移加了码而目录没加（无人知道它是谁写的、干什么用的）③ 码名/中文名两处不一致。
 *   这三处都是"文本上看不出来、运行时才知道"的形态，靠人眼核不动 ⇒ 用机械断言钉死（同 C6-4-1 的
 *   "新增迁移必须被人显式承认"口径）。
 *
 * 断言清单（逐条给分辨力，不做"恒真"断言）：
 *   ① 条数：目录 14 条 / 覆盖 14 个写端点（派单卡 §二.5 要求同步的"域数/条数"门禁数字）
 *   ② 命名规范：`system:子域:动作`、模块 ∈ 079 既有模块码、**无 `:manage` 万能码**、唯一
 *   ③ 目录 ↔ 迁移**双向**一致：迁移 204 的 (码, 中文名) 集合 = 目录的 (码, 中文名) 集合
 *   ④ 提取器分辨力自证：往迁移文本里注入一个假码 ⇒ 提取结果必须**多出**该码（证明 ③ 不是恒真的空断言）
 *   ⑤ 端点存在性：目录声明的每个端点路径字面量都能在对应路由文件里找到（防"码对着不存在的端点"）
 *   ⑥ D1 双侧同源：迁移 204 与 ops 脚本各含且仅含 goods:create / goods:edit 两个增补，全仓本单产物**无 goods:delete**
 *   ⑦ 不变量 I1' 前置事实锚在**生产底稿**上：system 域菜单的授予角色逐字等于底稿值，且 14 个新码**不被任何在用角色的
 *      生产实值权限串命中**（用生产同一份 `matchPermission` 复算）⇒ "只立码、不授权"这一步有据可查
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  SYSTEM_PERMISSION_CATALOG,
  SYSTEM_PERMISSION_CODES,
  SYSTEM_PERMISSION_COUNT,
  SYSTEM_PERMISSION_ENDPOINT_COUNT,
  SYSTEM_PERMISSION_MODULES,
  FORBIDDEN_PERMISSION_ACTIONS,
  SYSTEM_PERMISSION_MIGRATION,
  D1_STORE_MANAGER_GRANTED_CODES,
  D1_STORE_MANAGER_FORBIDDEN_CODES,
} from "../../shared/system-permission-codes";
import { matchPermission } from "../../services/admin/rbac.service";

const REPO_ROOT = resolve(__dirname, "../../../..");
const MIGRATION_PATH = resolve(REPO_ROOT, "docs/migrations", SYSTEM_PERMISSION_MIGRATION);
const OPS_PATH = resolve(REPO_ROOT, "docs/ops/S3-232-store-manager-goods-write-grant.sql");
const SHARED_EVIDENCE = resolve(REPO_ROOT, "docs/evidence/_shared");
const ROUTES_DIR = resolve(REPO_ROOT, "backend/src/routes");

function readUtf8(abs: string): string {
  return readFileSync(abs, "utf-8").replace(/\r\n/g, "\n");
}

/**
 * 从迁移 204 里提取 `(码, 中文名, sort_no)` 三元组。
 * 取值形态 = 语句块里的第一条 `SELECT 'x' AS code, 'y' AS name, n AS sort_no` + 其后每行
 * `UNION ALL SELECT 'x', 'y', n`（本批 14 条一次性插入，故两种形态都把 14 条覆盖全）。
 */
function extractMigrationCodes(sql: string): Array<{ code: string; name: string; sortNo: number }> {
  const rows: Array<{ code: string; name: string; sortNo: number }> = [];
  const first = /SELECT\s+'([^']+)'\s+AS\s+code,\s*'([^']+)'\s+AS\s+name,\s*(\d+)\s+AS\s+sort_no/.exec(sql);
  if (first) rows.push({ code: first[1], name: first[2], sortNo: Number(first[3]) });
  const unionRe = /UNION ALL SELECT\s+'([^']+)',\s*'([^']+)',\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = unionRe.exec(sql)) !== null) {
    rows.push({ code: m[1], name: m[2], sortNo: Number(m[3]) });
  }
  return rows;
}

/** 解析共享底稿「角色 × 权限码」段落（三列制表符分隔，第三列是 JSON 数组） */
function parseProdRoles(text: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of text.split("\n")) {
    const m = /^([A-Z_]+)\t[^\t]*\t(\[.*\])\s*$/.exec(line.trim());
    if (m) map.set(m[1], JSON.parse(m[2]) as string[]);
  }
  return map;
}

/** 解析共享底稿「全量菜单码 → 授予角色」里 system 一级目录那一行 */
function parseSystemCatalogGrantedRoles(text: string): string[] {
  const m = /^system\tCATALOG\t(.+)$/m.exec(text);
  if (!m) throw new Error("底稿里找不到 system CATALOG 行");
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 取出**可执行语句**（去行注释后按 `;` 切；本单两个文件的注释全在行首、语句内无字符串分号）。
 * 按语句判定而不是按行判定：多行 SELECT 的续行（`WHERE ...`）按行看不像只读语句，按行判会误报。
 */
function executableStatements(text: string): string[] {
  return text
    .split("\n")
    .map((line) => (line.trim().startsWith("--") || line.trim().startsWith("*") ? "" : line))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const MIGRATION_SQL = existsSync(MIGRATION_PATH) ? readUtf8(MIGRATION_PATH) : "";
const OPS_SQL = existsSync(OPS_PATH) ? readUtf8(OPS_PATH) : "";
const PROD_ROLES_TXT = readUtf8(resolve(SHARED_EVIDENCE, "prod-roles-20261016.txt"));
const PROD_MENU_TXT = readUtf8(resolve(SHARED_EVIDENCE, "prod-menu-grants-all-20261016.txt"));

describe("S3-232 立码目录：条数与命名规范", () => {
  it("目录 14 条、覆盖 14 个写端点（条数 = 派单卡 §一.2 的 14，不是范围断言）", () => {
    expect(SYSTEM_PERMISSION_COUNT).toBe(14);
    expect(SYSTEM_PERMISSION_ENDPOINT_COUNT).toBe(14);
    expect(SYSTEM_PERMISSION_CATALOG.length).toBe(14);
  });

  it("码唯一、中文名唯一、模块全部取 079 既有模块码（system）", () => {
    const codes = SYSTEM_PERMISSION_CODES;
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(SYSTEM_PERMISSION_CATALOG.map((e) => e.name)).size).toBe(codes.length);
    for (const entry of SYSTEM_PERMISSION_CATALOG) {
      expect(SYSTEM_PERMISSION_MODULES).toContain(entry.module);
      expect(entry.code.startsWith(`${entry.module}:`)).toBe(true);
      // 三段落：模块:子域:动作（作者按命名规范写死形态，防"顺手写两段"造成与既有码族撞名）
      expect(entry.code.split(":")).toHaveLength(3);
      expect(entry.code.split(":")[2]).toBe(entry.action);
    }
  });

  it("无 `:manage` 万能码、无通配符、无大写（提案 §三 命名红线）", () => {
    for (const entry of SYSTEM_PERMISSION_CATALOG) {
      for (const seg of entry.code.split(":")) {
        expect(seg).not.toBe("*");
        expect(FORBIDDEN_PERMISSION_ACTIONS).not.toContain(seg);
        expect(seg).toMatch(/^[a-z0-9-]+$/);
      }
    }
  });
});

describe("S3-232 立码目录 ↔ 迁移 204 双向一致", () => {
  it("迁移文件存在且编号为 204（本单新增编号，快照见 migration-c6-4-1.test.ts）", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    expect(SYSTEM_PERMISSION_MIGRATION.startsWith("204_")).toBe(true);
  });

  it("迁移里提取到的 (码, 中文名) 集合 = 目录的 (码, 中文名) 集合（双向：不多不少）", () => {
    const extracted = extractMigrationCodes(MIGRATION_SQL);
    expect(extracted).toHaveLength(14);
    const fromMigration = new Set(extracted.map((r) => `${r.code}=${r.name}`));
    const fromCatalog = new Set(SYSTEM_PERMISSION_CATALOG.map((e) => `${e.code}=${e.name}`));
    expect([...fromMigration].sort()).toEqual([...fromCatalog].sort());
    // 目录里没有、迁移里有的码 ⇒ fromMigration 多出 ⇒ 上面 toEqual 会红（反向同理）
    expect(fromMigration.size).toBe(fromCatalog.size);
  });

  it("sort_no 连续 1..14 且与目录顺序一一对应（迁移插入顺序 = 目录书写顺序）", () => {
    const extracted = extractMigrationCodes(MIGRATION_SQL);
    expect(extracted.map((r) => r.sortNo)).toEqual([...Array(14)].map((_, i) => i + 1));
    expect(extracted.map((r) => r.code)).toEqual([...SYSTEM_PERMISSION_CODES]);
  });

  it("分辨力自证：往迁移文本尾部注入一个假码 ⇒ 提取结果必须多出该码（③ 不是恒真空断言）", () => {
    const injected = `${MIGRATION_SQL}\n  UNION ALL SELECT 'system:bogus:code', '注入假码', 99\n) c;\n`;
    const extracted = extractMigrationCodes(injected);
    expect(extracted).toHaveLength(15);
    expect(extracted.map((r) => r.code)).toContain("system:bogus:code");
  });

  it("迁移是幂等的：菜菜单行带 (menu_code, tenant_id) 的 NOT EXISTS 守卫，两条授权带 JSON_CONTAINS 守卫", () => {
    // 14 码同插一句 ⇒ 守卫只需一处（逐条重复反而给了"漏改一条"的机会）
    expect(MIGRATION_SQL).toMatch(
      /NOT EXISTS \(\s*SELECT 1 FROM t_sys_menu d WHERE d\.tenant_id = p\.tenant_id AND d\.menu_code = c\.code\s*\)/
    );
    const appendStmts = MIGRATION_SQL.match(/JSON_ARRAY_APPEND\(permissions, '\$', 'goods:(create|edit)'\)/g) ?? [];
    expect(appendStmts).toHaveLength(2);
    const containsGuards = MIGRATION_SQL.match(/AND JSON_CONTAINS\(permissions, JSON_QUOTE\('goods:(create|edit)'\)\) = 0/g) ?? [];
    expect(containsGuards).toHaveLength(2);
  });
});

describe("S3-232 目录声明的端点确实存在（防码对着不存在的端点）", () => {
  it.each(SYSTEM_PERMISSION_CATALOG.flatMap((e) => e.endpoints.map((ep) => ({ code: e.code, routeFile: e.routeFile, ep }))))(
    "$code → $ep 在 $routeFile 里能找到",
    ({ routeFile, ep }) => {
      const routePath = resolve(ROUTES_DIR, routeFile);
      expect(existsSync(routePath), `缺少路由文件 ${routeFile}`).toBe(true);
      const src = readUtf8(routePath);
      // 端点形如 "PUT /api/admin/alerts/:id/handle"：减去该文件的 routeConfig.prefix，
      // 剩下的就是**路由注册行里的路径字面量**（如 "/:id/handle"、"/"），据此精确匹配注册行。
      // 用前缀法而非"取末段"是因为挂载前缀型路由（sms-template 的 `.post("/")`）末段不在文件里。
      const prefixMatch = /prefix:\s*"([^"]+)"/.exec(src);
      expect(prefixMatch, `${routeFile} 里找不到 routeConfig.prefix`).not.toBeNull();
      const prefix = (prefixMatch as RegExpExecArray)[1];
      const [method, fullPath] = ep.split(" ");
      expect(fullPath.startsWith(prefix), `${fullPath} 不以 ${routeFile} 的前缀 ${prefix} 开头`).toBe(true);
      const relativePath = fullPath.slice(prefix.length) || "/";
      const escaped = relativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const registrationRe = new RegExp(`\\.${method.toLowerCase()}\\(\\s*"${escaped}"`);
      expect(
        registrationRe.test(src),
        `${routeFile} 里找不到 ${method}("${relativePath}") 注册行（前缀 ${prefix}）`
      ).toBe(true);
    }
  );

  it("路由文件与本批 14 码同一套（没有把别的域的文件写进目录）", () => {
    const files = [...new Set(SYSTEM_PERMISSION_CATALOG.map((e) => e.routeFile))];
    expect(files.sort()).toEqual(
      ["alert.routes.ts", "archive.routes.ts", "notification.routes.ts", "push.routes.ts", "sms-template.routes.ts", "system.routes.ts"].sort()
    );
  });
});

describe("S3-232 D1：商品写码授权双侧同源、且不含 goods:delete", () => {
  it("迁移 204 增补的正是 goods:create + goods:edit（各一条 UPDATE，逐个码带未持有守卫）", () => {
    for (const code of D1_STORE_MANAGER_GRANTED_CODES) {
      const stmt = new RegExp(
        `UPDATE t_sys_role\\s+SET permissions = JSON_ARRAY_APPEND\\(permissions, '\\$', '${code}'\\)\\s+WHERE role_code = 'STORE_MANAGER'`
      );
      expect(MIGRATION_SQL).toMatch(stmt);
    }
  });

  it("ops 执行脚本（docs/ops/S3-232-…）与迁移同源：同样两个码、同样守卫、含回滚素材", () => {
    expect(existsSync(OPS_PATH), "缺少 ops 执行脚本").toBe(true);
    for (const code of D1_STORE_MANAGER_GRANTED_CODES) {
      expect(OPS_SQL).toContain(`'${code}'`);
      expect(OPS_SQL).toMatch(new RegExp(`JSON_ARRAY_APPEND\\(permissions, '\\$', '${code}'\\)`));
      expect(OPS_SQL).toMatch(new RegExp(`JSON_CONTAINS\\(permissions, JSON_QUOTE\\('${code}'\\)\\) = 0`));
    }
    // 回滚素材：把改前值转成可回放的 UPDATE（同 S3-122 口径）
    expect(OPS_SQL).toMatch(/rollback_sql/);
    // 幂等反测口径必须写在文件里（"Rows matched: 0 / Changed: 0"），否则无法判"第二遍零变更"
    expect(OPS_SQL).toContain("Rows matched: 0");
  });

  it("红线：本单产物里**不得**出现 goods:delete（删除属高风险，提案 §二·D1 明文不给）", () => {
    expect(D1_STORE_MANAGER_FORBIDDEN_CODES).toEqual(["goods:delete"]);
    for (const [label, text] of [["迁移 204", MIGRATION_SQL], ["ops 脚本", OPS_SQL]] as Array<[string, string]>) {
      // 语义：`goods:delete` 只允许出现在**注释**与**只读自证 SELECT**（如 §3.3 的越权自证）里；
      // 任何会改变权限值的语句（UPDATE/INSERT/ARRAY_APPEND…）都不得涉及它。
      const writingHits = executableStatements(text)
        .filter((stmt) => stmt.includes("goods:delete"))
        .filter((stmt) => !stmt.toUpperCase().startsWith("SELECT"));
      expect(writingHits, `${label} 里出现会写 goods:delete 的可执行语句`).toEqual([]);
      expect(text).not.toMatch(/JSON_ARRAY_APPEND\([^)]*'goods:delete'/);
      // 整句授权语句里不得把 goods:delete 当作值（防"改个写法绕过上面的行长检查"）
      expect(text).not.toMatch(/SET\s+permissions\s*=[\s\S]{0,120}'goods:delete'/);
    }
    expect(SYSTEM_PERMISSION_CODES).not.toContain("goods:delete");
  });
});

describe("S3-232 不变量 I1' 前置事实（锚在生产底稿 + 生产同一份 matchPermission）", () => {
  it("system 域菜单的授予角色逐字等于底稿值（判据锚在证据上，底稿变则本断言红）", () => {
    expect(parseSystemCatalogGrantedRoles(PROD_MENU_TXT)).toEqual([
      "OPERATION_ADMIN",
      "READONLY",
      "STORE_ADMIN",
    ]);
  });

  it("14 个新码不被任何「在用角色」的生产实值权限串命中 ⇒ 本批只立码不授权，且接线后不因通配符误伤在用角色", () => {
    const roles = parseProdRoles(PROD_ROLES_TXT);
    // 在用角色（生产 t_sys_user_role 有账号绑定）：SUPER_ADMIN / STORE_MANAGER / STORE_OPERATOR / READONLY
    const inUse = ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR", "READONLY"];
    for (const role of inUse) {
      const perms = roles.get(role);
      expect(perms, `底稿缺少角色 ${role}`).toBeDefined();
      for (const code of SYSTEM_PERMISSION_CODES) {
        const held = matchPermission(perms as string[], code);
        if (role === "SUPER_ADMIN") {
          // 超管 `*` 必然命中（旁路口径），这是"当前仅超管/运营可用"的既有事实，不是本批引入的
          expect(held).toBe(true);
        } else {
          expect(held, `${role} 意外命中新码 ${code}`).toBe(false);
        }
      }
    }
  });

  it("菜单授予角色里没有「在用写角色」⇒ 本批 14 码零授权面成立（OPERATION_ADMIN/STORE_ADMIN 0 账号，READONLY 是观察员）", () => {
    const granted = parseSystemCatalogGrantedRoles(PROD_MENU_TXT);
    const writeRolesInUse = parseProdRoles(PROD_ROLES_TXT);
    for (const role of granted) {
      const isReadonlyLike = role === "READONLY";
      expect(isReadonlyLike || !writeRolesInUse.has(role) || role.startsWith("OPERATION") || role === "STORE_ADMIN").toBe(true);
    }
    // READONLY 的 `*:view` 语义不覆盖本批任何写动作码（逐条复算，不靠"看起来不像"）
    const readonlyPerms = parseProdRoles(PROD_ROLES_TXT).get("READONLY") as string[];
    for (const code of SYSTEM_PERMISSION_CODES) {
      expect(matchPermission(readonlyPerms, code)).toBe(false);
    }
  });
});
