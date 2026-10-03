#!/usr/bin/env node
/**
 * S3-155 静态同口径断言（本沙箱替代 vitest）
 *
 * 背景：本沙箱 node 无法创建子进程（`spawn EPERM`），vitest 配置加载即失败 ⇒
 * 用本脚本承接"同一份断言"：
 *   ① 静态 —— 共享实现 `backend/src/shared/db-error-message.ts` 存在；**四处引用**
 *      （`data-transfer.service.ts` + 催收 / 商品库 / 离线单三处新增）；S3-154 的本地副本已删除；
 *      三个新增点位不再出现 `err instanceof Error ? err.message : String(err)` 原文写法；四处内 `ER_DUP_ENTRY` 字面量 = 0。
 *   ② 行为 —— 从生产源码**原样提取**共享实现（`ts.transpileModule` 进程内转译，不 spawn），
 *      验证：只认 1062 / 条码列与非条码列区分 / 领域化中文文案 / 非撞键保留原文 / 非 Error 兜底。
 *   ③ `--run-service` —— 真跑三个生产函数（Node 24 类型剥离 + loader 桩 db），验证端到端文案与 mock 序列。
 *
 * 用法：
 *   node backend/scripts/s3-155-static-check.mjs                    正测（绿）
 *   node backend/scripts/s3-155-static-check.mjs --revert           反测：催收调用点改回 `err.message` ⇒ 同一断言必红
 *   node backend/scripts/s3-155-static-check.mjs --run-service      附带真跑三个生产函数
 *   node backend/scripts/s3-155-static-check.mjs --revert --run-service  反测（含真函数吐出库报错原文）
 *
 * 退出码：0 = 正测全 PASS / 反测确实红；1 = 不符合预期。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SHARED = path.join(REPO, "backend", "src", "shared", "db-error-message.ts");
const TRANSFER = path.join(REPO, "backend", "src", "services", "admin", "data-transfer.service.ts");
const COLLECTION = path.join(REPO, "backend", "src", "services", "admin", "credit-collection.service.ts");
const LIBRARY = path.join(REPO, "backend", "src", "services", "platform", "library.service.ts");
const DELTA = path.join(REPO, "backend", "src", "services", "sync", "delta-sync.service.ts");

const revertMode = process.argv.includes("--revert");
const runService = process.argv.includes("--run-service");

/** 改造前的原始写法（S3-155 之前的催收 catch 原文），反测用它替换回去 */
const ORIGINAL_CATCH = "const message = err instanceof Error ? err.message : String(err);";
const NEW_CATCH_RE = /const message = rowErrorMessage\(err, \{ dupMessage: "该客户存在重复的催收记录" \}\);/;

const sources = new Map([
  [TRANSFER, readFileSync(TRANSFER, "utf8")],
  [COLLECTION, readFileSync(COLLECTION, "utf8")],
  [LIBRARY, readFileSync(LIBRARY, "utf8")],
  [DELTA, readFileSync(DELTA, "utf8")],
]);
const sharedSource = readFileSync(SHARED, "utf8");

let mutation = "正测（源码原样，未做替换）";
if (revertMode) {
  const before = sources.get(COLLECTION);
  const after = before.replace(NEW_CATCH_RE, ORIGINAL_CATCH);
  sources.set(COLLECTION, after);
  mutation =
    after === before
      ? "反测替换未生效（未找到催收调用点）"
      : "反测（已把催收调用点改回 err.message 原文）";
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

/* ── ① 静态：共享实现存在 + 四处引用 + 本地副本已删 ── */
let sharedImpl = null;
check("共享实现存在且导出四项（常量 + 两个判定 + rowErrorMessage）", () => {
  assert(sharedSource.includes("export const BARCODE_DUPLICATE_MESSAGE"), "缺少 BARCODE_DUPLICATE_MESSAGE");
  assert(sharedSource.includes("export function isDuplicateEntryError"), "缺少 isDuplicateEntryError");
  assert(sharedSource.includes("export function isBarcodeDuplicateError"), "缺少 isBarcodeDuplicateError");
  assert(sharedSource.includes("export function rowErrorMessage"), "缺少 rowErrorMessage");
  return `backend/src/shared/db-error-message.ts（${sharedSource.split("\n").length} 行）`;
});

for (const [label, file] of [
  ["data-transfer.service.ts", TRANSFER],
  ["credit-collection.service.ts", COLLECTION],
  ["library.service.ts", LIBRARY],
  ["delta-sync.service.ts", DELTA],
]) {
  check(`四处引用 ①：${label} 引共享实现（import + 调用 rowErrorMessage）`, () => {
    const src = sources.get(file);
    assert(src.includes('"../../shared/db-error-message"'), "未 import 共享实现");
    assert(src.includes("rowErrorMessage("), "未调用 rowErrorMessage");
    return "import + 调用齐";
  });
  check(`四处引用 ②：${label} 无本地重复实现（ER_DUP_ENTRY 字面量 = 0）`, () => {
    const src = sources.get(file);
    const hits = (src.match(/ER_DUP_ENTRY/g) || []).length;
    assert(hits === 0, `仍有 ${hits} 处 ER_DUP_ENTRY 字面量（本地副本未清除）`);
    return "0 处";
  });
}

check("S3-154 本地副本已删除（常量/两个判定/文案函数均不在 data-transfer）", () => {
  const src = sources.get(TRANSFER);
  for (const token of [
    "function isDuplicateEntryError",
    "function isBarcodeDuplicateError",
    "function productImportRowErrorMessage",
    "const SKU_CODE_DUPLICATE_MESSAGE",
  ]) {
    assert(!src.includes(token), `仍存在本地副本：${token}`);
  }
  assert(src.includes("BARCODE_DUPLICATE_MESSAGE"), "未引用共享条码常量");
  assert(src.includes('dupMessage: "商品编码重复，请检查后重试"'), "商品编码文案语义被改动（应原样保留）");
  return "本地副本 0 处，文案语义原样保留";
});

for (const [label, file] of [
  ["催收批量提醒", COLLECTION],
  ["商品库批量导入", LIBRARY],
  ["离线销售单提交", DELTA],
]) {
  check(`本单改口：${label} 不再直接回 err.message 原文`, () => {
    const src = sources.get(file);
    assert(
      !src.includes("err instanceof Error ? err.message : String(err)"),
      `仍有逐行 catch 直接回 err.message 原文：${label}`,
    );
    return "无 err.message 原文写法";
  });
}

/* ── ② 行为：原样提取共享实现并转译（进程内，不 spawn） ── */
check("从生产源码提取共享实现并转译成功", () => {
  const start = sharedSource.indexOf("export const BARCODE_DUPLICATE_MESSAGE");
  assert(start >= 0, "未找到共享实现起点");
  const extracted = sharedSource.slice(start);
  const js = ts.transpileModule(extracted, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  // 提取块带 `export` 关键字，CJS 转译产物写 `exports.*` ⇒ 给 Function 一个本地 exports 对象
  const factory = new Function("exports", `${js}\nreturn exports;`);
  const mod = {};
  sharedImpl = factory(mod);
  assert(typeof sharedImpl.rowErrorMessage === "function", "提取出的 rowErrorMessage 不是函数");
  return `提取 ${extracted.split("\n").length} 行并转译成功`;
});

const barcodeDup = Object.assign(
  new Error("Duplicate entry '6901234567890' for key 'uk_product_sku_tenant_barcode'"),
  { code: "ER_DUP_ENTRY", errno: 1062 },
);
const codeDup = Object.assign(new Error("Duplicate entry 'SKU001' for key 'uk_product_sku_code'"), { errno: 1062 });
const fkErr = Object.assign(new Error("Cannot add or update a child row"), {
  code: "ER_NO_REFERENCED_ROW_2",
  errno: 1452,
});
const otherErr = new Error("Data too long for column 'sku_name' at row 1");

check("只认 1062：code / errno 两种形态都判；1452 与纯文本 Duplicate entry 不判", () => {
  assert(sharedImpl.isDuplicateEntryError(barcodeDup) === true, "code=ER_DUP_ENTRY 未判真");
  assert(sharedImpl.isDuplicateEntryError(codeDup) === true, "errno=1062 未判真");
  assert(sharedImpl.isDuplicateEntryError(fkErr) === false, "1452 被误判为撞键");
  assert(sharedImpl.isDuplicateEntryError(new Error("Duplicate entry 'x' for key 'uk_barcode'")) === false, "仅靠文本判真（越界）");
  return "code/errno ⇒ true；1452/纯文本 ⇒ false";
});

check("条码列 / 非条码列 区分", () => {
  assert(sharedImpl.isBarcodeDuplicateError(barcodeDup) === true, "barcode 键未判真");
  assert(sharedImpl.isBarcodeDuplicateError(codeDup) === false, "商品编码键被误判为条码");
  return "barcode ⇒ true；uk_product_sku_code ⇒ false";
});

check("撞条码 ⇒ 统一中文业务文案（不含 Duplicate entry）", () => {
  const got = sharedImpl.rowErrorMessage(barcodeDup, { dupMessage: "商品编码重复，请检查后重试" });
  assert(got === "该条码已被其他商品使用", `实际：${got}`);
  assert(!got.includes("Duplicate entry"), `文案仍含库报错原文：${got}`);
  return got;
});

check("撞其它唯一键 ⇒ 调用方给的领域化中文文案", () => {
  const got = sharedImpl.rowErrorMessage(codeDup, { dupMessage: "该单据号已存在，请勿重复提交" });
  assert(got === "该单据号已存在，请勿重复提交", `实际：${got}`);
  return got;
});

check("非撞键错误 ⇒ 保留原始信息（不误吞、不掩盖）", () => {
  const got = sharedImpl.rowErrorMessage(otherErr, { dupMessage: "x" });
  assert(got === otherErr.message, `实际：${got}`);
  return got;
});

check("非 Error / 非字符串入参 ⇒ 兜底文案（缺省「处理失败」，可覆盖）", () => {
  assert(sharedImpl.rowErrorMessage(undefined, { dupMessage: "x" }) === "处理失败", "缺省兜底不是「处理失败」");
  assert(sharedImpl.rowErrorMessage(undefined, { dupMessage: "x", fallback: "导入失败" }) === "导入失败", "fallback 未生效");
  assert(sharedImpl.rowErrorMessage("db down", { dupMessage: "x" }) === "db down", "字符串抛出错未原样返回");
  return "undefined ⇒ 兜底；字符串 ⇒ 原文";
});

/* ── ③ 单测文件已落地同口径用例（CI 会真跑） ── */
check("单测已落地：共享实现 + 三处调用点（撞键中文 / 非撞键原文）", () => {
  const sharedTest = readFileSync(path.join(REPO, "backend", "src", "__tests__", "shared", "db-error-message.test.ts"), "utf8");
  assert(sharedTest.includes("isDuplicateEntryError"), "共享实现单测缺失 1062 判定用例");
  assert(sharedTest.includes("处理失败"), "共享实现单测缺失非 Error 兜底用例");
  const collectionTest = readFileSync(path.join(REPO, "backend", "src", "__tests__", "services", "admin", "credit-collection.test.ts"), "utf8");
  assert(collectionTest.includes("该客户存在重复的催收记录"), "催收单测缺少中文文案断言");
  assert(collectionTest.includes('not.toContain("Duplicate entry")'), "催收单测缺少『不含 Duplicate entry』断言");
  const libraryTest = readFileSync(path.join(REPO, "backend", "src", "__tests__", "services", "platform", "library.service.test.ts"), "utf8");
  assert(libraryTest.includes("商品库中已存在相同编码或同名同品牌同规格的商品"), "商品库单测缺少中文文案断言");
  assert(libraryTest.includes("该条码已被其他商品使用"), "商品库单测缺少条码文案断言");
  const deltaTest = readFileSync(path.join(REPO, "backend", "src", "__tests__", "services", "sync", "delta-sync.service.test.ts"), "utf8");
  assert(deltaTest.includes("该单据号已存在，请勿重复提交"), "离线单单测缺少中文文案断言");
  return "4 个测试文件命中";
});

/* ── ④ `--run-service`：真跑三个生产函数（Node 类型剥离 + loader 桩 db） ── */
if (runService) {
  const { registerHooks } = await import("node:module");
  const { pathToFileURL } = await import("node:url");

  const stub = {
    query: async () => [],
    queryOne: async () => null,
    queryWithTenant: async () => [],
    queryOneWithTenant: async () => null,
    transaction: async () => {
      throw new Error("S3-155 装置未桩 transaction");
    },
    connExecute: async () => [{}],
  };
  globalThis.__s3155 = stub;

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.endsWith("/shared/db")) return { url: "s3155:db", shortCircuit: true };
      if (specifier.endsWith("/shared/logger")) return { url: "s3155:logger", shortCircuit: true };
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
      if (url === "s3155:db") {
        return {
          format: "module",
          shortCircuit: true,
          source: [
            "export const query = (...a) => globalThis.__s3155.query(...a);",
            "export const queryOne = (...a) => globalThis.__s3155.queryOne(...a);",
            "export const queryWithTenant = (...a) => globalThis.__s3155.queryWithTenant(...a);",
            "export const queryOneWithTenant = (...a) => globalThis.__s3155.queryOneWithTenant(...a);",
            "export const transaction = (...a) => globalThis.__s3155.transaction(...a);",
            "export const connExecute = (...a) => globalThis.__s3155.connExecute(...a);",
          ].join("\n"),
        };
      }
      if (url === "s3155:logger") {
        return {
          format: "module",
          shortCircuit: true,
          source: "const noop = () => {};\nexport default { info: noop, warn: noop, error: noop, debug: noop };",
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

  const collectionSvc = await import(pathToFileURL(COLLECTION).href);
  const librarySvc = await import(pathToFileURL(LIBRARY).href);
  const deltaSvc = await import(pathToFileURL(DELTA).href);
  const ctx = { tenantId: "t1", userId: 1, username: "admin" };

  /* 催收批量提醒 */
  const runCollection = async (throwErr) => {
    stub.queryOneWithTenant = async () => ({ id: 1, name: "张三", mobile: "13800000001", credit_used: 5000 });
    stub.queryWithTenant = async () => {
      throw throwErr;
    };
    return collectionSvc.batchRemind(
      { customerIds: [1], method: "SMS", content: "请尽快还款", collectionLevel: "REMIND" },
      ctx,
    );
  };
  const collectionDupRes = await runCollection(
    Object.assign(new Error("Duplicate entry '1-2026-10-03' for key 'uk_collection_record_daily'"), {
      code: "ER_DUP_ENTRY",
      errno: 1062,
    }),
  );
  check("真函数（loader 桩 db）：催收撞唯一键 ⇒ 领域化中文、无 Duplicate entry", () => {
    assert(
      collectionDupRes.errors?.[0] === "客户1处理失败: 该客户存在重复的催收记录",
      `实际 errors=${JSON.stringify(collectionDupRes.errors)}`,
    );
    assert(!JSON.stringify(collectionDupRes.errors).includes("Duplicate entry"), "仍含库报错原文");
    return collectionDupRes.errors[0];
  });
  const collectionOtherRes = await runCollection(new Error("Data too long for column 'collection_content' at row 1"));
  check("真函数（loader 桩 db）：催收非撞键错误保留原文", () => {
    assert(
      collectionOtherRes.errors?.[0] === "客户1处理失败: Data too long for column 'collection_content' at row 1",
      `实际 errors=${JSON.stringify(collectionOtherRes.errors)}`,
    );
    return collectionOtherRes.errors[0];
  });

  /* 商品库批量导入 */
  const runLibrary = async (throwErr) => {
    stub.transaction = async () => {
      throw throwErr;
    };
    return librarySvc.libraryService.importSpus([{ name: "五粮液 52度 500ml", specs: "500ml" }]);
  };
  const libraryDupRes = await runLibrary(
    Object.assign(new Error("Duplicate entry '五粮液 52度 500ml-1-500ml' for key 'uk_name_brand_specs'"), {
      code: "ER_DUP_ENTRY",
      errno: 1062,
    }),
  );
  check("真函数（loader 桩 db）：商品库撞唯一键 ⇒ 领域化中文、无 Duplicate entry", () => {
    assert(
      libraryDupRes.errors?.[0]?.reason === "商品库中已存在相同编码或同名同品牌同规格的商品",
      `实际 errors=${JSON.stringify(libraryDupRes.errors)}`,
    );
    assert(!JSON.stringify(libraryDupRes.errors).includes("Duplicate entry"), "仍含库报错原文");
    return libraryDupRes.errors[0].reason;
  });
  const libraryBarcodeRes = await runLibrary(
    Object.assign(new Error("Duplicate entry '6901234567890' for key 'uk_barcode'"), {
      code: "ER_DUP_ENTRY",
      errno: 1062,
    }),
  );
  check("真函数（loader 桩 db）：商品库撞条码键 ⇒ 统一条码文案", () => {
    assert(
      libraryBarcodeRes.errors?.[0]?.reason === "该条码已被其他商品使用",
      `实际 errors=${JSON.stringify(libraryBarcodeRes.errors)}`,
    );
    return libraryBarcodeRes.errors[0].reason;
  });
  const libraryOtherRes = await runLibrary(new Error("Connection lost: The server closed the connection"));
  check("真函数（loader 桩 db）：商品库非撞键错误保留原文", () => {
    assert(
      libraryOtherRes.errors?.[0]?.reason === "Connection lost: The server closed the connection",
      `实际 errors=${JSON.stringify(libraryOtherRes.errors)}`,
    );
    return libraryOtherRes.errors[0].reason;
  });

  /* 离线销售单提交 */
  const runDelta = async (throwErr) => {
    stub.queryOneWithTenant = async () => null;  // 预查重未命中（并发窗口）
    stub.transaction = async () => {
      throw throwErr;
    };
    return deltaSvc.submitOfflineOrders(
      [{ draftNo: "DRAFT-DUP", items: [{ skuId: 1, skuName: "示例", boxQty: 1, bottleQty: 0, totalBottleQty: 1, unitPrice: 100, subtotalAmount: 100 }], totalAmount: 100, createdAt: "2026-07-19T10:00:00Z" }],
      "tenant-a",
      1,
    );
  };
  const deltaDupRes = await runDelta(
    Object.assign(new Error("Duplicate entry 'DRAFT-DUP' for key 'uk_sale_bill_no'"), {
      code: "ER_DUP_ENTRY",
      errno: 1062,
    }),
  );
  check("真函数（loader 桩 db）：离线单撞销售单号唯一键 ⇒ 领域化中文、无 Duplicate entry", () => {
    assert(deltaDupRes.results?.[0]?.errorMsg === "该单据号已存在，请勿重复提交", `实际结果=${JSON.stringify(deltaDupRes.results)}`);
    assert(!JSON.stringify(deltaDupRes.results).includes("Duplicate entry"), "仍含库报错原文");
    return deltaDupRes.results[0].errorMsg;
  });
  const deltaOtherRes = await runDelta(new Error("Lock wait timeout exceeded"));
  check("真函数（loader 桩 db）：离线单非撞键错误保留原文", () => {
    assert(deltaOtherRes.results?.[0]?.errorMsg === "Lock wait timeout exceeded", `实际结果=${JSON.stringify(deltaOtherRes.results)}`);
    return deltaOtherRes.results[0].errorMsg;
  });
}

/* ── 输出 ── */
console.log(`# S3-155 静态同口径断言 —— ${mutation}`);
console.log("# 被测文件：backend/src/shared/db-error-message.ts + 三处调用点 + data-transfer.service.ts");
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `   ← ${r.detail}` : ""}`);
}
const failed = results.filter((r) => !r.ok);
const passed = results.length - failed.length;
console.log(`小结[s3-155]：${passed} passed / ${failed.length} failed`);

if (revertMode) {
  const expectedRed =
    failed.length >= 1 && results.some((r) => !r.ok && r.name.includes("催收批量提醒"));
  console.log(
    expectedRed
      ? "反测成立：改回 err.message 原文后，目标断言确实变红（上面 FAIL 即原始红输出）"
      : "反测未成立：改回原文后断言没有变红 ⇒ 该断言无分辨力",
  );
  process.exit(expectedRed ? 0 : 1);
}
process.exit(failed.length === 0 ? 0 : 1);
