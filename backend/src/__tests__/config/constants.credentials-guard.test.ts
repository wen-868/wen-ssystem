/**
 * 演示凭据守卫测试（MS-SECURITY-BASELINE-01，SEC-1622 判定配套）
 *
 * 判定：`constants.DEMO_PASSWORD` 是业主 2026-10-15 口径（S3-175/S3-203）定案的
 * **刻意公开的演示口令**（登录页「一键演示」入口），不是泄露的真实凭据；
 * 轮换/移除属业务口径变更，须业主决策，本卡按误报登记豁免。
 *
 * 本守卫锁定「代码侧唯一事实来源」的值：若有人把其它真实凭据回填进本常量
 * （或擅自改动演示口径），此处立即点名变红，防止凭据静默漂移。
 */
import { describe, it, expect } from "vitest";
import { constants } from "../../config/constants";

describe("constants 演示凭据守卫（MS-SECURITY-BASELINE-01）", () => {
  it("DEMO_USERNAME / DEMO_PASSWORD 必须保持业主定案的演示口径", () => {
    expect(constants.DEMO_USERNAME).toBe("admin");
    expect(constants.DEMO_PASSWORD).toBe("admin@2026");
  });

  it("演示口令不得回落为弱默认（如 123456/password/admin）", () => {
    const weak = new Set(["123456", "password", "admin", "admin123", "12345678"]);
    expect(weak.has(constants.DEMO_PASSWORD)).toBe(false);
  });
});
