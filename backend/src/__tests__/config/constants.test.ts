import { describe, it, expect } from "vitest";
import { constants } from "../../config/constants.js";

describe("constants", () => {
  it("DEFAULT_BOX_RATIO 应为 12", () => {
    expect(constants.DEFAULT_BOX_RATIO).toBe(12);
  });

  it("MAX_EXPORT_LIMIT 应为 5000", () => {
    expect(constants.MAX_EXPORT_LIMIT).toBe(5000);
  });

  it("ALERT_THRESHOLD_DAYS 应为 5", () => {
    expect(constants.ALERT_THRESHOLD_DAYS).toBe(5);
  });

  it("DEFAULT_SHELF_LIFE_DAYS 应为 365", () => {
    expect(constants.DEFAULT_SHELF_LIFE_DAYS).toBe(365);
  });

  it("DEFAULT_PAGE_SIZE 应为 20", () => {
    expect(constants.DEFAULT_PAGE_SIZE).toBe(20);
  });

  it("MAX_PAGE_SIZE 应为 100", () => {
    expect(constants.MAX_PAGE_SIZE).toBe(100);
  });

  it("AFTERSALE_DEADLINE_MS 应为 48 小时", () => {
    expect(constants.AFTERSALE_DEADLINE_MS).toBe(48 * 60 * 60 * 1000);
  });

  it("AR_AGING_GROUPS 应有 4 个账龄分组", () => {
    expect(constants.AR_AGING_GROUPS).toHaveLength(4);
  });

  it("AR_AGING_GROUPS 第一个分组应为 0-30 天", () => {
    const first = constants.AR_AGING_GROUPS[0];
    expect(first.label).toBe("0-30天");
    expect(first.min).toBe(0);
    expect(first.max).toBe(30);
  });

  it("AR_AGING_GROUPS 最后一个分组上限应为 Infinity", () => {
    const last = constants.AR_AGING_GROUPS[3];
    expect(last.max).toBe(Infinity);
  });
});