/**
 * S3-119（P2 门禁）：测试内**自建 express app** 且挂**真实鉴权**的用例，必须内联限流器
 *
 * 背景（已取证）：CodeQL 的 `js/missing-rate-limiting` 要求"做鉴权的 route handler 必须有限流"。
 * `backend/src/__tests__/routes/*.test.ts` 里有一类用例会自建 express app 并挂**真实** `requirePlatformAuth`
 * 来测鉴权/路由；这类 app 原先没有限流器 ⇒ **每新增一个这样的测试文件，就必然新增 1 条 high 告警**。
 *
 * 本门禁守两件事：
 *  ① 凡"自建 app（源码含 `express()`）+ 在 `.use(...)` 挂载点传入 `requirePlatformAuth`"的测试文件，
 *     **剥注释后**的源码里必须出现**真实调用形态** `.use(rateLimit(`——S3-112 的核心结论：包成 helper
 *     再调用，CodeQL 看不见；S3-119-F1 的结论：只判"整文件子串 `rateLimit(`"，一句注释就能满足；
 *  ② 被检查文件数 ≥ 1——防止遍历路径/过滤条件写错导致 0 文件却"通过"（与 S3-49 的假门禁同族）。
 *
 * 反测（本卡验收标准③）：① **留注释、删掉真实调用**（`guardedApp.use(rateLimit({...}))` ⇒ `guardedApp.use({...})`，
 *                          注释里的 `rateLimit(` 仍在）⇒ 本条变红并指名该文件；
 *                        ② 把 `listRouteTestFiles()` 的过滤条件改成必然匹配 0 个文件 ⇒ 第 1 条变红。
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** 被测目录：backend/src/__tests__/routes/ */
const ROUTES_TEST_DIR = fileURLToPath(new URL("../routes", import.meta.url));

/** 与 CodeQL 的目标对象对齐：文件内**自建** express app */
const BUILDS_OWN_APP = /express\(\)/;
/** 与 CodeQL 的目标对象对齐：在挂载点上传入**真实鉴权**中间件 */
const MOUNTS_AUTH = /\.(use|all|get|post|put|patch|delete)\s*\([^)]*requirePlatformAuth/;
/**
 * 限流必须落在**真实调用形态**上：剥注释后出现 `.use(` + `rateLimit(`。
 * 不得只存在于被调用的 helper 内部（S3-112）；也不得只存在于注释里（S3-119-F1：
 * 旧判据 `source.includes("rateLimit(")` 被注释即可满足，导致"去调用"也照样通过）。
 */
const HAS_INLINE_RATE_LIMIT = /\.use\(\s*rateLimit\(/;

/** 剥注释：删掉整块块注释与行内 `//` 注释；字符串字面量原样保留（其内的 `//` 不得误删真实调用） */
function stripComments(source: string): string {
  return source.replace(
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(["'`])(?:\\.|(?!\2)[^\\\n])*\2/g,
    (match, comment) => (comment === undefined ? match : "")
  );
}

/** 遍历被测目录下的全部 *.test.ts（单一入口，反测②改这里即可） */
function listRouteTestFiles(): string[] {
  return readdirSync(ROUTES_TEST_DIR)
    .filter((name) => name.endsWith(".test.ts"))
    .sort();
}

function readRouteTestSource(fileName: string): string {
  return readFileSync(fileURLToPath(new URL(`../routes/${fileName}`, import.meta.url)), "utf8");
}

const routeTestFiles = listRouteTestFiles();
/** 需要内联限流的文件：自建 app 且挂真实 requirePlatformAuth */
const guardedRouteTestFiles = routeTestFiles.filter((fileName) => {
  const source = readRouteTestSource(fileName);
  return BUILDS_OWN_APP.test(source) && MOUNTS_AUTH.test(source);
});

describe("S3-119 · 测试内自建 app 必须内联限流（CodeQL js/missing-rate-limiting 防回归）", () => {
  it("被检查文件数 ≥ 1（防遍历路径/过滤条件写错导致空转）", () => {
    expect(
      guardedRouteTestFiles.length,
      `在 ${ROUTES_TEST_DIR} 下未找到"自建 app + 挂 requirePlatformAuth"的测试文件；` +
        `本次共遍历到 ${routeTestFiles.length} 个 *.test.ts —— 先怀疑遍历路径或过滤条件写错，而不是"没有这类文件"`
    ).toBeGreaterThanOrEqual(1);
  });

  it("每个「自建 app + 挂 requirePlatformAuth」的测试文件，剥注释后必须含内联 `.use(rateLimit(`", () => {
    const offenders = guardedRouteTestFiles.filter(
      (fileName) => !HAS_INLINE_RATE_LIMIT.test(stripComments(readRouteTestSource(fileName)))
    );

    expect(
      offenders,
      "以下测试文件自建 express app 并挂 requirePlatformAuth，但剥注释后的源码里没有内联 `.use(rateLimit(` 调用形态" +
        "（CodeQL `js/missing-rate-limiting` 会据此报高优告警）：\n" +
        offenders.map((fileName) => `- backend/src/__tests__/routes/${fileName}`).join("\n")
    ).toEqual([]);
  });
});
