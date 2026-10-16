/**
 * S3-236 便携 ESM 解析钩子的实现体（由同目录 `ts-resolve-hooks.mjs` 通过 `register()` 装载）。
 *
 * 只做一件事：`./x` / `../x` 这类**无扩展名**的相对 import 解析失败时，退而尝试 `./x.ts`。
 * 不改变任何其它解析行为（找不到 .ts 就抛原始错误）。
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (/^\.{1,2}\//.test(specifier) && !/\.(ts|js|mjs|cjs|json)$/.test(specifier)) {
      for (const ext of [".ts", ".tsx", ".js", ".mjs"]) {
        try {
          const resolved = await nextResolve(`${specifier}${ext}`, context);
          if (existsSync(fileURLToPath(resolved.url))) return resolved;
        } catch {
          /* 继续试下一个扩展名 */
        }
      }
    }
    throw error;
  }
}
