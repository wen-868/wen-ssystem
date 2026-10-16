#!/usr/bin/env node
/**
 * S3-233 · 既有用例「锁定表」扫描器（只读）
 *
 * 作用：把本单 `gated` 门的端点，与**既有批次用例**里「未接 / 待裁」锁定行的 `file + routePath + prefix`
 *   做交集 —— 这些行在 S3-230 补门之后**契约反转**（B 类根因消失 ⇒ 应当接线），因此必须随本单一起
 *   从「未接」名单移入「已接」名单，否则 `npx vitest run` 会因"注册行不含 requirePermission("的旧断言而红。
 *
 * 用法：node docs/evidence/S3-233/tools/s3238-lock-scan.mjs [--json]
 */
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..", "..");
const TESTS = resolve(REPO, "backend", "src", "__tests__", "routes");

// 1) 本单门端点（复用取证器的 --json 输出，判据同源）
const scope = JSON.parse(
  execFileSync(process.execPath, [resolve(HERE, "s3238-gate-scope.mjs"), "--json"], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
);
const gatedEndpoints = [];
for (const g of scope) {
  if (g.status !== "gated") continue;
  for (const e of g.endpoints) {
    const [method, path] = e.endpoint.split(" ");
    gatedEndpoints.push({ gate: g.id, method, path, file: e.file, wired: e.hasPermission });
  }
}

// 2) 扫描既有用例里的「锁定行」：形如 { file: "x.routes.ts", prefix: "…", router: X, routePath: "…", … }
const ROW_RE =
  /\{\s*file:\s*"([^"]+)"[\s\S]{0,600}?prefix:\s*"([^"]+)"[\s\S]{0,600}?routePath:\s*"([^"]+)"([\s\S]{0,400}?)\}/g;

const hits = [];
/** 声明数组名（用于区分「已接 ROWS / 未接 UNWIRED / 既有锁定」） */
const DECL_RE = /const\s+(\w+)\s*(?::[^=]*)?=\s*\[/g;
for (const name of readdirSync(TESTS).filter((f) => /^rbac-.*\.test\.ts$/.test(f))) {
  const text = readFileSync(resolve(TESTS, name), "utf8");
  const lines = text.split("\n");
  const decls = [...text.matchAll(DECL_RE)].map((m) => ({ name: m[1], at: m.index }));
  for (const m of text.matchAll(ROW_RE)) {
    const [raw, file, prefix, routePath, tail] = m;
    const lineNo = text.slice(0, m.index).split("\n").length;
    // ⚠️ `method:` 在多数锁定行里**排在 routePath 之前**（`{file, prefix, router, method, routePath,…}`），
    //    故必须从**整段命中文本**取，不能只看 routePath 之后的 tail（实测踩到：只看 tail ⇒ 一律回落 POST，
    //    put/delete 行全部漏检，命中数从 47 虚降）。
    const method = /method:\s*"(\w+)"/.exec(raw)?.[1]?.toUpperCase() ?? "POST";
    const full = `${method} ${joinPath(prefix, routePath)}`;
    const hit = gatedEndpoints.find((e) => e.method.toUpperCase() === method && e.path === joinPath(prefix, routePath));
    if (hit) {
      const reason = /reason:\s*"([^"]*)"/.exec(tail)?.[1] ?? null;
      const arr = decls.filter((d) => d.at < m.index).pop()?.name ?? "?";
      hits.push({ test: name, lineNo, array: arr, raw: lines[lineNo - 1].trim(), gate: hit.gate, full, reason });
    }
  }
}

// 3) 本单门端点里**没有任何锁定行**的（既有用例不锁 ⇒ 只需接线，不必改用例）
const lockedKeys = new Set(hits.map((h) => `${h.test}|${h.full}`));
const unlockedEndpoints = gatedEndpoints.filter(
  (e) => !hits.some((h) => h.full === `${e.method.toUpperCase()} ${e.path}`)
);

// 4) 机读台账 gaps 命中情况（接线后必须逐条移除，否则 --strict 报「陈旧」）
const baseline = JSON.parse(
  readFileSync(resolve(REPO, "backend", "scripts", "rbac-wiring-baseline.json"), "utf8")
);
const gapKeys = new Set(
  Object.values(baseline.gaps).flat().map((s) => s.replace(/\s+/g, " ").trim().toUpperCase())
);
const inGaps = gatedEndpoints.filter((e) => gapKeys.has(`${e.method.toUpperCase()} ${e.path}`.toUpperCase()));

function joinPath(prefix, routePath) {
  if (routePath === "/") return prefix + "/";
  return `${prefix}${routePath}`.replace(/\/{2,}/g, "/");
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ hits, unlockedEndpoints, inGaps }, null, 2));
} else {
  const byTest = new Map();
  for (const h of hits) {
    if (!byTest.has(h.test)) byTest.set(h.test, []);
    byTest.get(h.test).push(h);
  }
  console.log(`命中锁定行 ${hits.length} 条，分布在 ${byTest.size} 个用例文件：`);
  for (const [t, rows] of byTest) {
    console.log(`\n${t}  (${rows.length})`);
    for (const r of rows) console.log(`  L${r.lineNo} ${r.array} [${r.gate}] ${r.full} reason=${r.reason}`);
  }
  console.log(`\n—— 本单门端点（唯一 ${new Set(gatedEndpoints.map((e) => `${e.method} ${e.path}`)).size} 条）无任何既有锁定行的：`);
  for (const e of unlockedEndpoints) console.log(`  [${e.gate}] ${e.method} ${e.path}`);
  console.log(`\n—— 在机读台账 gaps 里的门端点：${inGaps.length} 条`);
  for (const e of inGaps) console.log(`  [${e.gate}] ${e.method} ${e.path}`);
}
