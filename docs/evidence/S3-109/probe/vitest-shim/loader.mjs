import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SHIM_URL = new URL("./shim.mjs", import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === "vitest" || specifier.startsWith("vitest/")) {
    return { url: SHIM_URL, format: "module", shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith(".test.ts")) {
    let source = readFileSync(fileURLToPath(url), "utf-8");
    // 反测钩子：允许把断言对象从「修好的迁移文件」换成指定 SQL 文件，用于证明断言真的会红
    const override = process.env.S3_109_SQL_OVERRIDE;
    if (override) {
      source = source.replace(
        '"../../../../docs/migrations/151_points_columns_fill.sql"',
        JSON.stringify(override),
      );
    }
    // vitest 下 __dirname 可用（CJS 互操作），原生 ESM 无此变量 ⇒ 注入等价实现
    const prefix =
      "import { fileURLToPath as __shimF2U } from 'node:url';\n" +
      "import { dirname as __shimDir } from 'node:path';\n" +
      "const __dirname = __shimDir(__shimF2U(import.meta.url));\n";
    return { format: "module-typescript", source: prefix + source, shortCircuit: true };
  }
  return next(url, context);
}
