/** 注册 TS 无扩展名导入解析钩子（配合 s3-67-ts-loader.mjs 使用） */
import { register } from "node:module";

register(new URL("./s3-67-ts-loader.mjs", import.meta.url).href);
