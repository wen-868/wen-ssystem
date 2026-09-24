/**
 * S3-106 公共库：把真实源码 `backend/src/shared/migration.ts` 变成"旧口径（文本包含式保护）"的
 * 回退版文本，供反测使用。
 *
 * 复用关系：模块加载与执行 harness **直接复用** `docs/evidence/MIG-5b/tools/mig5b-harness.mjs`
 * （该 harness 用最小 vitest 运行时**原样执行测试文件**，mock 注册表用 vitest 真实 `normalizeModuleId`，
 * 提升变换用 vitest 真实 `hoistMocks`），**不复刻任何被测函数、不复刻任何断言**；
 * 本文件只新增"用真实源码文本做定位替换"的回退变换（定位失败即抛错，防止反测悄悄失效）。
 */
import { join } from "node:path";
import {
  REPO_ROOT,
  MIGRATION_TS,
  sha256,
  readRealMigrationSource,
  readTestSource,
  createRuntime,
} from "../../MIG-5b/tools/mig5b-harness.mjs";

export { REPO_ROOT, MIGRATION_TS, sha256, readRealMigrationSource, readTestSource, createRuntime };

/** 本单新增的守门测试文件（S3-106 交付物 2） */
export const DROP_GUARD_TEST_FILE = join(
  REPO_ROOT,
  "backend",
  "src",
  "__tests__",
  "shared",
  "migration-drop-guard.test.ts"
);

/** 本单点名的既有守门文件（回归用：证明"未放宽/删除任何既有断言"） */
export const EXISTING_GUARD_TEST_FILES = [
  join(REPO_ROOT, "backend", "src", "__tests__", "shared", "migration-split.test.ts"),
  join(REPO_ROOT, "backend", "src", "__tests__", "shared", "migration-write-gate.test.ts"),
  join(REPO_ROOT, "backend", "src", "__tests__", "shared", "migration-delimiter.test.ts"),
];

/** 仓库内文本是 CRLF；下面的逐行/逐处定位替换先归一化为 LF */
export function normalizeSource(source) {
  return source.replace(/\r\n/g, "\n");
}

const OLD_INLINE_GUARD = "if (/DROP\\s+TABLE/i.test(stmt)) {";
const NEW_INLINE_GUARD = "if (isDropTableStatement(stmt)) {";
const NARROWED_BODY = `export function isDropTableStatement(statement: string): boolean {
  return /^DROP\\s+TABLE\\b/i.test(stripLeadingComments(statement));
}`;
const TEXT_INCLUSION_BODY = `export function isDropTableStatement(statement: string): boolean {
  // 【反测用回退版】旧口径：语句文本任意位置出现 DROP TABLE 即判真
  return /DROP\\s+TABLE/i.test(statement);
}`;

/**
 * 反测用源码①（本单 ③ 主反测）：把**第 8 步的保护判定**改回文本包含式——
 * 即原实现逐字写法 `if (/DROP\s+TABLE/i.test(stmt)) {`。
 *
 * 说明：修复后该判定被抽成 `isDropTableStatement`，**调用点即保护生效点**，
 * 因此"回退调用点"与"回退到修复前的内联正则"在**执行语义上完全等价**（保护对象、跳过行为一致）。
 */
export function makeDropGuardCallSiteRevertedSource(source) {
  const normalized = normalizeSource(source);
  if (!normalized.includes(NEW_INLINE_GUARD)) {
    throw new Error(`反测失效：源码里定位不到新调用点 ${NEW_INLINE_GUARD}`);
  }
  if (normalized.includes(OLD_INLINE_GUARD)) {
    throw new Error("反测失效：源码里已存在旧口径内联正则，回退无区分度");
  }
  const reverted = normalized.split(NEW_INLINE_GUARD).join(OLD_INLINE_GUARD);
  return { source: reverted, from: NEW_INLINE_GUARD, to: OLD_INLINE_GUARD };
}

/**
 * 反测用源码②（补充反测）：把**判定函数本体**也改回文本包含式（连同调用点回退），
 * 用于证明"函数级断言也会跟着变红"，即收窄判据的两处表面都真实生效。
 */
export function makeDropGuardFullyRevertedSource(source) {
  const callSite = makeDropGuardCallSiteRevertedSource(source);
  if (!callSite.source.includes(NARROWED_BODY)) {
    throw new Error("反测失效：源码里定位不到 isDropTableStatement 的收窄函数体");
  }
  const reverted = callSite.source.split(NARROWED_BODY).join(TEXT_INCLUSION_BODY);
  return { source: reverted, from: NARROWED_BODY, to: TEXT_INCLUSION_BODY };
}
