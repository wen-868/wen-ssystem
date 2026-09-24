/**
 * 注册 TS 无扩展相对导入的解析钩子（与 C6-1A 的 register-hook.mjs 同范式）。
 *
 * 用法：node --import ./docs/evidence/S3-110/probe/ts-resolve-hook.mjs <script>
 */
import { register } from "node:module";

register("./ts-resolve-loader.mjs", import.meta.url);
