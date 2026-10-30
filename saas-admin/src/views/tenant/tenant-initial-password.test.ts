/**
 * B3 前端行为测试——租户创建链管理员一次性初始口令必须交付到操作者
 * （MS-SECURITY-BASELINE-01F1，驳回项 2）
 *
 * 驳回项 2：TenantForm.vue 仍要求录入"管理员密码"（后端已忽略该值并随机生成
 * adminInitialPassword），创建后直接跳转，管理员拿不到真实口令。
 *
 * 覆盖：
 *   A. 真实守卫逻辑（utils/initial-password-delivery.ts）：响应带口令 ⇒ 返回；
 *      缺字段/空串/非字符串 ⇒ 抛错（禁止静默跳转）。
 *   B. 真实视图 TenantForm.vue 源契约：
 *      - 不再有"管理员密码"输入项与 adminPassword 表单字段/必填规则；
 *      - 创建响应用 extractInitialPassword(resp?.data, "adminInitialPassword") 取口令；
 *      - 一次性交付对话框：展示 + 复制 + "我已妥善保存"；
 *      - 确认前不可关闭（:show-close="false" 等）；
 *      - "创建成功"提示与 router.push('/tenants') 仅在确认回调中，取口令失败时不跳转。
 * mutation ③（TenantForm 恢复密码输入且不展示口令）会使本用例变红。
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extractInitialPassword } from "../../api/tenant";

const here = path.dirname(fileURLToPath(import.meta.url));
const viewSrc = readFileSync(path.join(here, "TenantForm.vue"), "utf8");

describe("extractInitialPassword 守卫行为", () => {
  it("响应带 adminInitialPassword ⇒ 原样返回", () => {
    expect(extractInitialPassword({ adminInitialPassword: "YmQ38k2puNbX" }, "adminInitialPassword")).toBe(
      "YmQ38k2puNbX",
    );
  });
  it("缺字段 ⇒ 抛错（不得静默跳转）", () => {
    expect(() => extractInitialPassword({ id: "t1" }, "adminInitialPassword")).toThrow(/未取得一次性初始口令/);
  });
  it("空串 ⇒ 抛错", () => {
    expect(() => extractInitialPassword({ adminInitialPassword: "" }, "adminInitialPassword")).toThrow(
      /未取得一次性初始口令/,
    );
  });
  it("非字符串 ⇒ 抛错", () => {
    expect(() => extractInitialPassword({ adminInitialPassword: null }, "adminInitialPassword")).toThrow(
      /未取得一次性初始口令/,
    );
  });
  it("响应为 null ⇒ 抛错", () => {
    expect(() => extractInitialPassword(null, "adminInitialPassword")).toThrow(/未取得一次性初始口令/);
  });
});

describe("TenantForm.vue 交付链源契约", () => {
  it("已移除后端不采用的『管理员密码』输入与 adminPassword 字段/规则", () => {
    expect(viewSrc).not.toContain("管理员密码");
    expect(viewSrc).not.toContain("adminPassword");
    expect(viewSrc).not.toContain("密码至少6位");
  });

  it("创建响应用 extractInitialPassword(resp?.data, 'adminInitialPassword') 取口令", () => {
    expect(viewSrc).toContain("extractInitialPassword(resp?.data, 'adminInitialPassword')");
  });

  it("一次性交付对话框存在：展示 + 复制 + 我已妥善保存", () => {
    expect(viewSrc).toContain("initialPasswordValue");
    expect(viewSrc).toContain("copyInitialPassword");
    expect(viewSrc).toContain("我已妥善保存");
    expect(viewSrc).toContain("adminInitialPassword");
  });

  it("确认前对话框不可被关闭/跳过", () => {
    expect(viewSrc).toContain(':close-on-click-modal="false"');
    expect(viewSrc).toContain(':close-on-press-escape="false"');
    expect(viewSrc).toContain(':show-close="false"');
  });

  it("取口令失败时不显示创建成功、不跳转", () => {
    const branchStart = viewSrc.indexOf("const resp: any = await createTenantApi");
    const branchEnd = viewSrc.indexOf("initialPasswordVisible.value = true", branchStart);
    const branch = viewSrc.slice(branchStart, branchEnd);
    expect(branch).toContain("已阻止");
    expect(branch).not.toContain("ElMessage.success('创建成功')");
    expect(branch).not.toContain("router.push('/tenants')");
  });

  it("『创建成功』与跳转仅在确认回调 confirmInitialPasswordDelivered 中", () => {
    const confirmIdx = viewSrc.indexOf("function confirmInitialPasswordDelivered");
    expect(confirmIdx).toBeGreaterThan(-1);
    const successIdx = viewSrc.indexOf("ElMessage.success('创建成功')");
    const pushIdx = viewSrc.indexOf("router.push('/tenants')");
    expect(successIdx).toBeGreaterThan(confirmIdx);
    expect(pushIdx).toBeGreaterThan(confirmIdx);
  });
});
