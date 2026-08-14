import { describe, it, expect } from "vitest";
import { constants } from "../../config/constants";

describe("config/constants", () => {
  it("应导出正确的默认箱规", () => {
    expect(constants.DEFAULT_BOX_RATIO).toBe(12);
  });
  it("应导出正确的导出上限", () => {
    expect(constants.MAX_EXPORT_LIMIT).toBe(5000);
  });
  it("应导出正确的告警阈值", () => {
    expect(constants.ALERT_THRESHOLD_DAYS).toBe(5);
  });
  it("应导出正确的默认保质期", () => {
    expect(constants.DEFAULT_SHELF_LIFE_DAYS).toBe(365);
  });
  it("应导出正确的默认分页条数", () => {
    expect(constants.DEFAULT_PAGE_SIZE).toBe(20);
  });
  it("应导出正确的最大分页条数", () => {
    expect(constants.MAX_PAGE_SIZE).toBe(100);
  });
  it("应导出正确的售后截止时间", () => {
    expect(constants.AFTERSALE_DEADLINE_MS).toBe(48 * 60 * 60 * 1000);
  });
  it("应导出正确的账龄分组", () => {
    expect(constants.AR_AGING_GROUPS).toHaveLength(4);
    expect(constants.AR_AGING_GROUPS[0].label).toBe("0-30天");
    expect(constants.AR_AGING_GROUPS[3].max).toBe(Infinity);
  });
});
