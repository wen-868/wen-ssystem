// 注册 loader：把裸模块 "vitest" 重定向到 shim.mjs，并给 *.test.ts 注入 vitest 环境里可用的 __dirname。
import { register } from "node:module";

register("./loader.mjs", import.meta.url);
