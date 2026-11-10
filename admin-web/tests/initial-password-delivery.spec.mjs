/**
 * MS-SECURITY-BASELINE-01F1 · B2 前端行为测试——员工一次性初始口令必须交付到操作者
 *
 * 驳回项 2：员工创建后丢弃后端返回的 initialPassword，只提示"员工已创建"，
 * 且表单残留"留空默认 123456"旧文案。
 *
 * 覆盖：
 *   A. 真实守卫逻辑（src/utils/initial-password.ts，Node 原生 TS 剥离直接加载）：
 *      响应带口令 ⇒ 返回；缺字段/空串/非字符串 ⇒ 抛错（禁止静默"创建成功"）。
 *   B. 真实视图 OrganizationView.vue 源契约：
 *      - 不再出现"留空默认 123456"及任何 "123456" 默认口令文案；
 *      - 创建分支用 extractInitialPassword(created, "initialPassword") 取口令；
 *      - 一次性交付对话框存在：完整展示 + 复制按钮 + "我已妥善保存"确认按钮；
 *      - 对话框 :show-close="false" / :close-on-click-modal="false"（确认前不可关闭）；
 *      - "员工已创建"提示只出现在确认回调 confirmInitialPasswordDelivered 中。
 * mutation ②（删除 initialPassword 交付/恢复旧文案）会使本用例变红。
 *
 * 运行（admin-web 目录）：node tests/initial-password-delivery.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const VIEW_SRC = path.join(here, "..", "src", "views", "system", "OrganizationView.vue");
const API_SRC = path.join(here, "..", "src", "api", "system.ts");

// 进程内模块钩子：api/system.ts 的相对导入 "./request"（axios 实例 + pinia store，
// 不适合在纯 Node 断言环境加载）→ 进程内桩；其余走默认解析（Node 原生 TS 剥离加载真实 .ts）。
const STUB_REQUEST = "data:text/javascript,export const api={post:async()=>({data:{data:{}}}),get:async()=>({data:{data:{}}}),put:async()=>({data:{data:{}}})};";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./request") return { url: STUB_REQUEST, shortCircuit: true, format: "module" };
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(specifier + ".ts", context);
      }
    }
    return nextResolve(specifier, context);
  },
});

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}\n        ${e.message}`);
    process.exitCode = 1;
  }
}

console.log("== A. extractInitialPassword 守卫行为（真实 TS 模块 src/api/system.ts） ==");
const { extractInitialPassword } = await import(pathToFileURL(API_SRC));

test("响应带 initialPassword ⇒ 原样返回", () => {
  assert.equal(extractInitialPassword({ initialPassword: "WZgpmRRH8yMY" }, "initialPassword"), "WZgpmRRH8yMY");
});
test("响应缺 initialPassword ⇒ 抛错（不得静默创建成功）", () => {
  assert.throws(() => extractInitialPassword({ staffId: 1 }, "initialPassword"), /未取得一次性初始口令/);
});
test("initialPassword 为空串 ⇒ 抛错", () => {
  assert.throws(() => extractInitialPassword({ initialPassword: "" }, "initialPassword"), /未取得一次性初始口令/);
});
test("initialPassword 非字符串 ⇒ 抛错", () => {
  assert.throws(() => extractInitialPassword({ initialPassword: 123456 }, "initialPassword"), /未取得一次性初始口令/);
});
test("响应为 null/undefined ⇒ 抛错", () => {
  assert.throws(() => extractInitialPassword(null, "initialPassword"), /未取得一次性初始口令/);
});

console.log("== B. OrganizationView.vue 交付链源契约 ==");
const src = readFileSync(VIEW_SRC, "utf8");

test("旧默认口令文案『留空默认 123456』已删除", () => {
  assert.ok(!src.includes("留空默认 123456"), "仍残留『留空默认 123456』");
});
test("视图不再出现任何 123456 默认口令文案", () => {
  assert.ok(!src.includes("123456"), "仍残留 123456 默认口令文案");
});
test("表单不再提交 password（旧口径下操作者可留空走默认口令）", () => {
  assert.ok(!src.includes("password: staffForm.password"), "仍在提交 staffForm.password");
});
test("创建分支用 extractInitialPassword(created, \"initialPassword\") 取口令", () => {
  assert.ok(src.includes('extractInitialPassword(created, "initialPassword")'), "未对创建响应做口令提取");
});
test("未取得口令时阻止创建成功提示", () => {
  const branchStart = src.indexOf('const created = await createStaff');
  const branchEnd = src.indexOf("initialPasswordVisible.value = true", branchStart);
  const branch = src.slice(branchStart, branchEnd);
  assert.ok(branch.includes("已阻止") || branch.includes("未取得一次性初始口令"), "未取得口令时无阻断提示");
  assert.ok(!branch.includes('ElMessage.success("员工已创建")'), "未取得口令仍显示创建成功");
});
test("一次性交付对话框存在（展示 + 复制 + 我已妥善保存）", () => {
  assert.ok(src.includes("initialPasswordValue"), "无口令展示绑定");
  assert.ok(src.includes("copyInitialPassword"), "无复制按钮处理");
  assert.ok(src.includes("我已妥善保存"), "无确认按钮");
});
test("确认前对话框不可被关闭/跳过", () => {
  assert.ok(src.includes(':close-on-click-modal="false"'), "close-on-click-modal 未禁用");
  assert.ok(src.includes(':close-on-press-escape="false"'), "close-on-press-escape 未禁用");
  assert.ok(src.includes(':show-close="false"'), "show-close 未禁用");
});
test("『员工已创建』仅在确认回调 confirmInitialPasswordDelivered 中出现", () => {
  const confirmIdx = src.indexOf("function confirmInitialPasswordDelivered");
  assert.ok(confirmIdx > -1, "确认回调不存在");
  const firstSuccess = src.indexOf('ElMessage.success("员工已创建")');
  assert.ok(firstSuccess > confirmIdx, `"员工已创建"出现在确认回调之前（index ${firstSuccess} < ${confirmIdx}）`);
  assert.ok(src.indexOf('ElMessage.success("员工已创建")', confirmIdx) > -1, "确认回调未提示创建成功");
});

console.log(`\n合计通过 ${passed} 项${process.exitCode ? "（存在失败）" : "，全部通过"}`);
