/**
 * MIG-5b 公共库：在"vitest 起不来"的沙箱里，**原样执行测试文件本身**（而不是复刻断言）。
 *
 * 为什么不是复刻断言：踩坑[104] 的病灶就是"只写断言、从不执行 ⇒ 断言与实现语义脱节"。
 * 本库因此实现一个**最小 vitest 运行时**，把真实测试文件（`migration-split.test.ts`，或其修复前副本）
 * 用 TypeScript API 转译成 CJS 后**逐字执行**，断言、夹具装载、`vi.mock` 注册表全部走真实测试文件里的代码；
 * 只有"测试框架骨架"是本地实现的。
 *
 * 与真实 vitest 的对齐点（本单核心）：
 *   1. mock 注册表按 **vitest 4 自带的 `normalizeModuleId`** 索引 —— 该函数会剥掉 `node:` 前缀
 *      （`node:fs` 与 `fs` 归一为同一个 key `fs`），本库**直接 import vitest 的真实实现**，不复刻；
 *   2. `vi.mock` 的作用域与真实 vitest 一致：对该测试文件依赖图里的**所有**模块生效（含被测源码）；
 *   3. `expect` 直接用 `@vitest/expect`（`chai` + Jest 匹配器插件）拼装，失败文案与 vitest 逐字一致；
 *   4. `vi.fn()` 提供 `mock.calls` / `mockResolvedValue` / `mockImplementation` / `mockReset` 等测试文件用到的 API。
 *
 * 与真实 vitest 的差异（证据边界，写进证据包 README）：
 *   * 不跑 Vite 管道：源码用 TypeScript API 转译（真实 vitest 走 esbuild + Vite SSR transform），
 *     因此 `import.meta` / 装饰器 / 路径别名等 Vite 特有能力不在覆盖范围（本单测试文件未用到）；
 *   * 不实现 `vi.spyOn` / 快照 / 覆盖率等（本单未用到）；
 *   * `describe/it` 为顺序执行，无并发、无超时中断。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import ts from "typescript";
import {
  chai,
  JestChaiExpect,
  JestExtend,
  ChaiStyleAssertions,
  JestAsymmetricMatchers,
  getState,
  setState,
  ASYMMETRIC_MATCHERS_OBJECT,
  customMatchers,
  addCustomEqualityTesters,
} from "@vitest/expect";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");
export const EVIDENCE_DIR = resolve(HERE, "..");
export const BACKEND_DIR = join(REPO_ROOT, "backend");
export const BACKEND_SRC = join(BACKEND_DIR, "src");
export const MIGRATION_TS = join(BACKEND_SRC, "shared", "migration.ts");
export const TEST_FILE = join(BACKEND_SRC, "__tests__", "shared", "migration-split.test.ts");
export const TEST_DIR = dirname(TEST_FILE);
export const PRE_FIX_TEST_ARTIFACT = join(EVIDENCE_DIR, "outputs", "00a-pre-fix-migration-split.test.ts.txt");

export const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
export const readRealMigrationSource = () => readFileSync(MIGRATION_TS, "utf8");
export const readTestSource = (file = TEST_FILE) => readFileSync(file, "utf8");

/**
 * vitest 4 的真实 `normalizeModuleId`（取 `node_modules/vitest/dist/chunks/startVitestModuleRunner.*.js` 的具名导出 `n`）。
 * 为什么必须取真的：`vi.mock("fs")` 能否命中 `import ... from "node:fs"`，**完全取决于这个函数**，
 * 复刻一份等于自证；直接 import 才能证明"两个 id 撞在同一个 key 上"。
 */
async function loadVitestNormalizeModuleId() {
  const chunkDir = join(REPO_ROOT, "node_modules", "vitest", "dist", "chunks");
  const chunk = readdirSync(chunkDir).find((f) => /^startVitestModuleRunner(\..+)?\.js$/.test(f));
  if (!chunk) throw new Error(`找不到 vitest 的 startVitestModuleRunner chunk（目录：${chunkDir}）`);
  const mod = await import(pathToFileURL(join(chunkDir, chunk)).href);
  if (typeof mod.n !== "function") throw new Error("vitest chunk 未导出 normalizeModuleId（n）");
  return { normalizeModuleId: mod.n, chunkPath: join(chunkDir, chunk) };
}

export const vitestInternals = await loadVitestNormalizeModuleId();

/**
 * vitest 真实的提升变换（`vi.mock` / `vi.hoisted` 必须早于 import 生效）。
 *
 * 为什么必须用它：测试文件里 `import { readFileSync } from "node:fs"` 与 `vi.mock("fs")` 的先后关系，
 * 正是本轮两条红的**语义所在**——真实 vitest 会把 `vi.mock` 提升到 import 之前，所以顶层读文件必然读到 mock。
 * 本库直接 import `@vitest/mocker` 的 `hoistMocks`（真实实现）与 `acorn`（解析器），不复刻提升逻辑。
 */
async function loadHoistMocks() {
  const distDir = join(REPO_ROOT, "node_modules", "@vitest", "mocker", "dist");
  const chunk = readdirSync(distDir).find((f) => /^chunk-hoistMocks(\..+)?\.js$/.test(f));
  if (!chunk) throw new Error(`找不到 @vitest/mocker 的 hoistMocks chunk（目录：${distDir}）`);
  const mod = await import(pathToFileURL(join(distDir, chunk)).href);
  const parse = createRequire(join(REPO_ROOT, "package.json"))("acorn").parse;
  return {
    hoistMocks: mod.h,
    chunkPath: join(distDir, chunk),
    parse: (code) => parse(code, { ecmaVersion: "latest", sourceType: "module", allowAwaitOutsideFunction: true }),
  };
}

export const vitestHoist = await loadHoistMocks();

/**
 * 与 vitest 等价的 `expect`（`@vitest/expect` 的 chai + Jest 匹配器插件；`createExpect` 未导出，故按其实现拼装）。
 */
export function createExpect() {
  chai.use(JestExtend);
  chai.use(JestChaiExpect);
  chai.use(ChaiStyleAssertions);
  chai.use(JestAsymmetricMatchers);
  const expect = (value, message) => {
    const { assertionCalls } = getState(expect);
    setState({ assertionCalls: assertionCalls + 1 }, expect);
    return chai.expect(value, message);
  };
  Object.assign(expect, chai.expect);
  Object.assign(expect, globalThis[ASYMMETRIC_MATCHERS_OBJECT] ?? {});
  expect.getState = () => getState(expect);
  expect.setState = (state) => setState(state, expect);
  setState(
    {
      assertionCalls: 0,
      isExpectingAssertions: false,
      isExpectingAssertionsError: null,
      expectedAssertionsNumber: null,
      expectedAssertionsNumberErrorGen: null,
      currentTestName: "",
    },
    expect
  );
  expect.assert = chai.assert;
  expect.extend = (matchers) => chai.expect.extend(expect, matchers);
  expect.addEqualityTesters = (testers) => addCustomEqualityTesters(testers);
  expect.extend(customMatchers);
  return expect;
}

/** 测试文件用到的 `vi.fn()` 能力（calls / mockImplementation / mockResolvedValue / mockReset ...） */
export function createMockFn(implementation) {
  const calls = [];
  let impl = implementation;
  const fn = (...args) => {
    calls.push(args);
    return impl ? impl(...args) : undefined;
  };
  fn.mock = { calls };
  fn.mockImplementation = (next) => {
    impl = next;
    return fn;
  };
  fn.mockReturnValue = (value) => {
    impl = () => value;
    return fn;
  };
  fn.mockReturnValueOnce = (value) => {
    const previous = impl;
    impl = () => {
      impl = previous;
      return value;
    };
    return fn;
  };
  fn.mockResolvedValue = (value) => {
    impl = () => Promise.resolve(value);
    return fn;
  };
  fn.mockRejectedValue = (value) => {
    impl = () => Promise.reject(value);
    return fn;
  };
  fn.mockClear = () => {
    calls.length = 0;
    return fn;
  };
  fn.mockReset = () => {
    calls.length = 0;
    impl = undefined;
    return fn;
  };
  fn.mockName = (name) => {
    fn.__mockName = name;
    return fn;
  };
  return fn;
}

const isRelativeSpecifier = (spec) =>
  spec.startsWith(".") || spec.startsWith("/") || /^[A-Za-z]:[\\/]/.test(spec);

const transpileTs = (source, fileName, moduleKind) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: moduleKind,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      sourceMap: false,
    },
    fileName,
  }).outputText;

/**
 * 与 vitest 管道等价的转译：
 *   测试文件：TS → ESM → **vitest 真实 hoistMocks**（`vi.mock`/`vi.hoisted` 提升到 import 之前）→ CJS
 *   其它文件：TS → CJS（无 mock 语义差异）
 * 提升产物的 `const __vi_import_N__ = await import("…")` 改写为 `require("…")`：语义相同（顺序不变），
 * 只是适配本库的 CJS 加载器（沙箱里 `await import` 无法被本库的 mock 注册表拦截）。
 */
const transformForRunner = (source, absPath) => {
  if (!absPath.includes("__tests__")) return transpileTs(source, absPath, ts.ModuleKind.CommonJS);
  const esm = transpileTs(source, absPath, ts.ModuleKind.ESNext);
  const hoisted = vitestHoist.hoistMocks(esm, absPath, vitestHoist.parse, {});
  let code = hoisted ? hoisted.toString() : esm;
  // vitest 的 `vi` 必须早于"被提升的 vi.mock / vi.hoisted"可用：真实管道里由 SSR transform 把
  // `import ... from "vitest"` 提到模块最前面，这里照做（只动这一行，不改其它语句顺序）。
  const vitestImport = code.match(/^import\s*\{[^}]*\}\s*from\s*["']vitest["'];?[ \t]*$/m);
  if (vitestImport) code = `${vitestImport[0]}\n${code.replace(vitestImport[0], "")}`;
  return transpileTs(code.replace(/= await import\(/g, "= require("), absPath, ts.ModuleKind.CommonJS);
};

/**
 * 建一个"测试文件运行容器"：模块加载器（mock 注册表 + 真实源码 + 原生 require 兜底）+ vitest 框架骨架。
 *
 * @param {{ migrationSource: string, testSource: string, testPath?: string }} options
 */
export function createRuntime({ migrationSource, testSource, testPath = TEST_FILE }) {
  const { normalizeModuleId } = vitestInternals;
  const resolveCache = new Map();
  const sourceOverrides = new Map([
    [MIGRATION_TS, migrationSource],
    [testPath, testSource],
  ]);
  const mocks = new Map(); // mockKey -> factory
  const mockExports = new Map(); // mockKey -> 已生产的 mock 导出
  const moduleCache = new Map(); // absPath(+query) -> module

  const resolveFile = (absNoExt) => {
    if (resolveCache.has(absNoExt)) return resolveCache.get(absNoExt);
    const candidates = [absNoExt, `${absNoExt}.ts`, `${absNoExt}.js`, `${absNoExt}.mjs`, join(absNoExt, "index.ts")];
    const found = candidates.find((c) => existsSync(c)) ?? null;
    resolveCache.set(absNoExt, found);
    return found;
  };

  /** 与 vitest 一致的 mock key：先解析成真实路径（相对说明符）或原样（裸说明符），再走 normalizeModuleId */
  const mockKeyFor = (spec, fromDir) => {
    if (!isRelativeSpecifier(spec)) return normalizeModuleId(spec);
    const abs = resolve(fromDir, spec);
    return normalizeModuleId(resolveFile(abs) ?? abs);
  };

  const produceMockExports = (key) => {
    if (mockExports.has(key)) return mockExports.get(key);
    const factory = mocks.get(key);
    if (!factory) throw new Error(`harness 内部错误：mock key 未注册：${key}`);
    const raw = typeof factory === "function" ? factory() : factory;
    const exports = raw ?? {};
    // 与 vitest 的 ESM 语义对齐：mock 工厂返回的对象就是模块命名空间（`default` 即默认导出），
    // 因此补 `__esModule` 让 TypeScript 的 CJS interop（__importDefault）不再二次包裹。
    if (typeof exports === "object" && !("__esModule" in exports)) exports.__esModule = true;
    mockExports.set(key, exports);
    return exports;
  };

  const requireFrom = (spec, fromDir, fromFile, { ignoreMock = false } = {}) => {
    if (spec === "vitest") return framework;
    const key = mockKeyFor(spec, fromDir);
    if (!ignoreMock && mocks.has(key)) return produceMockExports(key);
    if (!isRelativeSpecifier(spec)) {
      // 裸说明符（含 node 内置）：走原生 require —— 与 vitest 的 "externalize" 分支等价
      return createRequire(fromFile)(spec);
    }
    const abs = resolveFile(resolve(fromDir, spec));
    if (!abs) throw new Error(`harness 解析不到模块：${spec}（from ${fromFile}）`);
    return loadFile(abs, { ignoreMock });
  };

  const loadFile = (absPath, { ignoreMock = false, query = "" } = {}) => {
    const cacheKey = `${absPath}${query}`;
    if (moduleCache.has(cacheKey)) return moduleCache.get(cacheKey).exports;
    const source = sourceOverrides.get(absPath) ?? readFileSync(absPath, "utf8");
    const js = transformForRunner(source, absPath);
    const mod = { exports: {} };
    moduleCache.set(cacheKey, mod); // 先入表：允许循环依赖
    const dir = dirname(absPath);
    // eslint-disable-next-line no-new-func
    new Function("require", "module", "exports", "__filename", "__dirname", js)(
      (spec) => requireFrom(spec, dir, absPath, { ignoreMock }),
      mod,
      mod.exports,
      absPath,
      dir
    );
    return mod.exports;
  };

  const framework = {};
  const suites = [];
  let current = null;
  const collectSuite = () => current;

  framework.vi = {
    hoisted: (factory) => factory(),
    fn: createMockFn,
    mock: (spec, factory) => {
      const key = mockKeyFor(spec, TEST_DIR);
      mocks.set(key, factory);
      mockExports.delete(key);
      moduleCache.clear(); // 与 vitest 的 invalidateModuleById 等价：已加载的模块失效
      return undefined;
    },
    doMock: (spec, factory) => framework.vi.mock(spec, factory),
    unmock: (spec) => {
      const key = mockKeyFor(spec, TEST_DIR);
      mocks.delete(key);
      mockExports.delete(key);
      moduleCache.clear();
      return undefined;
    },
    importActual: async (spec) => requireFrom(spec, TEST_DIR, testPath, { ignoreMock: true }),
    spyOn: () => {
      throw new Error("harness 未实现 vi.spyOn（本单测试文件未用到）");
    },
  };
  framework.expect = createExpect();
  framework.describe = (name, body) => {
    const suite = {
      name,
      path: [...(current?.path ?? []), name],
      hooks: { before: [], after: [], beforeAll: [], afterAll: [] },
      tests: [],
      children: [],
      parent: current,
    };
    (current ? current.children : suites).push(suite);
    const previous = current;
    current = suite;
    try {
      body();
    } finally {
      current = previous;
    }
  };
  framework.it = (name, body) => {
    const suite = collectSuite();
    if (!suite) throw new Error(`it("${name}") 不在 describe 内（harness 只支持嵌套 describe 的用例）`);
    suite.tests.push({ name, body });
  };
  framework.beforeEach = (hook) => current.hooks.before.push(hook);
  framework.afterEach = (hook) => current.hooks.after.push(hook);
  // 本单测试文件未使用 beforeAll/afterAll；保留 API 但按"每用例前/后"执行，避免静默不生效
  framework.beforeAll = (hook) => current.hooks.before.push(hook);
  framework.afterAll = (hook) => current.hooks.after.push(hook);

  const flatten = (list) => list.flatMap((suite) => [{ suite }, ...flatten(suite.children)]);

  const hooksFor = (suite, kind) => {
    const chain = [];
    for (let node = suite; node; node = node.parent) chain.unshift(node);
    return chain.flatMap((node) => node.hooks?.[kind] ?? []);
  };

  /** 执行被测测试文件（模块顶层代码 + 全部用例） */
  const run = async () => {
    loadFile(testPath); // 触发模块顶层（vi.mock 注册 + 夹具装载）
    const results = [];
    for (const { suite } of flatten(suites)) {
      for (const test of suite.tests) {
        const label = [...suite.path, test.name].join(" > ");
        const started = Date.now();
        try {
          for (const hook of hooksFor(suite, "before")) await hook();
          await test.body();
          for (const hook of hooksFor(suite, "after")) await hook();
          results.push({ label, name: test.name, suite: suite.name, ok: true, ms: Date.now() - started });
        } catch (error) {
          results.push({ label, name: test.name, suite: suite.name, ok: false, error, ms: Date.now() - started });
          try {
            for (const hook of hooksFor(suite, "after")) await hook();
          } catch {
            /* 与 vitest 一致：afterEach 失败不覆盖主失败 */
          }
        }
      }
    }
    return results;
  };

  return {
    framework,
    run,
    mocks,
    mockExports,
    requireFrom,
    loadFile,
    /** 直接拿被测源码模块（断言之外取读数用） */
    loadMigrationModule: () => loadFile(MIGRATION_TS),
  };
}

/** 把一条失败渲染成"vitest 风格"的一行（原始输出用） */
export function formatFailure(result) {
  const error = result.error;
  const name = error?.name || "Error";
  const message = String(error?.message ?? error).split("\n")[0];
  return `AssertionError/Error: ${name}: ${message}`;
}

export const readJsonMaybe = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
