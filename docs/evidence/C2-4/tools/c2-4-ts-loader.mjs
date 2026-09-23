/**
 * C2-4 运行期探针的「无子进程 TS 加载器」。
 *
 * 为什么需要它：
 *   本沙箱内 `node` 的 child_process spawn 被拒（EPERM）。实测 `npx tsx` 直接失败：
 *     Error: spawn EPERM  at ChildProcess.spawn … tsx/node_modules/esbuild/lib/main.js:2272 ensureServiceIsRunning
 *   （tsx 依赖 esbuild 的**常驻服务子进程**，因此在本机不可用）
 *   ⇒ 换用 node 自带的**进程内**类型擦除（`module.stripTypeScriptTypes`）+ 一个 ESM loader：
 *     ① resolve：把后端源码里 TS 风格的**无扩展名相对导入**补成 `.ts`；把指向 `.js` 但实际是 `.ts` 的导入
 *        （如 `./jobs/report-aggregation.job.js`）回退到 `.ts`；
 *     ② load：`.ts` 文件读入后做 `stripTypeScriptTypes(code,{mode:"strip"})` 再交给 node。
 *   不 spawn 任何子进程、不写仓库任何文件。
 *
 * 用法：见 c2-4-03-runtime-probe.mjs（`register('./c2-4-ts-loader.mjs', import.meta.url)`）
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const isRel = (s) => s.startsWith("./") || s.startsWith("../") || s.startsWith("/");

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (!isRel(specifier)) throw err;
    const tries = [];
    if (specifier.endsWith(".js")) tries.push(specifier.replace(/\.js$/, ".ts"));
    tries.push(`${specifier}.ts`, `${specifier}/index.ts`);
    for (const candidate of tries) {
      try {
        return await next(candidate, context);
      } catch {
        /* 继续试下一个 */
      }
    }
    throw err;
  }
}

export async function load(url, context, next) {
  if (url.endsWith(".ts")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    return {
      format: "module",
      shortCircuit: true,
      // 用 TypeScript 编译器 API 的**单文件转译**（进程内，不起 esbuild 服务进程）：
      //   - 后端源码存在 `import { state, result, Row } from "./mock-db-state"` 这类
      //     「值与类型混在一个具名导入」的写法，node 自带 strip/transform 都会保留 `Row`，
      //     运行期报 "does not provide an export named 'Row'"；tsc 的单文件转译会做**导入消除**。
      source: ts.transpileModule(source, {
        fileName: fileURLToPath(url),
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      }).outputText,
    };
  }
  return next(url, context);
}
