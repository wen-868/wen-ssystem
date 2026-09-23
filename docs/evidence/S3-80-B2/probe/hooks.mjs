/**
 * S3-80 B-2 核验探针 —— ESM 解析钩子：把 `backend/src/shared/db.ts` 换成 SQLite 替身。
 *
 * 只重定向**这一个模块**（数据访问层），产品代码（路由/控制器/服务）一行不改、原样加载。
 * 其它任何模块（shared/app-error、shared/logger、middleware、…）都走原解析链。
 */
const ADAPTER_URL = new URL("./db-adapter.mjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (/shared\/db(\.ts|\.js)?$/.test(specifier)) {
    const resolved = await nextResolveSafe(specifier, context, nextResolve);
    const normalized = resolved.url.replace(/\\/g, "/");
    if (/\/backend\/src\/shared\/db\.(ts|js)$/.test(normalized)) {
      return { url: ADAPTER_URL, shortCircuit: true, format: "module" };
    }
    return resolved;
  }
  return nextResolveSafe(specifier, context, nextResolve);
}

/**
 * 兼容 Node 原生类型剥离（ESM 要求显式扩展名）：相对说明符解析失败时补 `.ts` 再试。
 * 说明：产品源码用无扩展名相对导入（构建时由 scripts/fix-esm-extensions.js 补 .js），
 * 因此这里只做"补 .ts"的解析兼容，不改任何源码。
 */
async function nextResolveSafe(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith(".") && !/\.(js|mjs|cjs|jsx|ts|mts|cts|tsx|json|node)$/i.test(specifier)) {
      try {
        return await nextResolve(specifier + ".ts", context);
      } catch {
        return await nextResolve(specifier + "/index.ts", context);
      }
    }
    throw err;
  }
}
