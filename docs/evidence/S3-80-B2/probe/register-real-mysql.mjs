/** 注册真库探针（02）的解析钩子 */
import { register } from "node:module";

register("./hooks-real-mysql.mjs", import.meta.url);
