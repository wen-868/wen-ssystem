/**
 * S3-208 证据装置 · 反测：把**已接线**的路由上的 `rateLimit(...)` 摘掉一条，
 * 证明本地等价判据（`codeql-missing-rate-limiting-predicate.mjs`）会**重新报出那一条且只报那一条**。
 *
 * 做法：不改工作树——把 3 个被测路由文件复制到临时目录，在副本上机械地删掉指定路由的
 * `rateLimit(AUTHED_ROUTE_LIMIT), ` 片段，再对副本跑同一判据。
 *
 * 用法：node antitest-remove-rate-limit.mjs "<含 rateLimit 的注册行原文片段>"
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../.."); // wt-agents/S3-208
const predicate = path.join(here, "codeql-missing-rate-limiting-predicate.mjs");

/** 反测对象：wechat.routes.ts 的 `/auth/unbind`（PR #297 注解第 30 行） */
const FILES = [
  "backend/src/routes/wechat.routes.ts",
  "backend/src/routes/marketing-miniapp.routes.ts",
  "backend/src/routes/commerce-fix.routes.ts",
];
const NEEDLE = "rateLimit(AUTHED_ROUTE_LIMIT), requireWxAuth, csrfMiddleware, ctrl.unbind)";
const REPLACEMENT = "requireWxAuth, csrfMiddleware, ctrl.unbind)";

const tmp = mkdtempSync(path.join(os.tmpdir(), "s3-208-antitest-"));
try {
  for (const rel of FILES) {
    const target = path.join(tmp, rel);
    cpSync(path.join(repo, rel), target, { recursive: true });
  }
  const victim = path.join(tmp, FILES[0]);
  const original = readFileSync(victim, "utf8");
  if (!original.includes(NEEDLE)) {
    throw new Error(`反测目标片段未找到（判据与文件不同步）：${NEEDLE}`);
  }
  writeFileSync(victim, original.replace(NEEDLE, REPLACEMENT), "utf8");

  console.log(`[反测] 注入：摘掉 wechat.routes.ts 的 /auth/unbind 上的 rateLimit(...)（副本 ${tmp}）`);
  let stdout = "";
  let exitCode = 0;
  try {
    stdout = execFileSync(process.execPath, [predicate, "--repo", tmp], { encoding: "utf8" });
  } catch (err) {
    stdout = String(err.stdout ?? "");
    exitCode = err.status ?? 1;
  }
  process.stdout.write(stdout);
  console.log(`[反测] EXIT=${exitCode}（期望 1）`);

  const hits = stdout.split("\n").filter((line) => line.startsWith("  - ")).map((l) => l.trim().replace(/^-\s*/, ""));
  // 只认"文件 + 方法 + 路由"三元组（行号会随接线/注释漂移，不作为判据）
  const ok =
    exitCode === 1 &&
    hits.length === 1 &&
    hits[0].startsWith("backend/src/routes/wechat.routes.ts:") &&
    hits[0].endsWith("POST /auth/unbind");
  console.log(`[反测] 命中数=${hits.length}（期望 1）、命中=${hits.join(" | ")}`);
  console.log(`[反测] 结论：${ok ? "PASS（判据能红，且只红被摘的那一条）" : "FAIL（判据失效）"}`);
  process.exit(ok ? 0 : 1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
