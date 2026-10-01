#!/usr/bin/env node
/**
 * S3-154 静态同口径断言（本沙箱替代 vitest）
 *
 * 背景：本沙箱 node 无法创建子进程（`spawn EPERM`），vitest 配置加载即失败 ⇒
 * 用本脚本承接"同一份断言"：① 静态断言 —— 商品导入的行级 catch 必须走中文业务文案映射、
 * 不得直接回 `e?.message` 原文；② 行为断言 —— 从生产源码里**原样提取** S3-154 的映射函数
 * （经 typescript 的 transpileModule 在进程内转译，不 spawn），验证撞键/非撞键两种语义。
 *
 * 用法：
 *   node backend/scripts/s3-154-static-check.mjs            正测（绿）
 *   node backend/scripts/s3-154-static-check.mjs --revert   反测：把文案改回库报错原文 ⇒ 同一断言必红
 *
 * 退出码：0 = 正测全 PASS / 反测确实红；1 = 不符合预期。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SERVICE = path.join(REPO, "backend", "src", "services", "admin", "data-transfer.service.ts");

/** 改造前的原始写法（S3-154 之前的 HEAD 原文），反测用它替换回去 */
const ORIGINAL_CATCH = 'errors.push(`第 ${rIdx + 1} 行：${e?.message || "导入失败"}`);';
/**
 * 商品导入的行级 catch 里那条 errors.push。
 * 注意：同一函数里还有一条静态文案（`第 ${rIdx + 1} 行：缺少商品名称`），必须用
 * "行：后面紧跟 ${变量}" 精确区分，否则会匹配到错的那条（本装置第一版就踩了这个坑）。
 */
const CATCH_LINE_RE = /errors\.push\(`第 \$\{rIdx \+ 1\} 行：\$\{.*`\);/;

const revertMode = process.argv.includes("--revert");
const originalSource = readFileSync(SERVICE, "utf8");
let source = originalSource;
let mutation = "正测（源码原样，未做替换）";
if (revertMode) {
  source = source.replace(CATCH_LINE_RE, ORIGINAL_CATCH);
  mutation =
    source === originalSource
      ? "反测替换未生效（未找到目标 catch 行）"
      : "反测（已把行级 catch 文案改回 e?.message 原文）";
}

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ ok: true, name, detail: detail === undefined ? "" : String(detail) });
  } catch (e) {
    results.push({ ok: false, name, detail: e?.message || String(e) });
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/* ── ① 从生产源码原样提取 S3-154 映射函数并转译（进程内，不 spawn） ── */
let rowErrorMessage = null;
let extracted = "";
check("从生产源码提取 S3-154 映射函数", () => {
  const start = source.indexOf("const BARCODE_DUPLICATE_MESSAGE");
  assert(start >= 0, "未找到 BARCODE_DUPLICATE_MESSAGE 常量（映射函数未落地？）");
  const body = source.indexOf('return (err as Error)?.message || "导入失败";', start);
  assert(body > start, "未找到 productImportRowErrorMessage 的兜底返回");
  const end = source.indexOf("\n}", body);
  assert(end > body, "未找到函数结束花括号");
  extracted = source.slice(start, end + 2);
  const js = ts.transpileModule(extracted, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const factory = new Function(`${js}\nreturn { productImportRowErrorMessage };`);
  rowErrorMessage = factory().productImportRowErrorMessage;
  assert(typeof rowErrorMessage === "function", "提取出的 productImportRowErrorMessage 不是函数");
  return `提取 ${extracted.split("\n").length} 行并转译成功`;
});

/* ── ② 静态断言：行级 catch 必须走映射，不得回原文 ── */
let catchLine = "";
check("行级 catch 走中文映射（productImportRowErrorMessage）", () => {
  const m = source.match(CATCH_LINE_RE);
  assert(m, "未找到商品导入的 errors.push 行级文案");
  catchLine = m[0];
  assert(
    catchLine.includes("productImportRowErrorMessage(e)"),
    `catch 行未使用映射函数：${catchLine}`,
  );
  return catchLine.trim();
});
check("行级 catch 不得直接回 e?.message 原文", () => {
  assert(catchLine.length > 0, "上一项未取到 catch 行");
  assert(!catchLine.includes("e?.message"), `catch 行仍直接把库报错原文回传：${catchLine}`);
  return "无 e?.message";
});

/* ── ③ 行为断言（喂的是真 MariaDB/MySQL 1062 的同形报错） ── */
const barcodeDup = Object.assign(
  new Error("Duplicate entry '6901234567890' for key 'uk_product_sku_tenant_barcode'"),
  { code: "ER_DUP_ENTRY", errno: 1062 },
);
const codeDup = Object.assign(
  new Error("Duplicate entry 'SKU001' for key 'uk_product_sku_code'"),
  { errno: 1062 },
);
const otherErr = new Error("Data too long for column 'sku_name' at row 1");

check("条码撞唯一键 ⇒ 中文业务文案（不含 Duplicate entry）", () => {
  const got = rowErrorMessage(barcodeDup);
  assert(got === "该条码已被其他商品使用", `实际：${got}`);
  assert(!got.includes("Duplicate entry"), `文案仍含库报错原文：${got}`);
  return got;
});
check("商品编码撞唯一键 ⇒ 中文业务文案（只认 errno=1062 也能判）", () => {
  const got = rowErrorMessage(codeDup);
  assert(got === "商品编码重复，请检查后重试", `实际：${got}`);
  assert(!got.includes("Duplicate entry"), `文案仍含库报错原文：${got}`);
  return got;
});
check("非撞键错误 ⇒ 保留原始信息（不误吞、不掩盖）", () => {
  const got = rowErrorMessage(otherErr);
  assert(got === otherErr.message, `实际：${got}`);
  return got;
});
check("非 Error 入参 ⇒ 兜底中文『导入失败』", () => {
  const got = rowErrorMessage(undefined);
  assert(got === "导入失败", `实际：${got}`);
  return got;
});

/* ── ④ 测试文件已落地同口径用例（CI 会真跑） ── */
check("单测文件含 S3-154 撞键中文用例（断言不含 Duplicate entry）", () => {
  const t = readFileSync(
    path.join(REPO, "backend", "src", "__tests__", "services", "admin", "data-transfer.service.test.ts"),
    "utf8",
  );
  assert(t.includes("该条码已被其他商品使用"), "单测缺少条码撞键中文断言");
  assert(t.includes("第 2 行：该条码已被其他商品使用"), "单测的行号口径与生产函数不一致（应为『第 2 行』）");
  assert(t.includes("not.toContain(\"Duplicate entry\")"), "单测缺少『不含 Duplicate entry』断言");
  return "命中 3 条断言";
});

/* ── ⑤ `--run-service`：真跑生产函数（Node 类型剥离 + loader 桩 db），验证单测 mock 序列正确 ── */
if (process.argv.includes("--run-service")) {
  const { registerHooks } = await import("node:module");
  const { fileURLToPath, pathToFileURL } = await import("node:url");

  let plan = [];
  let calls = 0;
  globalThis.__s3154Query = async () => {
    calls += 1;
    const step = plan.shift();
    if (step === undefined) return {};
    if (step && step.__reject) throw step.__reject;
    return step;
  };

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.endsWith("/shared/db")) return { url: "s3154:db", shortCircuit: true };
      if (specifier.endsWith("export.service")) return { url: "s3154:export", shortCircuit: true };
      if (specifier.startsWith(".")) {
        try {
          return nextResolve(specifier, context);
        } catch {
          return nextResolve(`${specifier}.ts`, context);
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === "s3154:db") {
        return {
          format: "module",
          shortCircuit: true,
          source: [
            "export const query = (sql, params) => globalThis.__s3154Query(sql, params);",
            "export const queryOne = async () => [];",
            "export const queryWithTenant = async () => [];",
            "export const queryOneWithTenant = async () => [];",
            "export const transaction = async () => { throw new Error('S3-154 装置未桩 transaction'); };",
          ].join("\n"),
        };
      }
      if (url === "s3154:export") {
        return {
          format: "module",
          shortCircuit: true,
          source: "export const exportProducts = async () => [];\nexport const exportCustomers = async () => [];",
        };
      }
      if (url.endsWith(".ts")) {
        const code = readFileSync(fileURLToPath(url), "utf8");
        const js = ts.transpileModule(code, {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        }).outputText;
        return { format: "module", shortCircuit: true, source: js };
      }
      return nextLoad(url, context);
    },
  });

  const svc = await import(pathToFileURL(SERVICE).href);
  const CSV = "商品编码,条码,商品名称,规格型号,单位,品牌,售价\n" +
    "SKU001,6901234567890,五粮液 52度 500ml,500ml,瓶,五粮液,450";
  // 与单测完全相同的 mock 序列（分类查重/建分类/SPU 查重/建 SPU/patchSpu/SKU 查重 → 第 7 步写 SKU）
  const basePlan = () => [[], { insertId: 10 }, [], { insertId: 20 }, {}, []];
  const runWith = async (rest) => {
    plan = [...basePlan(), ...rest];
    calls = 0;
    return svc.importProductsCsv(CSV, "t1");
  };

  const okRes = await runWith([{ insertId: 30 }, [], { insertId: 40 }, [{ id: 1 }], {}]);
  check("真函数（loader 桩 db）：正常行仍新增成功（imported=1/skipped=0/errors=[]）", () => {
    assert(
      okRes.imported === 1 && okRes.skipped === 0 && okRes.errors.length === 0,
      `实际 ${JSON.stringify(okRes)}（消耗 query 次数 ${calls}）`,
    );
    return `${JSON.stringify({ imported: okRes.imported, updated: okRes.updated, skipped: okRes.skipped })}，共 ${calls} 次 query`;
  });

  const dupRes = await runWith([{ __reject: barcodeDup }]);
  check("真函数（loader 桩 db）：第 7 步写 SKU 撞条码键 ⇒ errors[] 中文、无 Duplicate entry", () => {
    assert(dupRes.imported === 0 && dupRes.skipped === 1, `实际 ${JSON.stringify(dupRes)}`);
    assert(
      dupRes.errors[0] === "第 2 行：该条码已被其他商品使用",
      `实际 errors=${JSON.stringify(dupRes.errors)}（消耗 query 次数 ${calls}）`,
    );
    assert(!dupRes.errors.join("|").includes("Duplicate entry"), "仍含库报错原文");
    return dupRes.errors[0];
  });

  const codeRes = await runWith([{ __reject: codeDup }]);
  check("真函数（loader 桩 db）：写 SKU 撞商品编码键 ⇒ errors[] 中文、无 Duplicate entry", () => {
    assert(
      codeRes.errors[0] === "第 2 行：商品编码重复，请检查后重试",
      `实际 errors=${JSON.stringify(codeRes.errors)}`,
    );
    assert(!codeRes.errors.join("|").includes("Duplicate entry"), "仍含库报错原文");
    return codeRes.errors[0];
  });

  const otherRes = await runWith([{ __reject: otherErr }]);
  check("真函数（loader 桩 db）：非撞键错误保留原文（不误吞）", () => {
    assert(
      otherRes.errors[0] === "第 2 行：Data too long for column 'sku_name' at row 1",
      `实际 errors=${JSON.stringify(otherRes.errors)}`,
    );
    return otherRes.errors[0];
  });
}

/* ── 输出 ── */
console.log(`# S3-154 静态同口径断言 —— ${mutation}`);
console.log(`# 被测文件：backend/src/services/admin/data-transfer.service.ts`);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `   ← ${r.detail}` : ""}`);
}
const failed = results.filter((r) => !r.ok);
const passed = results.length - failed.length;
console.log(`小结[s3-154]：${passed} passed / ${failed.length} failed`);

if (revertMode) {
  const expectedRed = failed.length >= 2 && results.some((r) => !r.ok && r.name.includes("中文映射"));
  console.log(
    expectedRed
      ? "反测成立：改回库报错原文后，静态断言确实变红（上面 FAIL 即原始红输出）"
      : "反测未成立：改回原文后断言没有变红 ⇒ 该断言无分辨力",
  );
  process.exit(expectedRed ? 0 : 1);
}
process.exit(failed.length === 0 ? 0 : 1);
