/**
 * S3-236（立码第二批 · 四域 38 码）：**目录 ↔ 迁移 207 ↔ 端点存在性** 三方一致断言
 *
 * 为什么要有这个文件（它防的是什么）：
 *   本单最容易漏的不是"码写错"，而是**三处漂移**——
 *     ① 目录（代码常量）加了码而迁移没加（授权页看不到、不可授权）；
 *     ② 迁移加了码而目录没加（无人知道它是谁写的、干什么用的）；
 *     ③ 码名/中文名两处不一致（授权页显示的名字与代码里的名字对不上）。
 *   这三处都是"文本上看不出来、运行时才知道"的形态，靠人眼核不动 ⇒ 用机械断言钉死。
 *
 * 断言清单（逐条给分辨力，不做"恒真"断言）：
 *   ① 条数：38 码 / 逐域 11 + 14 + 5 + 8（派单卡 §一）；**一码可覆盖多端点**（端点数 45 > 码数 38）
 *   ② 命名规范：三段式、模块 ∈ 079 既有模块码、无 `:manage` 万能码、无通配符、无大写
 *   ③ 目录 ↔ 迁移 207 **双向**一致：(码, 中文名) 集合相等 + `sort_no` 连续 1..38 与目录顺序一一对应
 *   ④ 提取器分辨力自证：往迁移文本注入一个假码 ⇒ 提取结果必须多出该码（证明 ③ 不是恒真空断言）
 *   ⑤ 端点存在性：目录声明的每个端点都能在对应路由文件里找到注册行（防"码对着不存在的端点"）
 *   ⑥ 父行口径：迁移声明的 `parent_code` 必须都是 **079 既有 CATALOG 码**（防插孤儿行）
 *   ⑦ 零授权：本批 38 码**不发任何角色码**（迁移里不得出现任何写 `t_sys_role` 的可执行语句）
 *   ⑧ 幂等守卫承重：迁移必须带 `NOT EXISTS (menu_code, tenant_id)` 守卫（同 S3-232 的 204 口径）
 *
 * 反测（判据 6，原始输出见 docs/evidence/S3-236/raw/）：
 *   从迁移里删掉一条码 ⇒ ③/⑤ 判红并**点名该码**；复原后 SHA256 逐字节一致（`raw/61-*` / `raw/62-*`）。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  BATCH2_ALLOWED_TWO_SEGMENT_ACTIONS,
  BATCH2_DOMAIN_COUNTS,
  BATCH2_FORBIDDEN_PERMISSION_ACTIONS,
  BATCH2_PERMISSION_CATALOG,
  BATCH2_PERMISSION_CODES,
  BATCH2_PERMISSION_COUNT,
  BATCH2_PERMISSION_ENDPOINT_COUNT,
  BATCH2_PERMISSION_MIGRATION,
  BATCH2_PERMISSION_MIGRATION_NO,
  BATCH2_PERMISSION_MODULES,
} from "../../shared/batch2-permission-codes";

const REPO_ROOT = resolve(__dirname, "../../../..");
const MIGRATION_PATH = resolve(REPO_ROOT, "docs/migrations", BATCH2_PERMISSION_MIGRATION);
const ROUTES_DIR = resolve(REPO_ROOT, "backend/src/routes");

function readUtf8(abs: string): string {
  return readFileSync(abs, "utf-8").replace(/\r\n/g, "\n");
}

/**
 * 目录 `endpoints` 即**真实路径字面量**（F1 返工：不再有 `#参数#` 形态的检索装置占位符）。
 * 断言只做一件归一：把实现里的**更窄写法** `:id(\\d+)` 归一成 `:id`（Express 4 正则约束段，
 * 语义上是 `:id` 的子集）——否则"端点写了数字约束"会被误判成"端点不存在"。
 */
function normalizeParamConstraints(src: string): string {
  return src.replace(/:([A-Za-z_][A-Za-z0-9_]*)\(\\\\d\+\)/g, ":$1");
}

/** 正则元字符转义（把路径字面量安全嵌进 RegExp） */
function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 解析路由文件里的**挂载段**（`{ prefix: "…", router: <变量> }`）：
 * 单对象（`export const routeConfig = { … }`）与**多段数组**（`routeConfigs = [ {…}, {…} ]`）都认。
 * F1 返工前只读**第一个** `prefix:`，于是 `store-hardware.routes.ts` 的 5 段挂载被误判（判红第 3~9 条）。
 */
function parseMounts(src: string): Array<{ prefix: string; router: string }> {
  const mounts: Array<{ prefix: string; router: string }> = [];
  const re = /\{\s*prefix:\s*"([^"]+)"\s*,\s*router:\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) mounts.push({ prefix: m[1], router: m[2] });
  return mounts;
}

/**
 * 端点存在性核对（**两段式**）：先按挂载段前缀定位，再核对该段 router 变量上的**段内相对注册行**。
 * 找不到任何挂载段时退回"完整路径字面量"核对（少数文件直接注册完整路径）。
 */
function endpointRegistered(src: string, endpoint: string): { ok: boolean; detail: string } {
  const [method, fullPath] = endpoint.split(" ");
  const verb = method.toLowerCase();
  const normalized = normalizeParamConstraints(src);
  const mounts = parseMounts(src);
  const mountList = mounts.map((m) => m.prefix).join(" / ") || "（文件内无挂载段）";
  const tried: string[] = [];
  for (const { prefix, router } of mounts) {
    const isSelf = fullPath === prefix || fullPath === `${prefix}/`;
    if (!isSelf && !fullPath.startsWith(`${prefix}/`)) continue;
    const relative = fullPath.slice(prefix.length) || "/";
    const candidate = `${router}.${verb}("${relative}")`;
    tried.push(candidate);
    const re = new RegExp(`${escapeRe(router)}\\.${verb}\\(\\s*["'\`]${escapeRe(relative)}["'\`]`);
    if (re.test(normalized)) return { ok: true, detail: `挂载段 ${prefix} + ${candidate}` };
  }
  const fullRe = new RegExp(
    `\\.${verb}\\(\\s*["'\`][^"'\`]*${escapeRe(fullPath)}["'\`]|prefix:\\s*["'\`]${escapeRe(fullPath)}["'\`]`,
  );
  if (fullRe.test(normalized)) return { ok: true, detail: `完整路径字面量 ${fullPath}` };
  const detail = tried.length > 0 ? tried.join(" / ") : `完整路径字面量 ${fullPath}`;
  return { ok: false, detail: `${detail}；文件内挂载段 = ${mountList}` };
}

/**
 * 从迁移 207 里提取 `(码, 中文名, sort_no, 父行码)` 四元组。
 * 形态 = 语句块里的第一条 `SELECT 'x' AS code, 'y' AS name, n AS sort_no, 'p' AS parent_code`
 *        + 其后每行 `UNION ALL SELECT 'x', 'y', n, 'p'`。
 */
function extractMigrationCodes(sql: string): Array<{ code: string; name: string; sortNo: number; parent: string }> {
  const rows: Array<{ code: string; name: string; sortNo: number; parent: string }> = [];
  // 兼容两种写法：① 首行带 `AS code/name/sort_no/parent_code` 别名；② 后续行同形；③ 省略别名的简写
  const rowRe =
    /SELECT\s+'([^']+)'(?:\s+AS\s+code)?,\s*'([^']+)'(?:\s+AS\s+name)?,\s*(\d+)(?:\s+AS\s+sort_no)?,\s*'([^']+)'(?:\s+AS\s+parent_code)?/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(sql)) !== null) {
    rows.push({ code: m[1], name: m[2], sortNo: Number(m[3]), parent: m[4] });
  }
  return rows;
}

/** 可执行语句（去行注释后按 `;` 切；注释全在行首、语句内无字符串分号） */
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

/** 079_权限矩阵.sql 的一级 CATALOG 码（**父行白名单**：迁移只能用这些当父行，不得自造目录） */
const CATALOG_CODES_079 = (() => {
  const sql = readUtf8(resolve(REPO_ROOT, "docs/migrations/079_权限矩阵.sql"));
  const codes: string[] = [];
  const re = /\((\d+),\s*NULL,\s*'([a-z-]+)',\s*'[^']+',\s*'CATALOG'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) codes.push(m[2]);
  return codes;
})();

describe("S3-236 立码目录：条数与命名规范", () => {
  it("38 码、逐域 11 / 14 / 5 / 8（条数 = 派单卡 §一，不是范围断言）", () => {
    expect(BATCH2_PERMISSION_COUNT).toBe(38);
    expect(BATCH2_PERMISSION_CATALOG.length).toBe(38);
    expect(BATCH2_PERMISSION_CODES.length).toBe(38);
    expect(BATCH2_DOMAIN_COUNTS).toEqual({ report: 11, hardware: 14, miniapp: 5, dashboard: 8 });
  });

  it("端点数 45 > 码数 38（报表 4 条权限端点共用 1 码 ⇒ 一码可覆盖多端点）", () => {
    // 报表 18 + 硬件 14 + 小程序 5 + 工作台 8 = 45（清单 §二 逐域端点数，可复算）
    expect(BATCH2_PERMISSION_ENDPOINT_COUNT).toBe(45);
    const reportEndpoints = BATCH2_PERMISSION_CATALOG.filter((e) => e.module === "report").reduce(
      (sum, e) => sum + e.endpoints.length,
      0,
    );
    expect(reportEndpoints).toBe(18);
  });

  it("码唯一、中文名唯一、模块全部取 079 既有模块码；三段式，或两段式且动作在 079 既有动作白名单内", () => {
    const codes = BATCH2_PERMISSION_CODES;
    // 唯一性判据要**点名**重复项（F1 返工：原写成 `new Set(...).size === length`，红了只说数字、不说是谁）
    const dupCodes = [...new Set(codes.filter((c, i) => codes.indexOf(c) !== i))];
    expect(dupCodes, `权限码重复：${dupCodes.join(", ")}`).toHaveLength(0);
    const names = BATCH2_PERMISSION_CATALOG.map((e) => e.name);
    const dupNames = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
    expect(dupNames, `中文名重复：${dupNames.join(", ")}`).toHaveLength(0);
    expect(names).toHaveLength(codes.length);
    for (const entry of BATCH2_PERMISSION_CATALOG) {
      expect(BATCH2_PERMISSION_MODULES).toContain(entry.module);
      expect(entry.code.startsWith(`${entry.module}:`)).toBe(true);
      const segments = entry.code.split(":");
      // 本仓规范是 `模块:子域:动作`，但 079 既有码族有两段式先例（store:list / store:create / store:edit），
      // 且本批清单 §2.1 明确要求 `report:export`（"动作取 079 规范动作 export"）⇒ 两段式须在白名单内
      expect(segments.length === 3 || segments.length === 2, `码形态异常：${entry.code}`).toBe(true);
      expect(segments[segments.length - 1]).toBe(entry.action);
      if (segments.length === 2) {
        expect(
          BATCH2_ALLOWED_TWO_SEGMENT_ACTIONS,
          `两段式码的动作不在白名单内：${entry.code}`,
        ).toContain(entry.action);
      }
    }
    // 本批唯一的两段式码（清单明文）：report:export
    const twoSegment = BATCH2_PERMISSION_CATALOG.filter((e) => e.code.split(":").length === 2).map((e) => e.code);
    expect(twoSegment).toEqual(["report:export"]);
  });

  it("无 `:manage` 万能码、无通配符、段内只允许 [a-z0-9-]（提案 §三 命名红线）", () => {
    for (const entry of BATCH2_PERMISSION_CATALOG) {
      for (const seg of entry.code.split(":")) {
        expect(seg).not.toBe("*");
        expect(BATCH2_FORBIDDEN_PERMISSION_ACTIONS).not.toContain(seg);
        expect(seg).toMatch(/^[a-z0-9-]+$/);
      }
    }
  });

  it("逐条码名与清单 §二 的字面**逐字**一致（不变量：码名不得被顺手改写）", () => {
    // 抽样钉死最易被"顺手改"的几条（全量字面由迁移↔目录双向一致 + 迁移来自生成器共同保证）
    const expected: Record<string, string> = {
      "report:permission:edit": "维护报表权限",
      "system:print-template:set-default": "设为默认打印模板",
      "store:hardware:box-config-test": "测试收银盒配置",
      "miniapp:package:upload-key": "上传小程序密钥",
      "dashboard:quick-entry:sort": "调整快捷入口排序",
    };
    for (const [code, name] of Object.entries(expected)) {
      const entry = BATCH2_PERMISSION_CATALOG.find((e) => e.code === code);
      expect(entry, `目录缺少 ${code}`).toBeDefined();
      expect(entry?.name).toBe(name);
    }
  });
});

describe("S3-236 立码目录 ↔ 迁移 207 双向一致", () => {
  it("迁移文件存在且编号为 207（本单新增编号，快照见 migration-c6-4-1.test.ts）", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    expect(BATCH2_PERMISSION_MIGRATION_NO).toBe(207);
    expect(BATCH2_PERMISSION_MIGRATION.startsWith("207_")).toBe(true);
  });

  it("迁移里提取到的 (码, 中文名) 集合 = 目录的 (码, 中文名) 集合（双向：不多不少）", () => {
    const extracted = extractMigrationCodes(MIGRATION_SQL);
    expect(extracted).toHaveLength(38);
    const fromMigration = new Set(extracted.map((r) => `${r.code}=${r.name}`));
    const fromCatalog = new Set(BATCH2_PERMISSION_CATALOG.map((e) => `${e.code}=${e.name}`));
    expect([...fromMigration].sort()).toEqual([...fromCatalog].sort());
    expect(fromMigration.size).toBe(fromCatalog.size);
  });

  it("sort_no 连续 1..38 且与目录顺序一一对应（迁移插入顺序 = 目录书写顺序）", () => {
    const extracted = extractMigrationCodes(MIGRATION_SQL);
    expect(extracted.map((r) => r.sortNo)).toEqual([...Array(38)].map((_, i) => i + 1));
    expect(extracted.map((r) => r.code)).toEqual([...BATCH2_PERMISSION_CODES]);
  });

  it("分辨力自证：往迁移文本尾部注入一个假码 ⇒ 提取结果必须多出该码（③ 不是恒真空断言）", () => {
    const injected = `${MIGRATION_SQL}\n  UNION ALL SELECT 'report:bogus:code', '注入假码', 99, 'report'\n) c;\n`;
    const extracted = extractMigrationCodes(injected);
    expect(extracted).toHaveLength(39);
    expect(extracted.map((r) => r.code)).toContain("report:bogus:code");
  });

  it("迁移里声明的父行 = 目录的 menuParent，且全部是 079 既有 CATALOG 码（防插孤儿行）", () => {
    const extracted = extractMigrationCodes(MIGRATION_SQL);
    expect(extracted.map((r) => `${r.code}=${r.parent}`)).toEqual(
      BATCH2_PERMISSION_CATALOG.map((e) => `${e.code}=${e.menuParent}`),
    );
    expect(CATALOG_CODES_079.length).toBeGreaterThanOrEqual(11);
    for (const row of extracted) {
      expect(CATALOG_CODES_079, `父行 ${row.parent} 不是 079 的 CATALOG 码`).toContain(row.parent);
    }
  });

  it("迁移是幂等的：菜单行带 (menu_code, tenant_id) 的 NOT EXISTS 守卫，父行按 parent_code 逐租户定位", () => {
    expect(MIGRATION_SQL).toMatch(
      /NOT EXISTS \(\s*SELECT 1 FROM t_sys_menu d WHERE d\.tenant_id = p\.tenant_id AND d\.menu_code = c\.code\s*\)/,
    );
    expect(MIGRATION_SQL).toMatch(/WHERE p\.menu_code = c\.parent_code/);
    expect(MIGRATION_SQL).toMatch(/p\.menu_type = 'CATALOG'/);
    expect(MIGRATION_SQL).toMatch(/p\.parent_id IS NULL/);
  });

  it("红线：迁移里**没有任何**写 t_sys_role / t_sys_role_permission 的可执行语句（本批零授权）", () => {
    // 口径（F1 返工，判红第 2 条）：**只看写语句**。
    //   迁移底部的只读对账 `SELECT r.id FROM t_sys_role r`（查父行/角色 id，第 110/196 行）是**只读**语句，
    //   首版 `expect(executable).not.toMatch(/t_sys_role/i)` 一律封杀 ⇒ 把只读对账误判成"发角色码"。
    const writes = executableStatements(MIGRATION_SQL).filter((s) => /^(INSERT|UPDATE|DELETE|REPLACE)/i.test(s));

    // 红线本体（先查，红了直接点名语句）：写语句里不得出现对角色表（t_sys_role / t_sys_role_permission）的写动作
    const roleWrites = writes.filter((s) =>
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|REPLACE\s+INTO)\s+t_sys_role(?:_permission)?\b/i.test(s),
    );
    expect(roleWrites, `发现写角色表的可执行语句：${roleWrites.join(" | ")}`).toHaveLength(0);
    // 零授权 ⇒ 也不得出现任何 JSON_ARRAY_APPEND 写权限数组的语句
    expect(writes.filter((s) => /JSON_ARRAY_APPEND/i.test(s))).toHaveLength(0);
    // 本批仍然只允许一条写语句（t_sys_menu 插菜单）
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain("INSERT INTO t_sys_menu");

    // 反向锚点：只读对账语句**必须仍在**（防"把判据改宽到再也看不见 t_sys_role"）
    expect(MIGRATION_SQL).toMatch(/SELECT[^;]*FROM t_sys_role/i);
  });
});

describe("S3-236 目录声明的端点确实存在（防码对着不存在的端点）", () => {
  it.each(
    BATCH2_PERMISSION_CATALOG.flatMap((e) =>
      e.endpoints.map((ep, index) => ({
        code: e.code,
        routeFile: e.routeFiles?.[index] ?? e.routeFile,
        ep,
      })),
    ),
  )("$code → $ep 在 $routeFile 里能找到", ({ routeFile, ep }) => {
    const routePath = resolve(ROUTES_DIR, routeFile);
    expect(existsSync(routePath), `缺少路由文件 ${routeFile}`).toBe(true);
    const src = readUtf8(routePath);
    const { ok, detail } = endpointRegistered(src, ep);
    expect(ok, `${routeFile} 里找不到 ${ep} 的注册行（核对形态：${detail}）`).toBe(true);
  });

  it("路由文件与本批 38 码同一套（没有把别的域的文件写进目录）", () => {
    const files = [
      ...new Set(
        BATCH2_PERMISSION_CATALOG.flatMap((e) => e.routeFiles ?? [e.routeFile]),
      ),
    ];
    expect(files.sort()).toEqual(
      [
        "custom-report-v2.routes.ts",
        "custom-report.routes.ts",
        "report-permissions.routes.ts",
        "report.routes.ts",
        "print.routes.ts",
        "store-hardware.routes.ts",
        "miniapp-config.routes.ts",
        "miniapp-order-sync.routes.ts",
        "workbench.routes.ts",
      ].sort(),
    );
  });

  it("前端入口登记字段必须写明出处（有调用点写文件:行号，无则写'暂无前端入口，仅后端授权位'）", () => {
    for (const entry of BATCH2_PERMISSION_CATALOG) {
      expect(entry.frontendEntry.length).toBeGreaterThan(0);
      const hasCallSite = /\.(vue|ts|tsx|js):\d+/.test(entry.frontendEntry);
      expect(
        hasCallSite || entry.frontendEntry.startsWith("暂无前端入口，仅后端授权位"),
        `${entry.code} 的 frontendEntry 形态不合规：${entry.frontendEntry}`,
      ).toBe(true);
    }
  });
});

describe("S3-236 零业务改动自证（本批只立码）", () => {
  it("迁移 207 不含任何业务表名（只写 t_sys_menu）", () => {
    const writeStatements = executableStatements(MIGRATION_SQL).filter((s) =>
      /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(s),
    );
    expect(writeStatements).toHaveLength(1);
    expect(writeStatements[0]).toContain("INSERT INTO t_sys_menu");
    // 除 t_sys_menu 外不得出现其它 `t_` 表的写语句（读语句允许：末尾三条只读自证核对）
    for (const stmt of writeStatements) {
      const tables = [...stmt.matchAll(/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+(t_[a-z_]+)/gi)].map(
        (m) => m[1],
      );
      expect(tables).toEqual(["t_sys_menu"]);
    }
  });
});
