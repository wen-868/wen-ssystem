/**
 * S3-233 收尾（2026-10-16，s3240）：**门级对账**（派单卡 §二.1：门数 N / 端点数 M / 已接 K / 跳过数逐条列出）。
 *
 * 用法：node docs/evidence/S3-233/tools/s3240-gate-recon.mjs
 * 输出：直接可粘进 `docs/tasks/R101-RBAC接线缺口清单.md` §十八 的三张表（门级对账 / 逐域已接清单 / registered 清单）。
 * 只读：读门注册表、已接清单（机读台账移除名单）、机读台账 `gaps`、生产角色底稿，不写任何文件。
 *
 * 四个真相源（**故意各取一处，交叉验证**）：
 *   ① 门注册表 `app-mobile/src/config/permission-gates.ts`（门 → 端点行 → 码）
 *   ② 已接清单 `docs/evidence/S3-233/raw/30-wired-map.json`（本单从 gaps 移除的 57 条，`tools/s3238-wired-map.mjs` 生成）
 *   ③ 落地码 `backend/src/__tests__/routes/rbac-b2-s3-233-gate-wiring-parity.test.ts` 的 `WIRED_ROWS`（用例与台账同一份表）
 *   ④ 生产持有者 `docs/evidence/_shared/prod-roles-20261016.txt` §一
 */
import { readFileSync } from "node:fs";

const GATES = "app-mobile/src/config/permission-gates.ts";
const PARITY = "backend/src/__tests__/routes/rbac-b2-s3-233-gate-wiring-parity.test.ts";
const WIRED_MAP = "docs/evidence/S3-233/raw/30-wired-map.json";
const ROLES = "docs/evidence/_shared/prod-roles-20261016.txt";
const BASELINE = "backend/scripts/rbac-wiring-baseline.json";

// ---- ① 门注册表（提取 ENTRY_GATES 数组字面量 + 求值，与 parity 用例同一读法）----
function loadGates() {
  const src = readFileSync(GATES, "utf8");
  const start = src.indexOf("export const ENTRY_GATES");
  const open = src.indexOf("[", src.indexOf("=", start));
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      if (--depth === 0) {
        end = i;
        break;
      }
    }
  }
  return new Function(`return (${src.slice(open, end + 1)});`)();
}

// ---- ③ 用例里的 WIRED_ROWS：端点 → 落地码（用例与台账同一份表，不另抄）----
function loadPerms() {
  const src = readFileSync(PARITY, "utf8");
  const body = src.slice(src.indexOf("const WIRED_ROWS"), src.indexOf("interface RegisteredRow"));
  const map = new Map();
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/endpoint: "([^"]+)".*?perm: "([^"]+)"/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

// ---- ④ 生产持有者（通配语义同 rbac.service.matchPermission）----
function matchPermission(perms, code) {
  for (const p of perms) {
    if (p === "*" || p === code) return true;
    const [pd, pa] = p.split(":");
    const [cd, ca] = code.split(":");
    if (pa === "*" && pd === cd) return true;
    if (pd === "*" && pa === ca) return true;
  }
  return false;
}
const roles = readFileSync(ROLES, "utf8")
  .split(/\r?\n/)
  .map((l) => l.match(/^([A-Z_]+)\t[^\t]*\t(\[.*\])\s*$/))
  .filter(Boolean)
  .map((m) => ({ code: m[1], perms: JSON.parse(m[2]) }));
const holdersOf = (code) => roles.filter((r) => matchPermission(r.perms, code)).map((r) => r.code);

// ---- ② 已接清单 + ④ 机读台账 ----
const wiredMap = JSON.parse(readFileSync(WIRED_MAP, "utf8"));
const wiredEndpoints = new Set(Object.values(wiredMap.byFile).flat());
const gaps = JSON.parse(readFileSync(BASELINE, "utf8")).gaps;
const gapsFlat = new Set(Object.values(gaps).flat());

const gates = loadGates();
const perms = loadPerms();
const gated = gates.filter((g) => g.status === "gated");
const registered = gates.filter((g) => g.status === "registered");

console.log("## 表 A · 门级对账（`M = K + 跳过`）\n");
console.log("| # | 门 id | 域 | 门 codes | 端点行数 | 已接 | 跳过 |");
console.log("|:--:|:--|:--|:--|:--:|:--:|:--:|");
let rows = 0;
let wiredRows = 0;
let skippedRows = 0;
const skippedDetail = [];
gated.forEach((g, i) => {
  const wired = g.endpoints.filter((e) => wiredEndpoints.has(e));
  const skipped = g.endpoints.filter((e) => !wiredEndpoints.has(e));
  rows += g.endpoints.length;
  wiredRows += wired.length;
  skippedRows += skipped.length;
  for (const s of skipped) skippedDetail.push(`${g.id}: ${s}`);
  console.log(
    `| ${i + 1} | \`${g.id}\` | ${g.domain} | ${g.codes.map((c) => `\`${c}\``).join(" ")} | ${g.endpoints.length} | ${wired.length} | ${skipped.length} |`
  );
});
console.log(
  `| — | **合计 ${gated.length} 道门** | — | — | **${rows}** | **${wiredRows}** | **${skippedRows}** |`
);
console.log("");
console.log(`- gated 端点行 ${rows} ⇒ **唯一端点 ${wiredEndpoints.size}**（差 ${rows - wiredEndpoints.size} = 被两道门共同引用的端点）`);
console.log(`- 唯一端点**逐条上网核对**：${[...wiredEndpoints].every((e) => gapsFlat.has(e) === false) ? "全部**不在**机读台账 gaps 里 ✅" : "存在仍在 gaps 者 ❌"}`);
console.log(`- 跳过明细：${skippedDetail.length ? skippedDetail.join("；") : "无（0 条）"}`);

console.log("\n## 表 B · 本批已接端点 × 落地码 × 生产在用持有者\n");
console.log("| 端点 | 文件 | 落地码 | 生产在用持有者（底稿 §一） |");
console.log("|:--|:--|:--|:--|");
const fileOf = new Map();
for (const [f, list] of Object.entries(wiredMap.byFile)) for (const e of list) fileOf.set(e, f);
for (const [ep, perm] of perms) {
  const h = holdersOf(perm);
  console.log(`| \`${ep}\` | ${fileOf.get(ep) ?? "**不在移除名单**"} | \`${perm}\` | ${h.join(" / ") || "**无**"} |`);
}
console.log(`\n- 本表 ${perms.size} 条；移除名单 ${wiredEndpoints.size} 条 ⇒ 差 ${perms.size - wiredEndpoints.size} 条 = \`POST /api/admin/orders/:orderNo/cancel\`（S3-209 既有接线，本单只加断言，故本就不在 gaps 里）`);
const noHolder = [...perms.values()].filter((p) => holdersOf(p).length === 0);
console.log(`- **无在用持有者的码：${noHolder.length}**${noHolder.length ? ` ⇒ ${noHolder.join(", ")}（应跳过并登记）` : "（§二.6 零回归论证成立，无需跳过）"}`);

// registered 的**逐条分类**不另立口径：直接取 parity 用例 `REGISTERED_ROWS` 的
//   `sameAsRegistry`（false = 跨层漂移）与 `gapEndpoint`（台账写法与注册表写法不同时用哪个查 gaps）。
//   理由：`PUT /api/admin/order-exceptions/:id(\d+)` 这类**带路径约束**的行，注册表写法与台账写法不同，
//   直接用注册表写法查 gaps 会误判为"漂移"（本项目 S3-233 收尾实测：18 vs 16）。
function loadRegisteredRows() {
  const src = readFileSync(PARITY, "utf8");
  const body = src.slice(src.indexOf("const REGISTERED_ROWS"), src.indexOf("/** 取某文件里"));
  const rows = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/endpoint: "([^"]+)"[\s\S]*?sameAsRegistry: (true|false)/);
    if (!m) continue;
    const gap = line.match(/gapEndpoint: "([^"]+)"/);
    // ⚠️ 用例源码里的 `\\d` 是**字面双反斜杠**（运行期才是 `\d`），而机读台账 JSON 解析后是单反斜杠
    //    ⇒ 这里必须退转义，否则 `:id(\d+)` 这类带路径约束的行会被误判成"台账已无该缺口"（实测 2 条）。
    const unescape = (s) => s.replace(/\\\\/g, "\\");
    rows.push({ endpoint: m[1], sameAsRegistry: m[2] === "true", gapEndpoint: unescape(gap ? gap[1] : m[1]) });
  }
  return rows;
}
const registeredRows = loadRegisteredRows();
const regByEndpoint = new Map(registeredRows.map((r) => [r.endpoint, r]));
const referenced = new Set();

console.log("\n## 表 C · `status==='registered'`：一律不接（登记核对，分类口径取自 parity 用例 `REGISTERED_ROWS`）\n");
console.log("| # | 门 id | 域 | 端点行数 | 后端已注册且仍无门 | 跨层漂移（只登记） |");
console.log("|:--:|:--|:--|:--:|:--:|:--:|");
const regTotal = registered.reduce((n, g) => n + g.endpoints.length, 0);
let regStillGap = 0;
let regDrift = 0;
const unregistered = [];
registered.forEach((g, i) => {
  let inGaps = 0;
  let drift = 0;
  for (const e of g.endpoints) {
    const row = regByEndpoint.get(e);
    if (!row) {
      unregistered.push(`${g.id}: ${e}`);
      continue;
    }
    referenced.add(e);
    if (!row.sameAsRegistry) drift++;
    else if (gapsFlat.has(row.gapEndpoint)) inGaps++;
    else unregistered.push(`${g.id}: ${e}（台账已无该缺口，但门仍为 registered）`);
  }
  regStillGap += inGaps;
  regDrift += drift;
  console.log(`| ${i + 1} | \`${g.id}\` | ${g.domain} | ${g.endpoints.length} | ${inGaps} | ${drift} |`);
});
console.log(`| — | **合计 ${registered.length} 道门** | — | **${regTotal}** | **${regStillGap}** | **${regDrift}** |`);
console.log(`\n- registered 端点行 ${regTotal} = 仍在台账 gaps ${regStillGap} 条 ＋ 后端登记形态与注册表不一致 ${regDrift} 条（派单卡 §五：只登记、不接）`);
const orphan = registeredRows.filter((r) => !referenced.has(r.endpoint)).map((r) => r.endpoint);
console.log(`- 双向核对：登记表 ${registeredRows.length} 条／门引用 ${referenced.size} 条 ⇒ 未被任何门引用 ${orphan.length}${orphan.length ? `（${orphan.join("；")}）` : ""}`);
console.log(`- 未被登记的后端已注册行 ${unregistered.length}${unregistered.length ? `（${unregistered.join("；")}）` : "（无）"}`);
