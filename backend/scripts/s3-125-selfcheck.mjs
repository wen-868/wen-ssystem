#!/usr/bin/env node
/**
 * S3-125（G2）自检脚本 —— “数据 ↔ 判据”离线复核（纯 node 直跑）
 *
 * 为什么需要它（S3-125-F1 的直接教训）：
 *   本沙箱**跑不了 vitest**（esbuild `spawn EPERM`，见 `docs/踩坑日志.md`[143]），
 *   于是 `backend/src/__tests__/routes/rbac-g2-wiring.test.ts` 里
 *   “我写的数据”与“我写的正则判据”是否自洽，只能等凌舟真跑 `npx vitest run` 才暴露。
 *   S3-125 就是这样挂的：`bank-account.routes.ts /:id/close` 的 note 写成 `同上（…）`，
 *   不满足它自己的 `/function-menu\.ts:\d+|t_sys_menu|零菜单映射|无条件/`。
 *
 * 本脚本做什么：
 *   把该测试文件里的**数据**（名单、note 原文、角色权限串、行级注册行）从源码里抽出来，
 *   用与测试**逐字相同**的判据复算一遍，逐条打印 PASS/FAIL 与总结；
 *   不 spawn 任何子进程、不依赖 vitest/vite/esbuild，`node` 直跑即可。
 *   因此它可以独立发现同类不一致：把 note 改回 `同上` ⇒ 本脚本必报 FAIL。
 *
 * 用法（任意工作目录）：
 *   node backend/scripts/s3-125-selfcheck.mjs [被测测试文件路径]
 *   —— 省略入参时取 `backend/src/__tests__/routes/rbac-g2-wiring.test.ts`；
 *      给路径可对**任意副本**复算（反测用：把 note 改回「同上」的副本 ⇒ 必报 FAIL），
 *      路由文件固定按 `backend/src/routes` 解析。
 * 退出码：0 = 全部 PASS；1 = 存在 FAIL。
 *
 * 覆盖的“数据 ↔ 判据”关系（全部取自 rbac-g2-wiring.test.ts 的实际断言）：
 *   A. 名单自证：12 行 = 已接 1 + 待裁 11（含 reason 分布 B 8 / C 2 / R 1）
 *   B. note 判据：该文件 `:580` / `:581` 两条 `toMatch`，逐行 × 逐正则
 *   C. C/R 类名单与「§三 授权未被使用」的 `toEqual` 集合、验收标准⑤点名的 3 行
 *   D. 行级形状断言：已接行注册行含 `requirePermission("<perm>")`、待裁行注册行不含（踩坑[134]）
 *   E. 权限持有人集合复算（真 `matchPermission` 语义 + USERS 表实值）与 allow 集合 ⊆ 持有人集合
 *   F. 交叉印证：G0「范围控制」名单锚点 + sale-return 的第二个挂载点 /api/store/sale-returns
 *
 * 保真度：判据侧全部照抄测试文件（含 note 正则、注册行正则、matchPermission 三段语义）；
 *   数据侧从测试文件源码抽取 ⇒ “数据改了、判据没动”这类不一致会被本脚本直接顶红。
 *   本脚本**只读**，不修改任何文件。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(HERE, "..");
const DEFAULT_TEST_FILE = path.join(BACKEND_DIR, "src", "__tests__", "routes", "rbac-g2-wiring.test.ts");
const TEST_FILE = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : DEFAULT_TEST_FILE;
const ROUTES_DIR = path.join(BACKEND_DIR, "src", "routes");
const SRC = readFileSync(TEST_FILE, "utf8");

// ───────────────────────────── 输出设施 ─────────────────────────────
let checkTotal = 0;
let failTotal = 0;
const failList = [];
function section(title) {
  console.log(`\n== ${title} ==`);
}
function check(ok, label, detail = "") {
  checkTotal++;
  if (!ok) {
    failTotal++;
    failList.push(label);
  }
  console.log(`  ${ok ? "[PASS]" : "[FAIL]"} ${label}${detail ? ` —— ${detail}` : ""}`);
}
function info(label) {
  console.log(`  [INFO] ${label}`);
}

// ───────────────────── 源码级抽取（不依赖 TS 编译器） ─────────────────────
/** 从 idx 处的开分隔符起，跳过字符串/注释，返回配平切片（含首尾分隔符） */
function balanced(text, idx) {
  let depth = 0;
  let quote = null;
  let lineCmt = false;
  let blockCmt = false;
  for (let i = idx; i < text.length; i++) {
    const ch = text[i];
    const nx = text[i + 1];
    if (lineCmt) {
      if (ch === "\n") lineCmt = false;
      continue;
    }
    if (blockCmt) {
      if (ch === "*" && nx === "/") {
        blockCmt = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && nx === "/") {
      lineCmt = true;
      i++;
      continue;
    }
    if (ch === "/" && nx === "*") {
      blockCmt = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "[" || ch === "{" || ch === "(") depth++;
    else if (ch === "]" || ch === "}" || ch === ")") {
      depth--;
      if (depth === 0) return { text: text.slice(idx, i + 1), start: idx, end: i };
    }
  }
  throw new Error(`配平失败：自偏移 ${idx} 起的分隔符未闭合`);
}

/** 取 `const <name> … = <字面量>` 的字面量原文（数组 / 对象均可） */
function declLiteral(name) {
  const m = new RegExp(`const\\s+${name}\\b`).exec(SRC);
  if (!m) throw new Error(`未找到声明 const ${name}`);
  const eq = SRC.indexOf("=", m.index);
  if (eq < 0) throw new Error(`const ${name} 缺少初始化`);
  const brace = SRC.indexOf("{", eq);
  const bracket = SRC.indexOf("[", eq);
  const useBracket = bracket >= 0 && (brace < 0 || bracket < brace);
  return balanced(SRC, useBracket ? bracket : brace).text;
}

/** 字面量里“顶层”的直接子对象 `{ … }`（含它前面的键前缀，供解析形如 `9001: {…}` 的条目） */
function childObjects(literal) {
  const out = [];
  let depth = 0;
  let quote = null;
  let lineCmt = false;
  let blockCmt = false;
  let start = -1;
  let cursor = 0;
  for (let i = 1; i < literal.length - 1; i++) {
    const ch = literal[i];
    const nx = literal[i + 1];
    if (lineCmt) {
      if (ch === "\n") lineCmt = false;
      continue;
    }
    if (blockCmt) {
      if (ch === "*" && nx === "/") {
        blockCmt = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && nx === "/") {
      lineCmt = true;
      i++;
      continue;
    }
    if (ch === "/" && nx === "*") {
      blockCmt = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push({ text: literal.slice(start, i + 1), keyPrefix: literal.slice(cursor, start) });
        cursor = i + 1;
        start = -1;
      }
      continue;
    }
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
  }
  return out;
}

/** 取对象文本里 `name: "字面量"` 的首个字符串值 */
function stringField(objText, name) {
  const m = new RegExp(`\\b${name}\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(objText);
  return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\") : null;
}

/** 收集文本里所有双引号字面量（按出现顺序） */
function stringLiterals(text) {
  return [...text.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
}

/** 取对象文本里 `name: [ … ]` 的数组原文 */
function arrayField(objText, name) {
  const idx = objText.indexOf(`${name}:`);
  if (idx < 0) return null;
  const open = objText.indexOf("[", idx);
  if (open < 0) return null;
  return balanced(objText, open).text;
}

const CONST_NUMBER = new Map(
  [...SRC.matchAll(/const\s+([A-Z0-9_]+)\s*=\s*(\d+)\s*;/g)].map((m) => [m[1], Number(m[2])])
);

/** 取 `name: [IDENT, IDENT]` 里的数字（标识符 → 常量表） */
function identifierArray(objText, name) {
  const literal = arrayField(objText, name);
  if (!literal) return [];
  return [...literal.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)]
    .map((m) => CONST_NUMBER.get(m[0]))
    .filter((v) => typeof v === "number");
}

// ───────────────────────────── 数据抽取 ─────────────────────────────
const UNWIRED = childObjects(declLiteral("UNWIRED")).map(({ text }, i) => {
  const noteIdx = text.indexOf("note:");
  if (noteIdx < 0) throw new Error(`第 ${i + 1} 个待裁行缺少 note`);
  const tail = text.slice(noteIdx + "note:".length);
  // 断言 note 是该行最后一个字段：剥掉字符串后应当只剩空白 / `+` / 字段分隔 `,` / 行尾 `}`
  const residue = tail.replace(/"(?:[^"\\]|\\.)*"/g, "").replace(/[\s+},]/g, "");
  if (residue !== "") {
    throw new Error(`第 ${i + 1} 个待裁行 note 之后还有内容，抽取不安全：${JSON.stringify(residue)}`);
  }
  return {
    file: stringField(text, "file"),
    routePath: stringField(text, "routePath"),
    path: stringField(text, "path"),
    reason: stringField(text, "reason"),
    note: stringLiterals(tail).join(""),
  };
});

const WIRED_MODULES = childObjects(declLiteral("WIRED_MODULES")).map(({ text }) => {
  const rowsLiteral = arrayField(text, "rows") ?? "[]";
  const rows = childObjects(rowsLiteral).map(({ text: rowText }) => ({
    routePath: stringField(rowText, "routePath"),
    path: stringField(rowText, "path"),
    perm: stringField(rowText, "perm"),
    allow: identifierArray(rowText, "allow"),
  }));
  return { file: stringField(text, "file"), prefix: stringField(text, "prefix"), rows };
});

const USERS = childObjects(declLiteral("USERS")).map(({ text, keyPrefix }) => {
  const idMatch = /(\d+)\s*:\s*$/.exec(keyPrefix);
  if (!idMatch) throw new Error(`USERS 条目无法解析键：${JSON.stringify(keyPrefix)}`);
  const permsLiteral = arrayField(text, "perms");
  if (!permsLiteral) throw new Error(`USERS ${idMatch[1]} 缺少 perms`);
  return { id: Number(idMatch[1]), name: stringField(text, "name"), perms: stringLiterals(permsLiteral) };
});

// ────────────────────── 判据侧：与测试逐字同源 ──────────────────────
/** 照抄 `backend/src/services/admin/rbac.service.ts:295` `matchPermission` 的四段语义 */
function matchPermission(perms, permCode) {
  if (!Array.isArray(perms) || typeof permCode !== "string" || permCode.length === 0) return false;
  if (perms.includes("*")) return true;
  const domIndex = permCode.indexOf(":");
  if (domIndex > 0 && perms.includes(`${permCode.slice(0, domIndex)}:*`)) return true;
  const actionIndex = permCode.lastIndexOf(":");
  if (actionIndex > -1 && actionIndex < permCode.length - 1 && perms.includes(`*:${permCode.slice(actionIndex + 1)}`)) {
    return true;
  }
  return perms.includes(permCode);
}

function holdersOf(perm) {
  return USERS.filter((u) => matchPermission(u.perms, perm))
    .map((u) => u.id)
    .sort((a, b) => a - b);
}

/** 照抄测试文件里的 `registrationLines`（踩坑[134]：判据必须落到注册行，注释行不算） */
function registrationLines(file, method, routePath) {
  const src = readFileSync(path.join(ROUTES_DIR, file), "utf8");
  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\.${method}\\(\\s*"${escaped}"`);
  return src
    .split(/\r?\n/)
    .map((line, i) => ({ line: line.trim(), no: i + 1 }))
    .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*") && re.test(line));
}

const WIRED_CASES = WIRED_MODULES.flatMap((m) =>
  m.rows.map((r) => ({ file: m.file, prefix: m.prefix, ...r, label: `${m.file} POST ${m.prefix}${r.path}` }))
);

// ───────────────────────────── 探针输出 ─────────────────────────────
console.log("S3-125（G2）自检：数据 ↔ 判据 离线复核（纯 node，无 vitest）");
console.log(`  数据源：${path.relative(process.cwd(), TEST_FILE) || TEST_FILE}`);
info(`抽取到 已接行 ${WIRED_CASES.length} / 待裁行 ${UNWIRED.length} / 测试账号 ${USERS.length}`);

// ── A. 名单自证（照抄“名单自证”describe） ──────────────────────────────
section("A) 名单自证（照抄测试文件「名单自证」describe）");
const bRows = UNWIRED.filter((r) => r.reason === "B");
const cRows = UNWIRED.filter((r) => r.reason === "C");
const rRows = UNWIRED.filter((r) => r.reason === "R");
check(WIRED_CASES.length === 1, "已接行数 = 1", `实际 ${WIRED_CASES.length}`);
check(UNWIRED.length === 11, "待裁行数 = 11", `实际 ${UNWIRED.length}`);
check(WIRED_CASES.length + UNWIRED.length === 12, "12 行 = 已接 1 + 待裁 11");
check(bRows.length === 8 && cRows.length === 2 && rRows.length === 1, "待裁原因分布 B 8 / C 2 / R 1", `实际 B${bRows.length} / C${cRows.length} / R${rRows.length}`);
const wiredPerFile = [...new Set(WIRED_CASES.map((r) => r.file))].sort();
check(JSON.stringify(wiredPerFile) === JSON.stringify(["expense.routes.ts"]), "已接 1 行分布：expense.routes.ts × 1", wiredPerFile.join(","));

// ── B. note 判据（照抄 :580 / :581 两条 toMatch） ──────────────────────
section("B) note 判据：B 类 8 行 × 2 条正则（照抄 rbac-g2-wiring.test.ts:580-581）");
const NOTE_HAS_MOBILE_CALLSITE = /\.vue:\d+/;
const NOTE_HAS_MENU_EVIDENCE = /function-menu\.ts:\d+|t_sys_menu|零菜单映射|无条件/;
for (const row of bRows) {
  const tag = `${row.file} POST ${row.routePath}`;
  check(NOTE_HAS_MOBILE_CALLSITE.test(row.note), `note 含 app-mobile 调用点（.vue:行）· ${tag}`, row.note);
  check(NOTE_HAS_MENU_EVIDENCE.test(row.note), `note 含页面→菜单映射证据 · ${tag}`, row.note);
}
const residualSameAs = [...WIRED_CASES, ...UNWIRED].filter((r) => typeof r.note === "string" && r.note.includes("同上"));
info(
  `残留“同上”简写 ${residualSameAs.length} 处（仅提示，不计入 FAIL）：` +
    (residualSameAs.length ? residualSameAs.map((r) => `${r.file} POST ${r.routePath}`).join(" / ") : "无")
);

// ── C. C/R 名单与点名行（照抄“§三 授权未被使用”与“验收标准⑤”两个用例） ──
section("C) C/R 名单集合与验收标准⑤点名行（照抄对应用例）");
check(
  JSON.stringify(cRows.concat(rRows).map((r) => `${r.file} ${r.routePath}`).sort()) ===
    JSON.stringify([
      "payment-new.routes.ts /",
      "sale-return.routes.ts /",
      "store-value-card.routes.ts /:cardNo/recharge",
    ]),
  "「§三 授权未被使用」：C/R 三行全判待裁",
  cRows.concat(rRows).map((r) => `${r.file} ${r.routePath}`).join(" / ")
);
const named = UNWIRED.filter(
  (r) =>
    (r.file === "bank-account.routes.ts" && r.routePath === "/") ||
    (r.file === "bank-account.routes.ts" && r.routePath === "/:id/close") ||
    (r.file === "receipt.routes.ts" && r.routePath === "/")
);
check(named.length === 3, "验收标准⑤点名的 3 行（bank / · bank close · receipt /）确实存在", `实际 ${named.length}`);
check(
  UNWIRED.every((r) => ["B", "C", "R"].includes(r.reason)) && UNWIRED.every((r) => r.note.length > 0),
  "11 行 reason ∈ {B,C,R} 且 note 非空"
);

// ── D. 行级形状断言（照抄 registrationLines 用例） ────────────────────
section("D) 行级形状断言：注册行是否自带 requirePermission(（踩坑[134]）");
for (const row of WIRED_CASES) {
  try {
    const lines = registrationLines(row.file, "post", row.routePath);
    check(lines.length === 1, `${row.label}：注册行数 = 1`, `实际 ${lines.length}（行号 ${lines.map((l) => l.no).join(",")}）`);
    if (lines.length === 1) {
      check(
        lines[0].line.includes(`requirePermission("${row.perm}")`),
        `${row.label}：注册行含 requirePermission("${row.perm}")（:${lines[0].no}）`,
        lines[0].line
      );
    }
  } catch (err) {
    check(false, `${row.label}：注册行断言抛错`, String(err && err.message));
  }
}
for (const row of UNWIRED) {
  const tag = `${row.file} POST ${row.routePath}（待裁 ${row.reason}）`;
  try {
    const lines = registrationLines(row.file, "post", row.routePath);
    check(lines.length === 1, `${tag}：注册行数 = 1`, `实际 ${lines.length}（行号 ${lines.map((l) => l.no).join(",")}）`);
    if (lines.length === 1) {
      check(!lines[0].line.includes("requirePermission("), `${tag}：注册行不含 requirePermission(（:${lines[0].no}）`, lines[0].line);
    }
  } catch (err) {
    check(false, `${tag}：注册行断言抛错`, String(err && err.message));
  }
}

// ── E. 持有人集合复算 + allow ⊆ 持有人（照抄“权限持有人集合复算”describe） ──
section("E) 权限持有人集合复算（matchPermission 语义 + USERS 实值）");
check(JSON.stringify(holdersOf("finance:create")) === JSON.stringify([9002, 9006, 9010]), "finance:create 持有人 = [9002,9006,9010]", holdersOf("finance:create").join(","));
check(
  JSON.stringify(holdersOf("sale:create")) === JSON.stringify([9002, 9003, 9004, 9008, 9009, 9010]),
  "sale:create 持有人 = [9002,9003,9004,9008,9009,9010]（与 G1 口径一致）",
  holdersOf("sale:create").join(",")
);
check(!holdersOf("sale:create").includes(9011), "CUSTOMER_SERVICE(9011) 不持有 sale:create（R 行锁死面）");
for (const uid of [9001, 9003, 9004, 9007, 9008, 9009]) {
  check(!holdersOf("finance:create").includes(uid), `uid=${uid} 不持有 finance:create`);
}
for (const uid of [9004, 9008, 9009]) {
  check(!holdersOf("finance:create").includes(uid), `B 类锁死面反证：uid=${uid}（店长/操作员/仓管）不持有 finance:create`);
}
for (const row of WIRED_CASES) {
  const holders = holdersOf(row.perm);
  check(
    row.allow.every((uid) => holders.includes(uid)),
    `${row.label}：允许角色集合 ⊆ ${row.perm} 持有人集合`,
    `allow=[${row.allow.join(",")}] holders=[${holders.join(",")}]`
  );
}

// ── F. 交叉印证（照抄“C 类锚点”与“R 类锚点”两个用例） ─────────────────
section("F) 交叉印证：G0 范围控制名单 + sale-return 双挂载点");
try {
  const g0 = readFileSync(path.join(BACKEND_DIR, "src", "__tests__", "routes", "rbac-g0-wiring.test.ts"), "utf8");
  check(g0.includes("/VC1/recharge"), "G0 范围控制名单仍含 /VC1/recharge");
  check(g0.includes("payments-new"), "G0 范围控制名单仍含 payments-new");
  check(g0.includes("NOT_IN_G0"), "G0 的 NOT_IN_G0 断言仍在（本单未授权改 G0）");
} catch (err) {
  check(false, "G0 交叉印证抛错", String(err && err.message));
}
try {
  const saleReturnSrc = readFileSync(path.join(ROUTES_DIR, "sale-return.routes.ts"), "utf8");
  const prefixes = [...saleReturnSrc.matchAll(/prefix:\s*"([^"]+)"/g)].map((m) => m[1]).sort();
  check(
    JSON.stringify(prefixes) === JSON.stringify(["/api/admin/sale-returns", "/api/store/sale-returns"]),
    "sale-return Router 确有第二个挂载点 /api/store/sale-returns",
    prefixes.join(" / ")
  );
} catch (err) {
  check(false, "sale-return 双挂载点交叉印证抛错", String(err && err.message));
}

// ───────────────────────────── 总结 ─────────────────────────────
section("总结");
console.log(`  断言总数 = ${checkTotal}，不一致 = ${failTotal}`);
if (failTotal > 0) {
  console.log("  FAIL 清单：");
  for (const label of failList) console.log(`   · ${label}`);
}
console.log(`  VERDICT: ${failTotal === 0 ? "PASS" : "FAIL（不一致断言数 = " + failTotal + "）"}`);
process.exit(failTotal === 0 ? 0 : 1);
