/**
 * C2-4 加载器冒烟：证明「无子进程加载后端 TS 源码」在本沙箱可用/不可用，并给出原始输出。
 * 用法：node docs/evidence/C2-4/tools/c2-4-ts-loader-smoke.mjs
 */
import { register } from "node:module";

register("./c2-4-ts-loader.mjs", import.meta.url);
process.env.NODE_ENV = "test";
process.env.USE_MOCK_DB = "true";
process.env.JWT_SECRET = "c2-4-smoke-secret";

try {
  const { env } = await import("../../../../backend/src/config/env.ts");
  const { PLATFORM_JWT_ISSUER } = await import("../../../../backend/src/middleware/auth.ts");
  console.log(`SMOKE_OK import backend TS 成功：USE_MOCK_DB=${env.USE_MOCK_DB} JWT_SECRET=${env.JWT_SECRET} iss=${PLATFORM_JWT_ISSUER}`);
  process.exit(0);
} catch (err) {
  console.log(`SMOKE_FAIL ${err?.name}: ${err?.message}`);
  process.exit(1);
}
