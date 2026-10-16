#!/usr/bin/env node
/**
 * S3-236 判据 1 的**可复跑装置**：三方（目录 ↔ 迁移 207 ↔ 路由注册行）逐条比对。
 *
 * ⚠️ 为什么另写一个装置（诚实标注）：本沙箱里 vitest 起不来 ——
 *   `vite` 加载 `backend/vitest.config.ts` 要靠 `esbuild` 的 **service 子进程 + 管道 stdio**，
 *   而在本会话的受限沙箱下 `child_process.spawn` 报 `EPERM`（这是文档写明的沙箱边界，不是代码问题）。
 *   故断言以**同一份判据**在本装置里复跑（用 `tsx` 直接加载 TS 目录常量，与本仓库单测**同一份源码**）：
 *   条数 / 命名规范 / 目录↔迁移双向一致 / sort_no 序列 / 提取器分辨力 / 路由注册行存在性 / 父行白名单 /
 *   零授权 / 幂等守卫 —— 逐条打印 PASS/FAIL 与**具体差异**（判红时点名到码）。
 *
 * 用法（仓库根执行）：node docs/evidence/S3-236/harness/verify-three-way.mjs
 * 反测（判据 6）：`--inject-drop <码名>` 会先删掉迁移里该码那一行再跑 ⇒ 必须判红并点名；
 *                 `--migration <路径>` 可换成注入版迁移（不污染工作树里的 207）。
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(process.cwd());
const argv = process.argv.slice(2);
const dropCode = argv.includes("--inject-drop") ? argv[argv.indexOf("--inject-drop") + 1] : null;

const MIGRATION_REL = "docs/migrations/207_四域权限点立码.sql";
let migrationSql = readFileSync(resolve(repoRoot, MIGRATION_REL), "utf-8").replace(/\r\n/g, "\n");

if (dropCode) {
  const before = migrationSql;
  // 只删这一行（该码的 UNION ALL / SELECT 行），保留其余逐字不变
  migrationSql = migrationSql
    .split("\n")
    .filter((line) => !(line.includes(`'${dropCode}' AS code`)))
    .join("\n");
  if (migrationSql === before) {
    console.error(`✗ 反测注入失败：迁移里找不到 ${dropCode}`);
    process.exit(2);
  }
  console.log(`⚠️ 反测模式：已从迁移文本里删掉 ${dropCode} 那一行（仅内存，不落盘）\n`);
}

// ── 加载目录常量（同一份源码） ─────────────────────────────────────
// ⚠️ 为什么用"动态 import + 变量路径"而不是 spawn：
//    本沙箱下任何 `spawn(..., stdio:'pipe')` 都报 EPERM（文档写明的边界；tsx/esbuild/vitest 都栽在这），
//    故改为**同进程**动态 import —— 变量路径保证走运行时解析器，从而命中本目录的解析钩子
//    （`ts-resolve-hooks.mjs` 把无扩展名的相对 import 补成 `.ts`）。
const CATALOG_PATH = pathToFileURL(
  resolve(repoRoot, "backend/src/shared/batch2-permission-codes.ts"),
).href;
let catalogModule;
try {
  catalogModule = await import(CATALOG_PATH);
} catch (e) {
  console.error(
    "✗ 无法加载目录常量：",
    e.message,
    "\n  请按下面这行跑本装置（需要类型剥离 + 解析钩子）：" +
      "\n  node --experimental-strip-types --import ./docs/evidence/S3-236/harness/ts-resolve-hooks.mjs docs/evidence/S3-236/harness/verify-three-way.mjs",
  );
  process.exit(2);
}
const {
  BATCH2_PERMISSION_COUNT: count,
  BATCH2_PERMISSION_ENDPOINT_COUNT: endpointCount,
  BATCH2_DOMAIN_COUNTS: domainCounts,
  BATCH2_PERMISSION_MIGRATION: migration,
  BATCH2_PERMISSION_MIGRATION_NO: migrationNo,
  BATCH2_PERMISSION_MODULES: modules,
  BATCH2_FORBIDDEN_PERMISSION_ACTIONS: forbidden,
  BATCH2_ALLOWED_TWO_SEGMENT_ACTIONS: twoSegmentActions,
  BATCH2_PERMISSION_CATALOG: catalog,
  BATCH2_PERMISSION_CODES: codes,
} = catalogModule;

// ── 判据实现（与 backend/src/__tests__/shared/batch2-permission-codes.test.ts 同口径） ──
const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail ?? "" });
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
  }
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function extractMigrationCodes(sql) {
  const rows = [];
  // 兼容三种写法：① 首行 `SELECT 'x' AS code, 'y' AS name, n AS sort_no, 'p' AS parent_code`；
  // ② 后续 `UNION ALL SELECT ...`（同形）；③ 省略 `AS xxx` 别名的简写（S3-232 的 204 写法）。
  // ⚠️ `UNION ALL` 必须可选 —— 首行没有它（本装置首版漏掉首行 ⇒ 只提到 37 条）
  const rowRe =
    /SELECT\s+'([^']+)'(?:\s+AS\s+code)?,\s*'([^']+)'(?:\s+AS\s+name)?,\s*(\d+)(?:\s+AS\s+sort_no)?,\s*'([^']+)'(?:\s+AS\s+parent_code)?/g;
  let m;
  while ((m = rowRe.exec(sql)) !== null) {
    rows.push({ code: m[1], name: m[2], sortNo: Number(m[3]), parent: m[4] });
  }
  return rows;
}

/** 去注释：**去掉行首注释行** + 语句内的行尾 `-- ...` 注释（防"注释里的表名/码名"被当写动作） */
function stripComments(text) {
  return text
    .split("\n")
    .map((line) => (line.trim().startsWith("--") ? "" : line.replace(/\s--\s.*$/, "")))
    .join("\n");
}

const extracted = extractMigrationCodes(migrationSql);

check("① 条数：目录 38 / 逐域 11+14+5+8 / 端点 45", () => {
  assert(count === 38, `目录条数 ${count} ≠ 38`);
  assert(catalog.length === 38, `目录长度 ${catalog.length} ≠ 38`);
  assert(codes.length === 38, `码数组长度 ${codes.length} ≠ 38`);
  assert(endpointCount === 45, `端点数 ${endpointCount} ≠ 45`);
  assert(
    domainCounts.report === 11 && domainCounts.hardware === 14 && domainCounts.miniapp === 5 && domainCounts.dashboard === 8,
    `逐域条数异常：${JSON.stringify(domainCounts)}`,
  );
  return `38 码 / 45 端点 / 域 11+14+5+8`;
});

check("② 命名规范：三段式（或两段式且动作在白名单）+ 模块白名单 + 无 manage + 无通配符 + 小写", () => {
  const seen = new Set();
  const twoSegment = [];
  for (const entry of catalog) {
    assert(!seen.has(entry.code), `码重复：${entry.code}`);
    seen.add(entry.code);
    const segs = entry.code.split(":");
    assert(segs.length === 3 || segs.length === 2, `码形态异常（非二/三段）：${entry.code}`);
    assert(modules.includes(entry.module), `模块不在白名单：${entry.module}`);
    assert(segs[0] === entry.module, `首段与 module 不一致：${entry.code}`);
    assert(segs[segs.length - 1] === entry.action, `末段与 action 不一致：${entry.code}`);
    if (segs.length === 2) {
      assert(
        twoSegmentActions.includes(entry.action),
        `两段式码的动作不在白名单（079 既有动作先例）内：${entry.code}`,
      );
      twoSegment.push(entry.code);
    }
    for (const seg of segs) {
      assert(seg !== "*", `含通配符：${entry.code}`);
      assert(!forbidden.includes(seg), `含禁止动作：${entry.code}`);
      assert(/^[a-z0-9-]+$/.test(seg), `段含非法字符：${entry.code}`);
    }
  }
  return `${seen.size} 码全部合规（本批唯一两段式码：${twoSegment.join(", ") || "无"}）`;
});

check("③ 目录 ↔ 迁移双向一致（码名集合 + 中文名逐字）", () => {
  const fromMigration = extracted.map((r) => `${r.code}=${r.name}`).sort();
  const fromCatalog = catalog.map((e) => `${e.code}=${e.name}`).sort();
  const missingInMigration = fromCatalog.filter((x) => !fromMigration.includes(x));
  const extraInMigration = fromMigration.filter((x) => !fromCatalog.includes(x));
  // 点名：判红时必须**列出具体码名**（否则"有差异"这句话对排查毫无价值）
  assert(
    missingInMigration.length === 0,
    `目录有、迁移无（${missingInMigration.length} 条）：${missingInMigration.join(" | ")}`,
  );
  assert(
    extraInMigration.length === 0,
    `迁移有、目录无（${extraInMigration.length} 条）：${extraInMigration.join(" | ")}`,
  );
  return `双向各 38 条一致（提取 ${extracted.length} 条）`;
});

check("④ sort_no 连续 1..38 且顺序 = 目录顺序", () => {
  const sortNos = extracted.map((r) => r.sortNo);
  const expected = [...Array(38)].map((_, i) => i + 1);
  assert(JSON.stringify(sortNos) === JSON.stringify(expected), `sort_no 序列异常：${sortNos.join(",")}`);
  const codesFromMigration = extracted.map((r) => r.code);
  const diff = codesFromMigration.filter((c, i) => c !== codes[i]);
  assert(diff.length === 0, `顺序不一致，首个差异：${diff[0]}`);
  return `1..38 连续且与目录顺序一一对应`;
});

check("⑤ 提取器分辨力自证：注入假码 ⇒ 提取结果多出该码", () => {
  const injected = `${migrationSql}\n  UNION ALL SELECT 'report:bogus:code', '注入假码', 99, 'report'\n) c;\n`;
  const got = extractMigrationCodes(injected);
  assert(got.length === 39, `注入后条数 ${got.length} ≠ 39`);
  assert(
    got.map((r) => r.code).includes("report:bogus:code"),
    "注入的假码没被提取到（提取器或正则失效）",
  );
  return "注入 'report:bogus:code' ⇒ 提取 39 条且含该码";
});

check("⑥ 父行白名单：目录 menuParent 与迁移 parent_code 逐条一致且都是 079 的 CATALOG 码", () => {
  const sql079 = readFileSync(resolve(repoRoot, "docs/migrations/079_权限矩阵.sql"), "utf-8");
  const catalogCodes = [];
  const re = /\((\d+),\s*NULL,\s*'([a-z-]+)',\s*'[^']+',\s*'CATALOG'/g;
  let m;
  while ((m = re.exec(sql079)) !== null) catalogCodes.push(m[2]);
  assert(catalogCodes.length >= 11, `079 里只解析到 ${catalogCodes.length} 个 CATALOG 码`);
  for (const row of extracted) {
    const entry = catalog.find((e) => e.code === row.code);
    assert(entry, `目录缺少 ${row.code}`);
    assert(entry.menuParent === row.parent, `${row.code} 父行不一致：目录 ${entry.menuParent} / 迁移 ${row.parent}`);
    assert(catalogCodes.includes(row.parent), `${row.code} 的父行 ${row.parent} 不是 079 的 CATALOG 码`);
  }
  return `父行集合 {${[...new Set(extracted.map((r) => r.parent))].sort().join(", ")}} ⊂ 079 CATALOG ${catalogCodes.length} 码`;
});

check("⑦ 端点在路由文件里存在（前缀 + 注册行两段拼接核对）", () => {
  const routesDir = resolve(repoRoot, "backend/src/routes");
  let checked = 0;
  for (const entry of catalog) {
    entry.endpoints.forEach((ep, index) => {
      const routeFile = entry.routeFiles?.[index] ?? entry.routeFile;
      const routePath = resolve(routesDir, routeFile);
      assert(existsSync(routePath), `缺少路由文件 ${routeFile}（${entry.code}）`);
      const src = readFileSync(routePath, "utf-8").replace(/\r\n/g, "\n");
      const [method, fullPath] = ep.replace(/#tail#/g, "").replace(/#id#/g, ":id").split(" ");
      // ① 前缀：文件里声明的**任一** prefix 都必须能让端点路径"前缀 + 相对段"拼回原文
      //    （单 routeConfig 文件只有一个 prefix；store-hardware 有 5 个挂载段）
      const prefixes = [...src.matchAll(/prefix:\s*"([^"]+)"/g)].map((mm) => mm[1]);
      assert(prefixes.length > 0, `${routeFile} 里找不到 routeConfig.prefix（${entry.code}）`);
      assert(
        prefixes.some((prefix) => fullPath.startsWith(prefix)),
        `${entry.code} 的端点 ${fullPath} 不以 ${routeFile} 的任何前缀开头（${prefixes.join(" / ")}）`,
      );
      // ② 注册行：改为**字形核对**（不用正则拼反斜杠 —— 那是本装置前三版都栽进去的坑）：
      //    找 `.method("` 的锚点，再在其后 200 字符窗口里逐段找相对路径的**各段**
      //    （`/:id(\d+)/generate` → 段 `:id` 与 `generate`，参数段的正则约束按 `(` 截断）。
      const registered = prefixes.some((prefix) => {
        if (!fullPath.startsWith(prefix)) return false;
        const relative = fullPath.slice(prefix.length) || "/";
        const segments = relative.split("/").filter((s) => s.length > 0);
        const anchor = `.${method.toLowerCase()}("`;
        let from = 0;
        while (from < src.length) {
          const idx = src.indexOf(anchor, from);
          if (idx < 0) break;
          const window = src.slice(idx, idx + 200);
          if (segments.length === 0) {
            // 前缀本身即端点（`prefix: "/api/admin/reports"` + `.post("/")`）
            if (/\.\w+\("\/(?:",|\s*\))/.test(window) || window.includes("`/`")) return true;
          } else if (segments.every((seg) => window.includes(seg.split("(")[0]))) {
            return true;
          }
          from = idx + anchor.length;
        }
        return false;
      });
      assert(
        registered,
        `${entry.code} 的端点 ${fullPath} 在 ${routeFile} 里找不到注册行（${method}，前缀 ${prefixes.join(" / ")}）`,
      );
      checked += 1;
    });
  }
  return `${checked} 个端点全部命中「前缀 + 注册行」两段`;
});

check("⑧ 零授权：迁移里**没有任何写 t_sys_role 的语句**（只读 SELECT 自证不算）", () => {
  // ⚠️ 判据要精确：本迁移末尾的**只读自证 SELECT** 会读 t_sys_role（数"持新码的角色行数"），
  //    那是核对读数、不是授权动作 ⇒ 判据只对 INSERT/UPDATE/DELETE/REPLACE 判红。
  //    （首版误把 SELECT 里的表名也算成写动作，属判据过严。）
  const executable = stripComments(migrationSql);
  assert(!/JSON_ARRAY_APPEND/.test(executable), "可执行语句里出现 JSON_ARRAY_APPEND（= 有角色授权动作）");
  const statements = executable
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const writes = statements.filter((s) => /^(INSERT|UPDATE|DELETE|REPLACE)/i.test(s));
  assert(
    writes.length === 1 && writes[0].includes("INSERT INTO t_sys_menu"),
    `写语句应为 1 条 INSERT INTO t_sys_menu，实际 ${writes.length} 条：${writes.map((w) => w.slice(0, 60)).join(" || ")}`,
  );
  const roleWrites = writes.filter((s) => /t_sys_role/i.test(s));
  assert(roleWrites.length === 0, `出现写 t_sys_role 的语句：${roleWrites[0]?.slice(0, 80)}`);
  return "唯一写语句 = INSERT INTO t_sys_menu；0 条写 t_sys_role 的语句（末尾 SELECT 只是只读自证）";
});

check("⑨ 幂等守卫：NOT EXISTS(menu_code, tenant_id) + 父行 CATALOG/顶层判定", () => {
  assert(
    /NOT EXISTS \(\s*SELECT 1 FROM t_sys_menu d WHERE d\.tenant_id = p\.tenant_id AND d\.menu_code = c\.code\s*\)/.test(
      migrationSql,
    ),
    "缺 (menu_code, tenant_id) 的 NOT EXISTS 守卫",
  );
  assert(/WHERE p\.menu_code = c\.parent_code/.test(migrationSql), "缺父行按 parent_code 定位");
  assert(/p\.menu_type = 'CATALOG'/.test(migrationSql), "缺父行 CATALOG 判定");
  assert(/p\.parent_id IS NULL/.test(migrationSql), "缺父行顶层判定");
  return "四处守卫齐备";
});

check("⑩ 迁移编号 = 207 且文件名与目录常量一致", () => {
  assert(migrationNo === 207, `目录声明的编号 ${migrationNo} ≠ 207`);
  assert(migration.startsWith("207_"), `迁移文件名 ${migration} 不以 207_ 开头`);
  assert(existsSync(resolve(repoRoot, "docs/migrations", migration)), `迁移文件不存在：${migration}`);
  return `${migration}（编号 ${migrationNo}）`;
});

// ── 打印 ───────────────────────────────────────────────────────────
console.log("S3-236 判据 1 三方一致 · 复跑装置（目录 ↔ 迁移 207 ↔ 路由注册行）");
console.log(`迁移：${MIGRATION_REL}${dropCode ? `（反测：已删 ${dropCode}）` : ""}`);
console.log("");
let failed = 0;
for (const [i, r] of results.entries()) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${String(i + 1).padStart(2, "0")}. ${r.name}`);
  if (r.detail) console.log(`        ${r.detail}`);
  if (!r.ok) failed += 1;
}
console.log("");
console.log(`合计 ${results.length} 条判据：${results.length - failed} PASS / ${failed} FAIL`);
process.exit(failed === 0 ? 0 : 1);
