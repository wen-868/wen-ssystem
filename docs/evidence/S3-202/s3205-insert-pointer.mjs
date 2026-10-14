// S3-202 第 24 项：为 docs/migrations/*.sql 里的「历史口令字面量注释」补一句指路口径
// 硬要求：① 只新增整行注释 ② 不改口令本身、不改任何 SQL 语义 ③ 行尾不漂移（原文 CRLF 保持 CRLF）
// 用法：node s3205-insert-pointer.mjs <repoRoot> [--apply]
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const POINTER =
  "-- ⚠️ 历史示例口令，勿照抄；当前口径见 backend/src/config/constants.ts 的 DEMO_PASSWORD（S3-175 收敛为 Demo@2026）。";

/** 目标：文件 + 唯一片段（用于定位命中行）+ 说明 */
const TARGETS = [
  { file: "002_phase1_seed.sql", fragment: "默认密码：admin123", note: "002 头部注释「默认密码：admin123」" },
  { file: "075_reset_admin_password_bcrypt.sql", fragment: "默认密码：admin123", note: "075 头部注释「默认密码：admin123」" },
  { file: "075_reset_admin_password_bcrypt.sql", fragment: "生成方式：bcrypt.hashSync('admin123', 12)", note: "075 头部注释「生成方式：bcrypt.hashSync('admin123', 12)」" },
  { file: "081_platform_admin_seed_and_fix.sql", fragment: "插入默认平台超级管理员（admin / admin123）", note: "081 注释「插入默认平台超级管理员（admin / admin123）」" },
  { file: "099_seed_data.sql", fragment: "默认密码：123456", note: "099 注释「默认密码：123456 -> bcrypt hash」" },
  { file: "127_fix_demo_accounts.sql", fragment: "编号: 127, 描述: 修复演示账号", note: "127 首行注释（描述含密码 admin123）" },
  { file: "127_fix_demo_accounts.sql", fragment: "修复演示账号密码哈希（v2$ + bcrypt(admin123, cost=12)）", note: "127 注释「1) 修复演示账号密码哈希（...admin123...）」" },
];

const repoRoot = process.argv[2];
const apply = process.argv.includes("--apply");
if (!repoRoot) {
  console.error("用法: node s3205-insert-pointer.mjs <repoRoot> [--apply]");
  process.exit(2);
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const results = [];

// 先一次性读入所有原文件（基线只在开跑前取一次，避免同文件第二次插入时基线被上一次写入污染）
const files = [...new Set(TARGETS.map((t) => t.file))];
const original = new Map(files.map((f) => [f, readFileSync(join(repoRoot, "docs", "migrations", f))]));
const current = new Map(files.map((f) => [f, original.get(f)]));
const eolOf = new Map(
  files.map((f) => {
    const text = original.get(f).toString("utf8");
    return [f, text.includes("\r\n") ? "\r\n" : "\n"];
  })
);

for (const target of TARGETS) {
  const before = current.get(target.file);
  const text = before.toString("utf8");
  const eol = eolOf.get(target.file);
  const lines = text.split(/\r?\n/);

  const hits = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.includes(target.fragment));
  if (hits.length !== 1) {
    throw new Error(`${target.file}: 片段「${target.fragment}」命中 ${hits.length} 行，需恰好 1 行`);
  }
  const hitIndex = hits[0].index;
  if (lines[hitIndex - 1] === POINTER) {
    results.push({
      ...target,
      status: "已存在，跳过",
      hitLine: hitIndex + 1,
      eol: eol === "\r\n" ? "CRLF" : "LF",
      sha256Before: sha256(original.get(target.file)),
      sha256After: sha256(before),
    });
    continue;
  }

  const out = [...lines.slice(0, hitIndex), POINTER, ...lines.slice(hitIndex)].join(eol);
  const after = Buffer.from(out, "utf8");

  // 机械自证：删掉全部 POINTER 行后必须与「开跑前的原文」逐字节一致
  const rebuilt = after
    .toString("utf8")
    .split(/\r?\n/)
    .filter((line) => line !== POINTER)
    .join(eol);
  if (Buffer.compare(Buffer.from(rebuilt, "utf8"), original.get(target.file)) !== 0) {
    throw new Error(`${target.file}: 机械自证失败（删除指路注释后与原文不一致）`);
  }

  current.set(target.file, after);
  results.push({
    ...target,
    status: apply ? "已插入" : "待插入（dry-run）",
    hitLine: hitIndex + 1,
    insertLine: hitIndex + 1,
    eol: eol === "\r\n" ? "CRLF" : "LF",
    sha256Before: sha256(original.get(target.file)),
    sha256After: sha256(after),
  });
}

if (apply) {
  for (const f of files) {
    const next = current.get(f);
    if (Buffer.compare(next, original.get(f)) !== 0) {
      writeFileSync(join(repoRoot, "docs", "migrations", f), next);
    }
  }
}

console.log(apply ? "=== APPLY 结果 ===" : "=== DRY-RUN 结果 ===");
for (const r of results) {
  console.log(
    [
      r.file,
      `命中行=${r.hitLine}`,
      `原行尾=${r.eol ?? "-"}`,
      r.status,
      `before=${r.sha256Before}`,
      `after=${r.sha256After}`,
      `// ${r.note}`,
    ].join(" | ")
  );
}
