/**
 * C2-4 核验②的**第二轴**（补集合差集法的盲区）：以**API 契约文档**为独立口径，核对三件事：
 *   轴① 契约文档声明 ⇒ 后端实现：`docs/API接口文档.md` §模板中心 的每个 `### METHOD /path` 是否真实注册；
 *   轴② 前端调用 ⇒ 契约方法：前端 METHOD 是否与契约文档一致
 *        （**方法写错但同路径另有方法时，纯集合差集查不出来** —— 反测 M5 记录的盲区，本轴补上）；
 *   轴③ 清账卡 §三 端点表 vs 契约文档：仅**告知性**对照（清账是"建议清单"，晚于它的裁定 §2.2 已扩为 12 端点，
 *        故清账缺行不算差异，只在输出里点名）。
 *
 * 用法：node docs/evidence/C2-4/tools/c2-4-06-doc-axis.mjs
 * 退出码：0 = 轴①②一致；1 = 有差异
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyzeStaticDiff, canonicalPath } from "./c2-4-lib.mjs";

const REPO = resolve(".");
const API_DOC = "docs/API接口文档.md";
const CLEARING_CARD = "docs/tasks/cards/R101-C2-0-阿坚清账.md";
const lines = [];
const log = (s = "") => lines.push(s);
const failures = [];

const { data } = analyzeStaticDiff(REPO, "doc-axis");
const canon = (p) => canonicalPath(p.split("?")[0]);

log("[C2-4/06] 第二轴核对：API 契约文档 × 后端实现 × 前端方法");
log(`         仓库根：${REPO}`);
log(`         契约口径源：${API_DOC}（§模板中心）`);
log("");

// ── 轴①：契约文档 ⇒ 后端实现 ──────────────────────────────────────
const apiText = readFileSync(join(REPO, API_DOC), "utf8");
const sectionStart = apiText.indexOf("## 模板中心");
const nextSection = apiText.indexOf("\n## ", sectionStart + 3);
const section = apiText.slice(sectionStart, nextSection > 0 ? nextSection : undefined);
const docEndpoints = [];
{
  const re = /^###\s+(GET|POST|PUT|DELETE|PATCH)\s+(\S+)/gm;
  let m;
  while ((m = re.exec(section))) docEndpoints.push({ method: m[1].toUpperCase(), path: m[2] });
}

log(`[轴①] 契约文档 §模板中心 声明端点 ${docEndpoints.length} 条 ⇒ 逐条核对后端注册`);
for (const e of docEndpoints) {
  const key = `${e.method} ${canon(e.path)}`;
  const hit = data.backendEndpoints.find((b) => `${b.method} ${canonicalPath(b.fullPath)}` === key);
  log(`      ${key.padEnd(58)} 后端=${hit ? `${hit.file}:${hit.line}` : "✗ 未注册"}`);
  if (!hit) failures.push(`契约文档声明的端点在网不存在：${key}`);
}
log("");

// ── 轴②：前端调用 ⇒ 契约方法 ─────────────────────────────────────
log("[轴②] 前端 18 条调用的 METHOD × 契约文档 METHOD");
const docByPath = new Map();
for (const e of docEndpoints) {
  const cp = canon(e.path);
  if (!docByPath.has(cp)) docByPath.set(cp, []);
  docByPath.get(cp).push(e.method);
}
for (const call of data.frontendCalls) {
  const cp = canon(call.fullPath);
  const docMethods = docByPath.get(cp) ?? [];
  const inDoc = docMethods.length > 0;
  const consistent = !inDoc || docMethods.includes(call.method);
  log(
    `      ${call.method.padEnd(6)} ${call.fullPath.padEnd(48)} 契约=${inDoc ? docMethods.join("/") : "（本次新增清单外，属既有端点）"}  ${consistent ? "一致" : "★不一致"}`
  );
  if (!consistent) failures.push(`前端方法与其契约不一致：${call.method} ${call.fullPath}（契约 ${docMethods.join("/")}）`);
}
log("");

// ── 轴③：清账卡 §三 建议清单 vs 契约文档（仅告知） ─────────────────
log("[轴③] 清账卡 §三「建议端点清单」vs 契约文档（仅告知：清账是建议，裁定 §2.2 已扩为 12 端点）");
{
  const cardText = readFileSync(join(REPO, CLEARING_CARD), "utf8");
  const re = /^\|\s*(\d+)\s*\|\s*`(GET|POST|PUT|DELETE|PATCH)\s+([^`]+)`([^|]*)\|/gm;
  let m;
  const cardRows = [];
  while ((m = re.exec(cardText))) {
    cardRows.push({ no: Number(m[1]), method: m[2].toUpperCase(), path: m[3].trim(), rest: m[4] ?? "", raw: m[0] });
  }
  log(`      清账卡解析 ${cardRows.length} 行；契约文档 ${docEndpoints.length} 条`);
  for (const r of cardRows) {
    const key = `${r.method} ${canon(r.path)}`;
    const inDoc = docEndpoints.some((e) => `${e.method} ${canon(e.path)}` === key);
    const notDo = /S3-81|本轮不做|建议本轮不做/.test(r.raw + r.rest);
    log(`      #${String(r.no).padStart(2)} ${key.padEnd(52)} 契约文档=${inDoc ? "有" : "无"}  标注不做/转S3=${notDo}`);
  }
  const docOnly = docEndpoints.filter((e) => !cardRows.some((r) => `${r.method} ${canon(r.path)}` === `${e.method} ${canon(e.path)}`));
  log(`      仅契约文档有、清账清单没有的端点（${docOnly.length} 条，属裁定 §2.2 的扩围）：`);
  for (const e of docOnly) log(`        + ${e.method} ${e.path}`);
}
log("");

log(`[C] 结论：轴①② 差异 ${failures.length} 项`);
for (const f of failures) log(`      ✗ ${f}`);
log(`RESULT: ${failures.length === 0 ? "ALL PASS" : "FAILURES"}`);
log(`EXIT=${failures.length === 0 ? 0 : 1}`);

process.stdout.write(`${lines.join("\n")}\n`);
process.exit(failures.length === 0 ? 0 : 1);
