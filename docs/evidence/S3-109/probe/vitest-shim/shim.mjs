/**
 * vitest API 兼容 shim（仅覆盖本测试文件用到的 describe / it / expect 子集）。
 *
 * 存在原因：本沙箱内 `node` 被禁止创建子进程（`spawn EPERM`），vitest 启动即失败
 * （见 out-vitest-blocked.txt，与 docs/evidence/B-2b/b2b-output-vitest-blocked.txt 同因）。
 * 为了让「真实测试文件」在本沙箱内可复跑，用本 shim 顶替 vitest 模块，
 * 由 node 原生 TS 支持直接执行同一份 *.test.ts，语义与 vitest 对齐（用例全过/失败计数 + 退出码）。
 */
const results = [];
let currentSuite = "";

function record(name, ok, err) {
  results.push({ name: `${currentSuite} > ${name}`, ok, err });
  console.log(`${ok ? " ✓" : " ✗"} ${name}`);
  if (!ok) console.log(`    ${err}`);
}

export function describe(name, fn) {
  currentSuite = name;
  fn();
  currentSuite = "";
}

export function it(name, fn) {
  try {
    fn();
    record(name, true);
  } catch (e) {
    record(name, false, e && e.message);
  }
}

function fail(message) {
  throw new Error(`expect 断言失败：${message}`);
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) fail(`期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
    },
    toContain(expected) {
      if (typeof actual !== "string" || !actual.includes(expected)) fail(`期望包含 ${JSON.stringify(expected)}`);
    },
    toMatch(re) {
      if (!re.test(String(actual))) fail(`期望匹配 ${re}，实际 ${JSON.stringify(actual)}`);
    },
    toBeGreaterThanOrEqual(n) {
      if (!(actual >= n)) fail(`期望 >= ${n}，实际 ${actual}`);
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
    },
  };
}

export default { describe, it, expect };

process.on("exit", () => {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log("");
  console.log(` Test Files  ${failed === 0 ? "1 passed" : "1 failed"} (1)`);
  console.log(`      Tests  ${passed} passed${failed ? `, ${failed} failed` : ""} (${results.length})`);
  if (failed > 0) process.exitCode = 1;
});
