#!/usr/bin/env node
/**
 * S3-233 · 门的端点面 → 后端扫描 对账器（只读，不改任何文件）
 *
 * 作用（供本单 §二.1「门数 N / 端点数 M / 已接 K / 跳过」逐条列数用）：
 *   1. 读**唯一真相源** `app-mobile/src/config/permission-gates.ts` 的 `ENTRY_GATES`
 *      （该文件零依赖纯常量，这里按「提取数组字面量 + 求值」读取，避免为一条证据脚本引入 TS 运行时）；
 *   2. 跑 `backend/scripts/guard-rbac-wiring.mjs --json` 拿后端写端点的真实形态
 *      （hasPermission / authForm 由门禁脚本现场解析，与本脚本无第二套判据）；
 *   3. 逐条比对 `gated` 门的每个 endpoint：扫到没扫到 / 是否已挂权限 / 挂的是哪个码；
 *      并从该端点所在**源码行**里抽出 `requirePermission("…")` / `requirePlatformPermission("…")` 的实参。
 *
 * 用法：
 *   node docs/evidence/S3-233/tools/s3238-gate-scope.mjs           人读表
 *   node docs/evidence/S3-233/tools/s3238-gate-scope.mjs --json    机读
 *
 * ⚠️ 本脚本是**取证器**，不做判定、不改码；判定见 §二 判据与用例
 *    `backend/src/__tests__/routes/rbac-b2-s3-233-gate-wiring-parity.test.ts`。
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..", "..");
const GATES_TS = resolve(REPO, "app-mobile", "src", "config", "permission-gates.ts");

/** 从 `permission-gates.ts` 里取出 `ENTRY_GATES` 数组字面量并求值（纯数据，无函数依赖） */
function loadEntryGates() {
  const src = readFileSync(GATES_TS, "utf8");
  const start = src.indexOf("export const ENTRY_GATES");
  if (start < 0) throw new Error("找不到 ENTRY_GATES 声明");
  // ⚠️ 必须从 `= [` 起找：声明里的类型标注是 `ENTRY_GATES: EntryGate[]`，
  //    直接找 `[` 会命中类型标注的空方括号（实测踩到：配平到 0 长度 ⇒ gates 空数组）。
  const eq = src.indexOf("=", start);
  const open = src.indexOf("[", eq);
  if (eq < 0 || open < 0) throw new Error("找不到 ENTRY_GATES 赋值");
  // 从 `[` 起做括号配平（数组字面量里没有字符串含未转义的方括号，本文件已核对）
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error("ENTRY_GATES 数组未配平");
  const literal = src.slice(open, end + 1);
  // 数组字面量是合法 JS（对象键为裸标识符、值多为字符串/数组字面量）
  const gates = new Function(`return (${literal});`)();
  return { gates, line: src.slice(0, start).split("\n").length };
}

/** 跑门禁脚本拿后端写端点全量形态（判据与门禁同源，不另起一套） */
function scanBackend() {
  const out = execFileSync(
    process.execPath,
    [resolve(REPO, "backend", "scripts", "guard-rbac-wiring.mjs"), "--json"],
    { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  return JSON.parse(out);
}

/** 在端点所在源码行内抽出权限码实参（与门禁的「同行/同调用内联」判据同口径） */
function codesOnEndpointLine(file, method, path) {
  const abs = resolve(REPO, "backend", "src", "routes", file);
  let text;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    return { codes: [], lines: [] };
  }
  const lines = text.split("\n");
  // 端点里最后一段（去掉前缀与参数占位）用于定位注册行
  const tail = path.replace(/^.*?(\/[A-Za-z0-9\-_:\.\/]*)$/, "$1");
  const segs = tail.split("/").filter((s) => s && !s.startsWith(":"));
  const lastSeg = segs.length ? segs[segs.length - 1] : "";
  const callRe = new RegExp(
    `\\.\\s*r?o?u?t?e?r?\\s*\\.?\\s*${method.toLowerCase()}\\s*\\(\\s*["'\`]`
  );
  const out = [];
  lines.forEach((line, idx) => {
    if (!callRe.test(line)) return;
    if (lastSeg && !line.includes(lastSeg)) return;
    const codes = [];
    const re = /\brequire(?:Platform)?Permission\s*\(\s*["'`]([^"'`]+)["'`]/g;
    let m;
    while ((m = re.exec(line))) codes.push(m[1]);
    out.push({ lineNo: idx + 1, codes, text: line.trim() });
  });
  return { codes: [...new Set(out.flatMap((o) => o.codes))], lines: out };
}

const { gates } = loadEntryGates();
const scan = scanBackend();
const key = (m, p) => `${m.toUpperCase()} ${p}`;
const byKey = new Map();
for (const row of scan) {
  const k = key(row.method, row.path);
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(row);
}

const report = gates.map((gate) => ({
  id: gate.id,
  domain: gate.domain,
  status: gate.status,
  codes: gate.codes,
  endpoints: gate.endpoints.map((ep) => {
    const sp = ep.indexOf(" ");
    const method = ep.slice(0, sp);
    const path = ep.slice(sp + 1);
    const rows = byKey.get(key(method, path)) ?? [];
    const row = rows[0] ?? null;
    const wired = row ? codesOnEndpointLine(row.file, method, path) : { codes: [], lines: [] };
    return {
      endpoint: ep,
      found: rows.length > 0,
      matches: rows.length,
      file: row?.file ?? null,
      hasPermission: row?.hasPermission ?? null,
      authForm: row?.authForm ?? null,
      wiredCodes: wired.codes,
      lines: wired.lines,
    };
  }),
}));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const g of report) {
    console.log(`\n[${g.status}] ${g.id} · ${g.domain} · 门码=${JSON.stringify(g.codes)}`);
    for (const e of g.endpoints) {
      const state = !e.found
        ? "❌ 后端未扫到该写端点"
        : e.hasPermission
          ? `✅ 已挂权限（${e.authForm}）码=${JSON.stringify(e.wiredCodes)}`
          : `⚠️ 未挂权限（${e.authForm}）`;
      console.log(`   ${e.endpoint} ⇒ ${state}${e.file ? `  [${e.file}]` : ""}`);
    }
  }
}
