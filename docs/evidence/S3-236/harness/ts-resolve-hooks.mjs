/**
 * S3-236 便携 ESM 解析钩子：把**无扩展名的相对 import**（本仓 TS 源码风格，如
 * `import { x } from "./batch2-entry"`）解析到 `.ts` 文件。
 *
 * 为什么需要它（诚实标注）：本沙箱下 esbuild/tsx 都要 **spawn 子进程 + 管道 stdio**（EPERM，
 * 文档写明的沙箱边界），vitest 与 tsx 都起不来 ⇒ 改用 Node 24 自带的类型剥离
 * （`--experimental-strip-types`）+ 本钩子补上"扩展名解析"这一环，即可直接跑本单的目录常量。
 *
 * 用法（仓库根执行）：
 *   node --experimental-strip-types --import ./docs/evidence/S3-236/harness/ts-resolve-hooks.mjs <脚本>
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./ts-resolve-hooks-impl.mjs", pathToFileURL(import.meta.filename));
