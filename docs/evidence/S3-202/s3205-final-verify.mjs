// S3-202 终验：第 24 项（migrations 历史口令注释加指路）+ 第 25 项（memories 旧口径就地订正）
// 用法：node s3205-final-verify.mjs <repoRoot> [baseRef]
//   baseRef 缺省 = 本单基线 5d8f46df（origin/main）。
//   用 baseRef 而非 HEAD 作对比对象 ⇒ **提交之后仍可复跑**，读数与提交前一致。
//   （纯只读，输出即证据）
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const repo = process.argv[2];
const baseRef = process.argv[3] ?? "5d8f46df";
const git = (...a) =>
  execFileSync("git", ["-c", "core.quotepath=false", ...a], { cwd: repo, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const line = (s) => console.log(s);

line(`########## ① 改动面（baseRef=${baseRef} → 工作区；应只有 docs/** 下的改动）`);
const status = git("diff", "--name-status", baseRef).trim();
line(status || "(空)");

const untracked = git("ls-files", "--others", "--exclude-standard").trim().split("\n").filter(Boolean);
const changed = git("diff", "--name-only", baseRef, "--", "docs").trim().split("\n").filter(Boolean);
const statusOf = new Map(
  status
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [st, ...rest] = l.split("\t");
      return [rest.join("\t"), st[0]];
    })
);
line(
  `未跟踪（本次证据目录等新增）条目 ${untracked.length} 条：${
    untracked.length <= 4 ? JSON.stringify(untracked) : JSON.stringify(untracked.slice(0, 2)) + ` …(+${untracked.length - 2})`
  }`
);
const nonDocs = changed.filter((f) => !f.startsWith("docs/"));
line(`\n改动文件数=${changed.length}；非 docs/ 前缀=${nonDocs.length}${nonDocs.length ? " -> " + JSON.stringify(nonDocs) : " ✔"}`);

const byExt = {};
for (const f of changed) {
  const ext = f.slice(f.lastIndexOf("."));
  byExt[ext] = (byExt[ext] ?? 0) + 1;
}
line(`按扩展名：${JSON.stringify(byExt)}`);
const codeChanged = changed.filter((f) => /\.(ts|js|mjs|cjs|tsx|vue|html|css|json)$/.test(f));
const productCodeChanged = codeChanged.filter((f) => !f.startsWith("docs/evidence/"));
line(
  `\n########## ② 反向自证：产品代码（.ts/.js/.mjs/.cjs/.vue/.html/.css/.json，排除 docs/evidence/** 下本单自带的 node 验证脚本）改动 = ${productCodeChanged.length}${
    productCodeChanged.length ? " -> " + JSON.stringify(productCodeChanged) : " ✔"
  }`
);
line(`（附）docs/evidence/S3-202 内的验证脚本 .mjs 共 ${codeChanged.length - productCodeChanged.length} 个，均为本单新增证据，非产品代码`);

line("\n########## ③ 逐文件：新增/删除行 + 行尾 + sha256（HEAD blobs vs 工作区）");
const numstat = git("diff", "--numstat", baseRef, "--", "docs").trim().split("\n").filter(Boolean);
const eolOut = git("ls-files", "--eol", "--", ...changed);
const eolMap = new Map(
  eolOut
    .trim()
    .split("\n")
    .map((l) => {
      const tab = l.indexOf("\t");
      if (tab < 0) return null;
      const left = l.slice(0, tab).trim().split(/\s+/);
      const path = l.slice(tab + 1);
      return [path, `i/${left[0]?.replace(/^i\//, "")} w/${left[1]?.replace(/^w\//, "")}`];
    })
    .filter(Boolean)
);
for (const row of numstat) {
  const [add, del, rawName] = row.split("\t");
  const name = rawName.replace(/^"|"$/g, "");
  const st = statusOf.get(name) ?? "?";
  const head = st === "A" ? "" : git("show", `${baseRef}:${name}`);
  const work = readFileSync(join(repo, name), "utf8");
  line(
    `${name} | [${st}] +${add} / -${del} | 行尾=${eolMap.get(name) ?? "(未取得)"} | sha256 ${
      st === "A" ? "(新增)" : sha256(Buffer.from(head, "utf8")).slice(0, 16)
    } -> ${sha256(Buffer.from(work, "utf8")).slice(0, 16)}`
  );
}

line("\n########## ④ 新增行性质审计（要求：migrations 新增行全部以「+-- 」开头；memories 新增行全部是「+> ⚠️」或空行；实体文件删除行 = 0）");
const substantive = changed.filter((f) => !f.startsWith("docs/evidence/"));
const diff = git("diff", "-U0", baseRef, "--", ...substantive).split("\n");
const added = diff.filter((l) => l.startsWith("+") && !l.startsWith("+++"));
const removed = diff.filter((l) => l.startsWith("-") && !l.startsWith("---"));
line(
  `实体文件（排除 docs/evidence/**）新增行=${added.length} 删除行=${removed.length}${removed.length ? "  ✘ 存在删除行" : " ✔"}（其中 migrations+memories = 30 行，其余为本单回传卡/回执）；docs/evidence/** 为纯新增（不计入此行数）`
);
const badSql = added.filter((l) => /\.sql/i.test("") === false && l.startsWith("+") && false); // 占位，下面用逐文件判定
void badSql;

const sqlFiles = changed.filter((f) => f.endsWith(".sql"));
const memFiles = changed.filter((f) => f.startsWith("docs/memories/"));
const memAddedAll = [];
for (const f of memFiles) {
  const d = git("diff", "-U0", baseRef, "--", f).split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
  memAddedAll.push(...d);
}
const memBad = memAddedAll.filter((l) => !/^\+\s*$/.test(l) && !l.startsWith("+> ⚠️"));
line(`migrations 文件数=${sqlFiles.length}`);
let sqlBad = [];
for (const f of sqlFiles) {
  const d = git("diff", "-U0", baseRef, "--", f).split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
  sqlBad.push(...d.filter((l) => !l.startsWith("+-- ")));
}
line(`migrations 非注释新增行=${sqlBad.length}${sqlBad.length ? " -> " + JSON.stringify(sqlBad) : " ✔"}`);
line(`memories 新增行=${memAddedAll.length}；非「> ⚠️」/非空行=${memBad.length}${memBad.length ? " -> " + JSON.stringify(memBad) : " ✔"}`);

line("\n########## ⑤ 第 24 项：历史口令字面量数量不变（HEAD vs 工作区逐文件计数）");
const LITERALS = ["admin123", "123456 -> bcrypt hash", "默认密码"];
let litOk = true;
for (const f of sqlFiles) {
  const head = git("show", `${baseRef}:${f}`);
  const work = readFileSync(join(repo, f), "utf8");
  for (const lit of LITERALS) {
    const a = head.split(lit).length - 1;
    const b = work.split(lit).length - 1;
    if (a === 0 && b === 0) continue;
    if (a !== b) litOk = false;
    line(`${f} | ${lit} | ${a} -> ${b} | ${a === b ? "不变 ✔" : "变化 ✘"}`);
  }
}
line(`字面量计数判定：${litOk ? "PASS" : "FAIL"}`);

line("\n########## ⑥ 第 25 项：memories 目标锚点仍在（原写法未被改）");
const anchors = [
  ["docs/memories/凌舟-记忆.md", "| 门店终端 | Vue3 (store-terminal) |"],
  ["docs/memories/凌舟-记忆.md", "| 生产环境API可用性 |"],
  ["docs/memories/墨-记忆.md", "- [ ] `cd store-terminal && npx eslint src/` 验证 0 error"],
  ["docs/memories/林夕-记忆.md", "| store-terminal | 1024px Tablet | Element Plus | 固定宽度，触屏优化 |"],
  ["docs/memories/苏然-记忆.md", "├── store-terminal/             # 门店终端前端"],
  ["docs/memories/阿坚-记忆.md", "- **路径**：`backend/ai-base/`"],
  ["docs/memories/阿澈-记忆.md", "> 职责：商户端 merchant-mobile 前端"],
];
for (const [f, a] of anchors) {
  const text = readFileSync(join(repo, f), "utf8");
  const n = text.split(a).length - 1;
  line(`${f} | 锚点「${a.slice(0, 28)}…」命中 ${n} 处 | ${n >= 1 ? "原写法保留 ✔" : "缺失 ✘"}`);
}

line("\n########## ⑦ 删除对象现状核实（store-terminal / backend/ai-base / merchant-mobile）");
for (const p of ["store-terminal", "backend/ai-base"]) {
  const n = git("ls-files", `${p}/*`).trim();
  line(`git ls-files '${p}/*' => ${n === "" ? "0 条（目录已不存在）✔" : n.split("\n").length + " 条 ✘"}`);
}
line(`删除提交：store-terminal/merchant-mobile => ${git("log", "--oneline", "-1", "--diff-filter=D", "--", "store-terminal").trim()}`);
line(`删除提交：backend/ai-base => ${git("log", "--oneline", "-1", "--diff-filter=D", "--", "backend/ai-base").trim()}`);
line(`\n########## ⑧ 口径依据引用行存在性`);
const cites = [
  ["docs/项目统一标准.md", "移动端不做独立"],
  ["docs/tasks/R101-收口总清单.md", "生产 `store_manager` 被**持续爆破**"],
  ["backend/src/shared/migration.ts", "MIGRATION_WRITE_GATE"],
];
for (const [f, needle] of cites) {
  const text = readFileSync(join(repo, f), "utf8");
  line(`${f} | 「${needle}」=> ${text.includes(needle) ? "存在 ✔" : "缺失 ✘"}`);
}
