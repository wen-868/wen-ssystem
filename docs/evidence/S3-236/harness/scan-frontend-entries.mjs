#!/usr/bin/env node
/**
 * S3-236 证据装置：给 38 码逐条**实测**前端调用点（落地面 4「前端入口登记」的原始读数据）
 *
 * 判据：本仓前端**不引用商家权限码**（页面可见性由 meta.roles 决定，见 S3-232 §三），
 * 故"前端入口"= 前端代码里**调用该端点**的位置。本装置按端点的**路径字面量**在
 * admin-web / app-mobile / saas-admin / miniapp 的 src 下做全文检索：
 *   · 把 `:param` 段替换成"该段任意片段"的正则，命中即登记 `<文件>:<行号>`（最多 3 处）；
 *   · 无命中 ⇒ 登记「暂无前端入口，仅后端授权位」。
 *
 * 用法（仓库根执行）：node docs/evidence/S3-236/harness/scan-frontend-entries.mjs
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
/** 调试：`--debug` 时把命中的**源码行原文**一并打印（供人工核对是否为真调用点） */
const DEBUG = process.argv.includes("--debug");
// 逐域目录是码表的书写处（汇总文件只是 spread，不含字符串字面量）⇒ 四个域文件一起读，按 sort_no 顺序
const CATALOG_FILES = [
  "backend/src/shared/report-permission-codes.ts",
  "backend/src/shared/hardware-permission-codes.ts",
  "backend/src/shared/miniapp-permission-codes.ts",
  "backend/src/shared/dashboard-permission-codes.ts",
];
const src = CATALOG_FILES.map((f) => fs.readFileSync(path.join(repoRoot, f), "utf-8")).join("\n");

// 从域目录文件里抽出 (code, endpoints[], callPatterns[], requestPatterns[])
const codeRe =
  /code: "([^"]+)",[\s\S]*?endpoints: \[([^\]]*)\](?:[\s\S]*?callPatterns: \[([^\]]*)\])?(?:[\s\S]*?requestPatterns: \[([^\]]*)\])?/g;
const entries = [];
let m;
while ((m = codeRe.exec(src)) !== null) {
  const grab = (group) => (group ? [...group.matchAll(/"([^"]+)"/g)].map((x) => x[1]) : []);
  const endpoints = grab(m[2]);
  const callPatterns = grab(m[3]);
  const requestPatterns = grab(m[4]);
  entries.push({
    code: m[1],
    endpoints,
    callPatterns: callPatterns.length > 0 ? callPatterns : endpoints,
    requestPatterns,
  });
}

const FRONTEND_DIRS = ["admin-web/src", "app-mobile/src", "saas-admin/src", "miniapp/src", "platform-miniapp/src"];
const files = [];
for (const dir of FRONTEND_DIRS) {
  const abs = path.join(repoRoot, dir);
  if (!fs.existsSync(abs)) continue;
  const walk = (d) => {
    for (const item of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, item.name);
      if (item.isDirectory()) walk(p);
      else if (/\.(ts|js|vue|tsx|jsx)$/.test(item.name)) files.push(p);
    }
  };
  walk(abs);
}

const contents = files.map((f) => ({ rel: path.relative(repoRoot, f).replace(/\\/g, "/"), text: fs.readFileSync(f, "utf-8") }));

/** HTTP 方法在本仓前端的调用别名（app-mobile 的 request 封装把 delete 写成 del/remove） */
function methodAliases(method) {
  const table = {
    GET: ["get"],
    POST: ["post"],
    PUT: ["put"],
    PATCH: ["patch"],
    DELETE: ["delete", "del", "remove"],
  };
  return (table[method] ?? [method.toLowerCase()]).join("|");
}

/** 路由参数占位（避免用 `:` 前缀判断，因为字面段里也可能出现 `-` 之外的冒号语义，见 `:data-scope` 的反例） */
const PARAM_TOKEN = "___PARAM___";

/**
 * 路径 → 正则片段：**先逐段判参数再转义**。
 * 反例（本装置首版翻车处）：`PUT /api/admin/report-permissions/data-scope` 若按"段里有冒号就是参数"
 * 处理，`data-scope` 会被当成参数片段 ⇒ 命中同文件里另一行 `.../matrix` 的调用，产生**假前端入口**。
 */
function segmentsToRegex(pathWithSlash, { idIsDigits }) {
  const normalized = pathWithSlash
    .replace(/:([A-Za-z][A-Za-z0-9_]*)(\([^)]*\))?/g, PARAM_TOKEN)
    .replace(/#id#/g, idIsDigits ? "___ID___" : PARAM_TOKEN);
  return normalized
    .split("/")
    .map((seg) => {
      if (seg === PARAM_TOKEN) return "[^\"'`\\s/]+";
      if (seg === "___ID___") return "\\\\d+";
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
}

function pathToRegexFragment(p) {
  return segmentsToRegex(p, { idIsDigits: true });
}

/** 相对请求路径（`/admin/...`）→ 正则片段：**保留开头 `/`**，故左边界只能是引号/括号/空白 */
function relativePathToRegexFragment(p) {
  const withSlash = p.replace(/^\/?/, "/");
  return segmentsToRegex(withSlash, { idIsDigits: false });
}
/**
 * 一次检索：命中 = ① 行内有该 HTTP 方法的调用（`.post(` / `.put(` …）；
 *                    ② 行内有该端点路径字面量（`/api/...`），或该端点的**相对路径**字面量（`/admin/...`）；
 *                    ③ 排除注释行（踩坑[134]）。
 *
 * ⚠️ `relativePath` 必须与 `endpoint` **同一个下标**配成对（生成器按同序写出）：
 *    首版把"本码全部端点的相对路径"一起当候选 ⇒ A 端点的命中会被记成 B 端点的调用点（张冠李戴）。
 */
function hitsFor(endpoint, relativePath) {
  const [method, p] = endpoint.split(" ");
  // 端点里的 `#id#` 占位（断言里会被换成 `:id(\\d+)`）在检索时按 `:id` 处理
  const fullFragment = pathToRegexFragment(p.replace(/#id#/g, ":id").replace(/#tail#/g, ""));
  const fullRe = new RegExp(`(?:^|["'\`(,=\\s/])${fullFragment}(?:["'\`?/]|\\$\\{)`);
  // ⚠️ 左边界**不含 `/`**：相对片段自身以 `/` 开头，若边界再允许 `/`，`/custom-report/x` 里的
  //    子串 `/report/x` 会被误判成命中（本装置首版即栽在这里）
  const relativeFragment = (relativePath ?? "")
    .split(" ")[1]
    ?.replace(/#id#/g, ":id");
  const relativeRe =
    relativeFragment && relativeFragment !== p
      ? new RegExp(
          `(?<!\\/api)(?:^|["'\`(,=\\s])${relativePathToRegexFragment(relativeFragment)}(?:["'\`?/]|\\$\\{)`,
        )
      : null;
  // 方法调用形态：`axios.post(` / `.put(` / 裸 `post(`（app-mobile 的 request 封装）/ `post<T>(`；
  // 不用 `\b<method>\b` 是因为 `\b` 会把 `supportsViewing(` 这类别的动词也算成写方法（假阳性）。
  const methodRe = new RegExp(`(?:^|[.\\s(,])(?:${methodAliases(method)})[<\\s]*[.(]`, "i");
  const hits = [];
  for (const file of contents) {
    const lines = file.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // 注释行不是调用点
      if (!methodRe.test(line)) continue;
      if (!fullRe.test(line) && !(relativeRe && relativeRe.test(line))) continue;
      hits.push(`${file.rel}:${i + 1}${DEBUG ? `  ← ${line.trim().slice(0, 120)}` : ""}`);
      break;
    }
  }
  return hits;
}

console.log(`目录码数：${entries.length}`);
console.log(`检索文件数：${files.length}（${FRONTEND_DIRS.join(" / ")}）`);
console.log("");
for (const entry of entries) {
  const all = [];
  entry.endpoints.forEach((ep, index) => {
    // ⚠️ 第 index 个端点的相对路径 = 第 index 个 requestPatterns（生成器按同序写出）
    const hits = hitsFor(ep, entry.requestPatterns[index] ?? "");
    for (const h of hits) all.push(`${ep} → ${h}`);
  });
  const unique = [...new Set(all)].sort();
  console.log(`${entry.code} | ${unique.length > 0 ? unique.join(" ; ") : "暂无前端入口，仅后端授权位"}`);
}

// 汇总读数：无前端入口的码数
let without = 0;
for (const entry of entries) {
  const any = entry.endpoints.some(
    (ep, index) => hitsFor(ep, entry.requestPatterns[index] ?? "").length > 0,
  );
  if (!any) without += 1;
}
console.log("");
console.log(`汇总：有前端调用点的码 ${entries.length - without} / ${entries.length}；无前端入口（仅后端授权位）${without} 码`);

// ── 落盘机读结果（供生成器把 frontendEntry 字段写成实测结果，避免手抄）──
const jsonOut = {
  generated_from: "docs/evidence/S3-236/harness/scan-frontend-entries.mjs",
  scanned_files: files.length,
  scanned_dirs: FRONTEND_DIRS,
  codes: Object.fromEntries(
    entries.map((entry) => {
      const hits = [];
      entry.endpoints.forEach((ep, index) => {
        for (const h of hitsFor(ep, entry.requestPatterns[index] ?? "")) hits.push(h);
      });
      return [entry.code, [...new Set(hits)].sort()];
    }),
  ),
};
fs.writeFileSync(
  path.join(repoRoot, "docs/evidence/S3-236/raw/12-frontend-entry-hits.json"),
  JSON.stringify(jsonOut, null, 2) + "\n",
  "utf-8",
);
