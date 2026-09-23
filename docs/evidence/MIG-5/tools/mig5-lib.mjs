/**
 * MIG-5 公共库：把真实源码 `backend/src/shared/migration.ts` 变成"可在本进程内加载"的模块，
 * 并提供两种**回退版源码**（用于反测）。
 *
 * 为什么需要它：本环境 vitest 不可运行（esbuild `spawn EPERM`，实测见 outputs/03-vitest-blocked.txt），
 * 且 `migration.ts` 顶部 import 了 `mysql2/promise` / `./env` / `./logger` / `./seed-data`，
 * 直接 import 会拉起整条依赖链。
 *
 * 复用关系：加载器直接复用 `docs/evidence/MIG-4/tools/mig4-lib.mjs`（同一套"转译 + 桩依赖"实现），
 * **不复刻任何被测函数**；本文件只新增两段"用真实源码文本做定位替换"的反退回退变换。
 */
import { readFileSync } from "node:fs";
import {
  REPO_ROOT,
  MIGRATION_TS,
  readMigrationSource,
  sha256,
  loadMigrationModule,
  makeGateDisabledSource,
} from "../../MIG-4/tools/mig4-lib.mjs";
import { join } from "node:path";

export { REPO_ROOT, MIGRATION_TS, readMigrationSource, sha256, loadMigrationModule, makeGateDisabledSource };

/** 真实被测文件（本单派工卡点名的受影响文件） */
export const REAL_MIGRATION_FILE = "006_phase4_schema.sql";
export const REAL_MIGRATION_PATH = join(REPO_ROOT, "docs", "migrations", REAL_MIGRATION_FILE);

export function readRealMigrationFile() {
  return readFileSync(REAL_MIGRATION_PATH, "utf8");
}

/**
 * 仓库内文本是 CRLF（`core.autocrlf=true`），而下面的"回退变换"用逐行文本定位；
 * 统一先归一化为 LF 再做替换（TypeScript 转译不受行尾影响）。
 */
export function normalizeSource(source) {
  return source.replace(/\r\n/g, "\n");
}

/**
 * 反测用源码①：把"丢块根治"临时回退——`splitSqlStatements` 的函数体换回修复前的实现
 * （等价于修复前两处调用点内联的 `.split(";").map(trim).filter(s => !s.startsWith("--"))`）。
 *
 * 说明：修复前该规则以内联形式出现在两个调用点；本单把它抽成具名函数后，**函数体是唯一实现位置**，
 * 因此"回退函数体"与"回退到修复前的两处内联写法"在执行语义上等价（调用点本身不改规则）。
 * 用真实源码文本做定位替换，定位失败即抛错（防止反测悄悄失效）。
 */
export function makeSplitFixRevertedSource(source) {
  const normalized = normalizeSource(source);
  const pattern = /export function splitSqlStatements\(sql: string\): string\[\] \{[\s\S]*?\n\}/;
  const matched = pattern.exec(normalized);
  if (!matched) throw new Error("反测失效：源码里定位不到 splitSqlStatements 函数块");
  const revertedBlock = `export function splitSqlStatements(sql: string): string[] {
  return sql.split(";").map((s) => s.trim()).filter((s) => s.length > 0 && !s.startsWith("--"));
}`;
  return { source: normalized.replace(matched[0], revertedBlock), matched, revertedBlock };
}

/** 反测用源码②：把 addTablePrefix 的"同族收口"回退（REFERENCES 模式删除 + 通用 INTO 模式还原 + INSERT_INTO 还原） */
export function makePrefixFamilyRevertedSource(source) {
  source = normalizeSource(source);
  const referencesPattern = "    /(REFERENCES\\s+)(`[a-z_][a-z0-9_]*`|[a-z_][a-z0-9_]*)/gi,\n";
  const replaceIntoPattern = "    /(REPLACE\\s+INTO\\s+)(`[a-z_][a-z0-9_]*`|[a-z_][a-z0-9_]*)/gi,\n";
  const insertIntoNew = "    /(INSERT\\s+(?:IGNORE\\s+)?INTO\\s+)(`[a-z_][a-z0-9_]*`|[a-z_][a-z0-9_]*)/gi,\n";
  const insertIntoOld = "    /(INSERT\\s+INTO\\s+)(`[a-z_][a-z0-9_]*`|[a-z_][a-z0-9_]*)/gi,\n";
  const intoOld = "    /(INTO\\s+)(`[a-z_][a-z0-9_]*`|[a-z_][a-z0-9_]*)/gi,\n";
  for (const [needle, label] of [
    [referencesPattern, "REFERENCES 模式行"],
    [replaceIntoPattern, "REPLACE_INTO 模式行"],
    [insertIntoNew, "INSERT_INTO 模式行"],
  ]) {
    if (!source.includes(needle)) throw new Error(`反测失效：源码里定位不到${label}`);
  }
  let out = source;
  out = out.split(referencesPattern).join(""); // 删除 REFERENCES 模式
  out = out.split(replaceIntoPattern).join(intoOld); // 还原为过宽的通用 INTO 模式
  out = out.split(insertIntoNew).join(insertIntoOld); // 还原为不含 IGNORE 的 INSERT INTO 模式
  return { source: out };
}
