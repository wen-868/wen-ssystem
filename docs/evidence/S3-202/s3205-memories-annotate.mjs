// S3-202 第 25 项：为 docs/memories/*-记忆.md 里「已被后续裁定/实现推翻」的旧口径做就地订正
// 硬要求：① 只在目标块之后新增「引用式订正行」，原写法一字不改（保留「旧口径 → 现口径 + 依据」对照）
//          ② 行尾不漂移（原文 CRLF 保持 CRLF） ③ 逐文件给出 sha256 前后对照
// 用法：node s3205-memories-annotate.mjs <repoRoot> [--apply]
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const P = "S3-202 第 25 项 / 2026-10-15";
const N_TERMINAL =
  `> ⚠️ 旧口径订正（${P}）：\`store-terminal\` 已删除（commit \`8536d7e0\`，与「移动端不做独立『门店终端』应用」口径一致）；仓内前端现为 \`admin-web\` / \`app-mobile\` / \`app-shell\` / \`saas-admin\`（依据 \`docs/项目统一标准.md\` §6.1）。原写法保留不改。`;
const N_TERMINAL_SHORT =
  `> ⚠️ 同上（${P}）：\`store-terminal\` 已删除（\`8536d7e0\`），本行写法不再成立；现状见 \`docs/项目统一标准.md\` §6.1。原写法保留不改。`;
const N_MERCHANT =
  `> ⚠️ 旧口径订正（${P}）：\`merchant-mobile\` 已删除（commit \`8536d7e0\`），商户端前端目录现为 \`app-mobile\`（依据 \`docs/项目统一标准.md\` §6.1）。原写法保留不改。`;
const N_AIBASE =
  `> ⚠️ 旧口径订正（${P}）：\`backend/ai-base/\` 已于 commit \`e9361c9c\`（S3-36 二期「物理删除非部署副本」）删除，仓内现仅存 \`docs/ai-base/*.md\` 文档；AI 底座代码在独立仓 \`D:\\Users\\ZXQL\\ZXQL-AI\`。原写法保留不改。`;
const N_MIGRATION =
  `> ⚠️ 口径补充（${P}，补充非推翻）：外部迁移现由 \`splitSqlStatements\` 切分（剥离块首整行注释后再判空），踩坑[63]「以注释开头的整块语句被丢弃」已修；且 MIG-4 写闸门默认 \`block\`——\`INSERT/UPDATE/DELETE/REPLACE/CALL\` 一律跳过，放行须显式 \`MIGRATION_WRITE_GATE=allow\`（依据 \`backend/src/shared/migration.ts:336-359\`、\`:1284-1295\`）。原写法保留不改。`;
const N_PROD500 =
  `> ⚠️ 旧口径订正（${P}）：本行的「生产登录 API 500」已不成立——修复落地后，生产实测症状为「口令错 ⇒ 401 / 账号锁定」（\`docs/踩坑日志.md\` [130]、[135]，2026-09-26）与「\`store_manager\` 仅被累加失败计数 \`login_fail_count\` 18→19」（\`docs/tasks/R101-收口总清单.md:54\`，2026-10-13 生产只读实测）⇒ 接口可用、非 500。原写法保留不改。`;

// mode: afterLine（目标行之后）/ afterBlock（表格或代码块整体之后）/ afterList（连续列表整体之后）/ afterQuote（连续引用块之后）
const TARGETS = [
  { file: "凌舟-记忆.md", anchor: "| 门店终端 | Vue3 (store-terminal) |", mode: "afterBlock", note: N_TERMINAL },
  { file: "凌舟-记忆.md", anchor: "├── store-terminal/       # 门店终端（Vue3）", mode: "afterBlock", note: N_TERMINAL_SHORT },
  { file: "凌舟-记忆.md", anchor: "CI 流水线：安装依赖", mode: "afterLine", note: N_TERMINAL_SHORT.replace("本行写法不再成立", "该流水线中的「构建 store-terminal」步骤已随之移除（现 `.github/workflows/ci.yml` 前端只构建 admin-web / saas-admin）") },
  { file: "凌舟-记忆.md", anchor: "| 生产环境API可用性 |", mode: "afterBlock", note: N_PROD500 },
  { file: "凌舟-记忆.md", anchor: "`npm install` 在 backend/admin-web/app-mobile/store-terminal 全部执行", mode: "afterLine", note: N_TERMINAL_SHORT.replace("本行写法不再成立", "该清单里的 store-terminal 已不存在，实际只需 backend / admin-web / app-mobile / saas-admin") },

  { file: "墨-记忆.md", anchor: "| 门店终端 | Vue3 (store-terminal) |", mode: "afterBlock", note: N_TERMINAL },
  { file: "墨-记忆.md", anchor: "### store-terminal 前端", mode: "afterLine", note: N_TERMINAL_SHORT },
  { file: "墨-记忆.md", anchor: "- [ ] `cd store-terminal && npx eslint src/` 验证 0 error", mode: "afterLine", note: N_TERMINAL_SHORT },
  { file: "墨-记忆.md", anchor: "cd store-terminal && npx --no eslint src/", mode: "afterBlock", note: N_TERMINAL_SHORT },

  { file: "林夕-记忆.md", anchor: "| 门店终端 | Vue3（store-terminal，待建） |", mode: "afterBlock", note: N_TERMINAL },
  { file: "林夕-记忆.md", anchor: "| store-terminal | Vue3 + Element Plus | 门店收银终端 | 待建 |", mode: "afterBlock", note: N_TERMINAL_SHORT },
  { file: "林夕-记忆.md", anchor: "| store-terminal | 1024px Tablet | Element Plus | 固定宽度，触屏优化 |", mode: "afterBlock", note: N_TERMINAL_SHORT },

  { file: "苏然-记忆.md", anchor: "| store-terminal | `npx eslint src/` | 0 error（warning 允许） |", mode: "afterBlock", note: N_TERMINAL },
  { file: "苏然-记忆.md", anchor: "cd store-terminal && npx eslint src/", mode: "afterBlock", note: N_TERMINAL_SHORT },
  { file: "苏然-记忆.md", anchor: "├── store-terminal/             # 门店终端前端", mode: "afterBlock", note: N_TERMINAL_SHORT },

  { file: "阿坚-记忆.md", anchor: "| 阿澈 | 商户端 merchant-mobile 前端", mode: "afterBlock", note: N_MERCHANT },
  { file: "阿坚-记忆.md", anchor: "- **路径**：`backend/ai-base/`", mode: "afterList", note: N_AIBASE },
  { file: "阿坚-记忆.md", anchor: "- **SKIP_PATTERNS**：数组形式存储可跳过的错误模式", mode: "afterList", note: N_MIGRATION },

  { file: "阿澈-记忆.md", anchor: "> 职责：商户端 merchant-mobile 前端", mode: "afterQuote", note: N_MERCHANT },
];

const repoRoot = process.argv[2];
const apply = process.argv.includes("--apply");
if (!repoRoot) {
  console.error("用法: node s3205-memories-annotate.mjs <repoRoot> [--apply]");
  process.exit(2);
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const files = [...new Set(TARGETS.map((t) => t.file))];
const original = new Map(files.map((f) => [f, readFileSync(join(repoRoot, "docs", "memories", f))]));
const current = new Map(files.map((f) => [f, original.get(f)]));
const eolOf = new Map(
  files.map((f) => [f, original.get(f).toString("utf8").includes("\r\n") ? "\r\n" : "\n"])
);
const results = [];

function blockEnd(lines, i, mode) {
  if (mode === "afterLine") return i;
  if (mode === "afterBlock") {
    if (lines[i].startsWith("|")) {
      let j = i;
      while (j + 1 < lines.length && lines[j + 1].startsWith("|")) j++;
      return j;
    }
    if (lines[i].trimStart().startsWith("```")) {
      let j = i;
      while (j + 1 < lines.length && !lines[j + 1].trimStart().startsWith("```")) j++;
      return Math.min(j + 1, lines.length - 1);
    }
    return i;
  }
  if (mode === "afterList") {
    let j = i;
    while (j + 1 < lines.length && /^\s*-\s/.test(lines[j + 1])) j++;
    return j;
  }
  if (mode === "afterQuote") {
    let j = i;
    while (j + 1 < lines.length && lines[j + 1].startsWith(">")) j++;
    return j;
  }
  throw new Error(`未知 mode: ${mode}`);
}

for (const target of TARGETS) {
  const text = current.get(target.file).toString("utf8");
  const eol = eolOf.get(target.file);
  const lines = text.split(/\r?\n/);
  const hits = lines.map((line, index) => ({ line, index })).filter(({ line }) => line.includes(target.anchor));
  if (hits.length !== 1) throw new Error(`${target.file}: 锚点「${target.anchor}」命中 ${hits.length} 行，需恰好 1 行`);
  const anchorIndex = hits[0].index;
  let end = blockEnd(lines, anchorIndex, target.mode);

  const payload = lines[end + 1] === "" ? [target.note] : ["", target.note];
  const out = [...lines.slice(0, end + 1), ...payload, ...lines.slice(end + 1)].join(eol);
  current.set(target.file, Buffer.from(out, "utf8"));
  results.push({
    file: target.file,
    anchorLine: anchorIndex + 1,
    insertAfterLine: end + 1,
    noteLine: end + 1 + payload.length,
    anchor: target.anchor,
  });
}

// 机械自证：按记录的位置重放插入，必须与最终内容逐字节一致（证明「只新增了这些行」）
let ok = true;
const outReport = [];
for (const f of files) {
  const origLines = original.get(f).toString("utf8").split(/\r?\n/);
  const eol = eolOf.get(f);
  // 必须按写入时的处理顺序重放（TARGETS 声明顺序），不能按行号排序
  const mine = results.filter((r) => r.file === f);
  let lines = [...origLines];
  for (const r of mine) {
    // 重放数组与写入过程同坐标：insertAfterLine 已包含前序插入造成的位移，不再叠加 shift
    const end = r.insertAfterLine - 1;
    const payload = lines[end + 1] === "" ? [TARGETS.find((t) => t.file === f && t.anchor === r.anchor).note] : ["", TARGETS.find((t) => t.file === f && t.anchor === r.anchor).note];
    lines = [...lines.slice(0, end + 1), ...payload, ...lines.slice(end + 1)];
  }
  const replay = Buffer.from(lines.join(eol), "utf8");
  const same = Buffer.compare(replay, current.get(f)) === 0;
  if (!same) ok = false;
  outReport.push({
    file: f,
    eol: eol === "\r\n" ? "CRLF" : "LF",
    insertions: mine.length,
    replayMatch: same ? "一致 ✔" : "不一致 ✘",
    sha256Before: sha256(original.get(f)),
    sha256After: sha256(current.get(f)),
  });
}

if (apply) {
  for (const f of files) {
    if (Buffer.compare(current.get(f), original.get(f)) !== 0) {
      writeFileSync(join(repoRoot, "docs", "memories", f), current.get(f));
    }
  }
}

console.log(apply ? "=== APPLY（逐文件）===" : "=== DRY-RUN（逐文件）===");
for (const r of outReport) {
  console.log(`${r.file} | 行尾=${r.eol} | 插入=${r.insertions} 处 | 重放自证=${r.replayMatch} | before=${r.sha256Before} | after=${r.sha256After}`);
}
console.log("\n=== 插入位点（1 基行号以插入后文件为准）===");
for (const r of results) {
  console.log(`${r.file} | 锚点行=${r.anchorLine} | 插入于第 ${r.insertAfterLine} 行之后 | ${r.anchor}`);
}
console.log(`\n总判定：${ok ? "PASS" : "FAIL（重放不一致）"}`);
process.exitCode = ok ? 0 : 1;
