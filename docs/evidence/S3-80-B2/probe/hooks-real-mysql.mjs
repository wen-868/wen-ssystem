/**
 * S3-80 B-2 真库探针（02）用解析钩子：
 *  1. 无扩展名相对导入 → 补 `.ts`（产品源码风格，构建期由 fix-esm-extensions.js 处理）
 *  2. `backend/src/__tests__/mocks/mock-db` → 打桩（真库模式下不该被调用；见 stub-mock-db.mjs）
 *
 * **不替换** shared/db、不替换任何业务模块 ⇒ 02 探针跑的是真代码 + 真 mysql2。
 */
const STUB_URL = new URL("./stub-mock-db.mjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolveSafe(specifier, context, nextResolve);
  if (/\/backend\/src\/__tests__\/mocks\/mock-db\.(ts|js)$/.test(resolved.url.replace(/\\/g, "/"))) {
    return { url: STUB_URL, shortCircuit: true, format: "module" };
  }
  return resolved;
}

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
