/**
 * S3-240 覆盖表生成器（可复跑证据）
 *
 * 作用：从**源码**枚举「码 × 页面 × 按钮 × 判定点行号 × 承载端点」，输出 Markdown 表。
 *       数据源 = `admin-web/src/config/permission-gates.ts` 注册表（唯一真相源）
 *              + 页面 `.vue` 里 `canGate('<id>')` 的真实出现位置（行号由本脚本现算，不手抄）。
 *
 * 运行（仓库根目录）：node docs/evidence/S3-240/tools/gate-coverage.mjs
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
// docs/evidence/S3-240/tools → 仓库根
const REPO = path.resolve(here, "..", "..", "..", "..");
const ADMIN_SRC = path.join(REPO, "admin-web", "src");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(specifier + ".ts", context);
      }
    }
    return nextResolve(specifier, context);
  }
});

const { BUTTON_GATES } = await import(
  pathToFileURL(path.join(ADMIN_SRC, "config", "permission-gates.ts")).href
);

function walkVueFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkVueFiles(full));
    else if (entry.name.endsWith(".vue")) out.push(full);
  }
  return out;
}

const hits = [];
for (const file of walkVueFiles(path.join(ADMIN_SRC, "views"))) {
  const rel = path.relative(ADMIN_SRC, file).split(path.sep).join("/");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(/canGate\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      hits.push({ id: m[1], rel, line: idx + 1, text: line.trim() });
    }
  });
}

const rows = [];
for (const g of BUTTON_GATES) {
  if (g.status === "registered") {
    rows.push({
      codes: "（登记 · 不门）",
      page: g.pages.join(" / "),
      entry: g.entry,
      site: "—",
      endpoint: g.endpoints.join(" + "),
      judge: `**registered**：${g.note ?? ""}`
    });
    continue;
  }
  for (const page of g.pages) {
    const h = hits.find((x) => x.id === g.id && x.rel === page);
    rows.push({
      codes: g.codes.join(" + "),
      page,
      entry: g.entry,
      site: h ? `${h.rel}:${h.line}` : "未接线",
      endpoint: g.endpoints.join(" + "),
      judge: h ? "`" + h.text.replace(/\|/g, "\\|") + "`" : "**未接线**"
    });
  }
}

console.log("| 码 | 页面 | 按钮（入口） | 判定点（源码行） | 承载端点 | 判定点源码 |");
console.log("|:--|:--|:--|:--|:--|:--|");
for (const r of rows) {
  console.log(
    `| \`${r.codes}\` | \`${r.page}\` | ${r.entry} | \`${r.site}\` | \`${r.endpoint}\` | ${r.judge} |`
  );
}
console.log("");
const gated = BUTTON_GATES.filter((g) => g.status === "gated").length;
const registered = BUTTON_GATES.filter((g) => g.status === "registered").length;
console.log(
  `合计：注册表 ${BUTTON_GATES.length} 项（gated ${gated} / registered ${registered}）；源码引用 ${hits.length} 处，覆盖页面 ${new Set(hits.map((h) => h.rel)).size} 个`
);
const orphan = hits.filter((h) => !BUTTON_GATES.some((g) => g.id === h.id));
console.log(
  `未登记的引用：${orphan.length} 处${orphan.length ? " → " + orphan.map((h) => `${h.rel}:${h.line}`).join(", ") : ""}`
);
