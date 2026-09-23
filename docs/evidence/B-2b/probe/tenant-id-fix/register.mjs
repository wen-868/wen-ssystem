/** 注册解析钩子（配合 tsx：`tsx --import ./register.mjs <探针>.ts`） */
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
