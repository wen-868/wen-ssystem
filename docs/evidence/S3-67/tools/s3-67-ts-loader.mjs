/**
 * S3-67 取证环境辅助：只做「TS 源码里的无扩展名相对导入」解析（Node ESM 默认不做 .ts 后缀补全）。
 * 用途：在本沙箱内直接以 `node --experimental-transform-types` 运行 backend 当前源码
 *      （本沙箱禁止 node 创建带管道的子进程 ⇒ tsx/vite/playwright 默认启动全部 EPERM）。
 * 🔴 只影响模块解析，不改任何业务代码、不改变任何运行期样式。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (!specifier.startsWith(".") && !specifier.startsWith("/")) throw err;
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const base = path.resolve(path.dirname(parent), specifier);
    const ext = path.extname(base);
    const candidates = [
      // TS NodeNext 写法：源码里写 `./x.js`，磁盘上是 `./x.ts`
      ...(ext ? [base.slice(0, -ext.length) + ".ts", base.slice(0, -ext.length) + ".tsx"] : []),
      base + ".ts",
      base + ".tsx",
      base + ".mts",
      path.join(base, "index.ts"),
      base + ".js",
      base + ".mjs",
      base + ".cjs",
      path.join(base, "index.js"),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return { url: pathToFileURL(c).href, shortCircuit: true };
    }
    throw err;
  }
}

/**
 * 载入钩子：用 TypeScript 的 transpileModule（纯 JS，无需子进程）转译 .ts。
 * 与 Node 内置 strip-types 的差别（必须用它的原因）：内置剥离**不会**消除"只用于类型位置的具名导入"
 * （实测报错：`import { state, result, Row } from "./mock-db-state"` —— Row 是 interface），
 * 而 TS 的 transpile 会按值位置用法做导入消除。
 */
export async function load(url, context, nextLoad) {
  if (url.startsWith("file://") && /\.(ts|tsx|mts)$/.test(url)) {
    const file = fileURLToPath(url);
    const source = fs.readFileSync(file, "utf8");
    const out = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        esModuleInterop: true,
        experimentalDecorators: true,
        sourceMap: true,
        inlineSources: true,
        isolatedModules: true,
      },
    }).outputText;
    return { format: "module", source: out, shortCircuit: true };
  }
  return nextLoad(url, context);
}
