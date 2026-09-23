/**
 * S3-80 B-2 核验探针 —— ESM 解析钩子：把 `backend/src/shared/db.ts` 换成 SQLite 替身。
 *
 * 只重定向**这一个模块**（数据访问层），产品代码（路由/控制器/服务）一行不改、原样加载。
 * 其它任何模块（shared/app-error、shared/logger、middleware、…）都走原解析链。
 *
 * 【B-2b 说明】本文件由 docs/evidence/S3-80-B2/probe/hooks.mjs 复制而来（S3-80-B2 原文件未被修改）。
 * 唯一改动：判定方式由"看 specifier 字符串"改为"看解析后的 URL 是否等于 backend/src/shared/db.ts"。
 * 原因：主干道 sale-bill.service → shared/trace-code.ts 用的是相对简写 `import ... from "./db"`，
 * 原判定（/shared\/db$/ 匹配 specifier）漏掉它，会把真实 config/database.ts 拉进来
 * （进而加载 __tests__/mocks，探针崩溃）。替换目标仍**只有** backend/src/shared/db.ts 这一个模块。
 */
const ADAPTER_URL = new URL("./db-adapter.mjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolveSafe(specifier, context, nextResolve);
  const normalized = String(resolved.url).replace(/\\/g, "/");
  if (/\/backend\/src\/shared\/db\.(ts|js)$/.test(normalized)) {
    return { url: ADAPTER_URL, shortCircuit: true, format: "module" };
  }
  return resolved;
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
