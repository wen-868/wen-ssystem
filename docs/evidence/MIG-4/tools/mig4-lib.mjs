/**
 * MIG-4 公共库：把真实源码 `backend/src/shared/migration.ts` 变成"可在本进程内加载"的模块。
 *
 * 为什么需要它：
 *   本环境 vitest 不可运行（esbuild `spawn EPERM`）、node 也无法 spawn 任何子进程（实测 `cmd /c echo hi` = EPERM），
 *   而 `migration.ts` 顶部 import 了 `mysql2/promise` / `./env` / `./logger` / `./seed-data`，直接 import 会拉起整条依赖链。
 *   因此本库只做三件事：**读真实源码 → `typescript.transpileModule` 转译 → 把外部依赖说明符重写成桩模块**，
 *   写出临时文件后 `import()`。**不复刻任何被测函数**（`runMigrations` / `resolveWriteGate` / `isDataWriteStatement`
 *   全部来自真实源码文本），并输出源码 SHA256 作为可核对指纹。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import ts from "typescript";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");
export const MIGRATION_TS = join(REPO_ROOT, "backend", "src", "shared", "migration.ts");

/**
 * 桩模块：fs（假迁移文件）。
 * 注意：`readFileSync` 只对**指定文件名**返回假迁移文件，其余一律返回 "SELECT 1;"。
 * 原因：`runMigrations` 内部还有若干步骤会用 `findSqlFile` + `readFileSync` 读取并**整文件下发** SQL，
 * 若无差别返回假迁移文件，假文件会被这些步骤重复执行，测出的"执行语句"就不是外部迁移段的结果了。
 */
const STUB_FS = `export const fsState = { fixture: "", files: [], exists: true, fixtureName: "001_gate_fixture.sql" };
export function readFileSync(pathArg) {
  return String(pathArg).endsWith(fsState.fixtureName) ? fsState.fixture : "SELECT 1;";
}
export function readdirSync() { return fsState.files; }
export function existsSync() { return fsState.exists; }
`;

/** 桩模块：mysql2/promise（记录真实下发的语句，不连库） */
const STUB_MYSQL = `export const dbState = { queries: [], result: [{ affectedRows: 0 }] };
const connection = {
  query: async (sql) => { dbState.queries.push(sql); return dbState.result; },
  end: async () => {},
};
export default { createConnection: async () => connection };
`;

/** 桩模块：logger（记录日志文本，供断言"被跳过的语句有日志"） */
const STUB_LOGGER = `export const logs = { info: [], warn: [], error: [], debug: [] };
const push = (bucket) => (...args) => { logs[bucket].push(args.map(String).join(" ")); };
export default { info: push("info"), warn: push("warn"), error: push("error"), debug: push("debug") };
`;

/** 桩模块：env（保证走真实迁移分支，不因 USE_MOCK_DB 提前返回） */
const STUB_ENV = `export const env = {
  USE_MOCK_DB: false, DB_HOST: "localhost", DB_PORT: 3306,
  DB_USER: "root", DB_PASSWORD: "test", DB_NAME: "test_db",
};
`;

/** 桩模块：seed-data（真实实现会连库写数据，与写闸门无关，置空） */
const STUB_SEED = `export async function seedData() { return undefined; }
`;

/** 需要重写的 import 说明符（其余 import 保持原样，如 node:path） */
const REWRITES = [
  ['from "fs"', 'from "./stub-fs.mjs"'],
  ['from "mysql2/promise"', 'from "./stub-mysql.mjs"'],
  ['from "./env"', 'from "./stub-env.mjs"'],
  ['from "./logger"', 'from "./stub-logger.mjs"'],
  ['from "./seed-data"', 'from "./stub-seed-data.mjs"'],
];

export function readMigrationSource() {
  return readFileSync(MIGRATION_TS, "utf8");
}

export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function rewriteImports(js) {
  let out = js;
  for (const [needle, replacement] of REWRITES) {
    if (!out.includes(needle)) throw new Error(`转译产物里找不到需重写的 import：${needle}`);
    out = out.split(needle).join(replacement);
  }
  return out;
}

/**
 * 在 `dir` 下写出桩模块 + 转译后的 migration 模块，并 import 回来。
 * @returns {Promise<{mod: any, stubs: {fsState: any, dbState: any, logs: any}, modulePath: string}>}
 */
export async function loadMigrationModule(dir, source = readMigrationSource(), tag = "new") {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "stub-fs.mjs"), STUB_FS, "utf8");
  writeFileSync(join(dir, "stub-mysql.mjs"), STUB_MYSQL, "utf8");
  writeFileSync(join(dir, "stub-logger.mjs"), STUB_LOGGER, "utf8");
  writeFileSync(join(dir, "stub-env.mjs"), STUB_ENV, "utf8");
  writeFileSync(join(dir, "stub-seed-data.mjs"), STUB_SEED, "utf8");

  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      removeComments: true,
    },
    fileName: "migration.ts",
  }).outputText;
  const modulePath = join(dir, `${tag}-migration.mjs`);
  writeFileSync(modulePath, rewriteImports(js), "utf8");

  const mod = await import(pathToFileURL(modulePath).href);
  // 注意：必须与 migration 模块用**同一个 URL**（不带查询串）import 桩模块，否则会拿到另一份状态对象
  const fsStub = await import(pathToFileURL(join(dir, "stub-fs.mjs")).href);
  const dbStub = await import(pathToFileURL(join(dir, "stub-mysql.mjs")).href);
  const logStub = await import(pathToFileURL(join(dir, "stub-logger.mjs")).href);
  return { mod, stubs: { fsState: fsStub.fsState, dbState: dbStub.dbState, logs: logStub.logs }, modulePath };
}

/**
 * 反测用源码：把写闸门"改回不挡"——`resolveWriteGate` 恒返回 allow（等价于闸门不生效）。
 * 用真实源码文本做定位替换，定位失败即抛错（防止反测悄悄失效）。
 */
export function makeGateDisabledSource(source) {
  const pattern = /export function resolveWriteGate\([^)]*\)[^{]*\{[\s\S]*?\n\}/;
  const matched = pattern.exec(source);
  if (!matched) throw new Error("反测失效：源码里定位不到 resolveWriteGate 函数块");
  const revertedBlock = 'export function resolveWriteGate(): MigrationWriteGate {\n  return "allow";\n}';
  return { source: source.replace(matched[0], revertedBlock), matched, revertedBlock };
}
