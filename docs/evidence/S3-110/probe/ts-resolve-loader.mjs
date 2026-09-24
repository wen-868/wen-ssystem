/**
 * Node 原生 TS 支持（type stripping）的补充解析钩子。
 *
 * 用途：S3-110 的反测脚本要**直接 import 生产 TS 源码**（shared/migration.ts 的真切块/加前缀/
 * safeExec），而 Node 原生剥离要求显式扩展名，源码里的 `./env` 这类无扩展相对导入会
 * ERR_MODULE_NOT_FOUND。本钩子只做一件事：父模块是 .ts 且说明符是无扩展相对路径时，
 * 依次尝试 `<spec>.ts`、`<spec>/index.ts`。
 *
 * 用法：node --import ./docs/evidence/S3-110/probe/ts-resolve-hook.mjs <script>
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && (context.parentURL || "").endsWith(".ts")) {
    for (const candidate of [specifier + ".ts", specifier + "/index.ts"]) {
      try {
        return await nextResolve(candidate, context);
      } catch {
        // 继续尝试下一个候选
      }
    }
  }
  return nextResolve(specifier, context);
}
