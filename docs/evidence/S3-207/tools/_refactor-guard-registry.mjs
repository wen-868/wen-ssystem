/**
 * 一次性机械改写（留痕用）：把 guard-tenant-injection.mjs 里内联的三张登记表换成
 * 从 `backend/scripts/fixtures/tenant-injection-exemptions.json` 载入（数据与规则分离，便于生成器维护）。
 * 用法：node docs/evidence/S3-207/tools/_refactor-guard-registry.mjs
 */
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const file = path.resolve(path.join(HERE, "..", "..", "..", ".."), "backend", "scripts", "guard-tenant-injection.mjs");
const text = fs.readFileSync(file, "utf8");

const START = "// ─────────────────────────── 登记表（改这里必须写理由） ───────────────────────────";
const END = "// ─────────────────────────── 源码扫描 ───────────────────────────";
const i = text.indexOf(START);
const j = text.indexOf(END);
if (i < 0 || j < 0 || j < i) throw new Error("找不到登记表区块边界");

const REPLACEMENT = `${START}

/**
 * 三张登记表都在数据文件 \`backend/scripts/fixtures/tenant-injection-exemptions.json\` 里
 * （数据与规则分离；生成/补缺工具：docs/evidence/S3-207/tools/gen-exemptions.mjs）。
 *   · markers     —— 使用显式标记（tenant-scope:self/platform）的调用点，必须逐条写理由
 *   · indirect    —— 非字面量 / 带 \`\${}\` 插值、静态判不了的调用点，必须逐条写结论
 *   · singleTable —— 单表"有 tenant_id 字样但没有值谓词"的调用点（注入会补正确谓词，需逐条确认语义）
 */
const EXEMPTIONS_FILE = join(HERE, "fixtures", "tenant-injection-exemptions.json");
const REGISTRY = JSON.parse(readFileSync(EXEMPTIONS_FILE, "utf8"));
const MARKER_ALLOWLIST = REGISTRY.markers || [];
const INDIRECT_ALLOWLIST = REGISTRY.indirect || [];
const SINGLE_TABLE_ALLOWLIST = REGISTRY.singleTable || [];

`;

fs.writeFileSync(file, text.slice(0, i) + REPLACEMENT + text.slice(j), "utf8");
console.log(`已改写 ${file}`);
