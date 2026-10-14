// 复跑基线：把 HEAD 版 6 份记忆文件按原始字节写出到 <destRoot>/docs/memories/，
// 用于在「与 apply 前完全一致」的基线上复现第 25 项的插入与哈希（字节安全，不经过 Set-Content）。
// 用法：node s3205-replay-baseline.mjs <repoRoot> <destRoot>
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [repoRoot, destRoot] = process.argv.slice(2);
if (!repoRoot || !destRoot) {
  console.error("用法: node s3205-replay-baseline.mjs <repoRoot> <destRoot>");
  process.exit(2);
}
const files = ["凌舟-记忆.md", "墨-记忆.md", "林夕-记忆.md", "苏然-记忆.md", "阿坚-记忆.md", "阿澈-记忆.md"];
mkdirSync(join(destRoot, "docs", "memories"), { recursive: true });
for (const f of files) {
  const buf = execFileSync("git", ["-c", "core.quotepath=false", "show", `HEAD:docs/memories/${f}`], {
    cwd: repoRoot,
    maxBuffer: 64 * 1024 * 1024,
  });
  // git show 输出的是索引 blob（LF 归一化）；本仓 core.autocrlf=true ⇒ 工作区为 CRLF，需还原
  const text = buf.toString("utf8").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
  writeFileSync(join(destRoot, "docs", "memories", f), Buffer.from(text, "utf8"));
  console.log(`${f} | 还原后字节数=${Buffer.byteLength(text, "utf8")}`);
}
