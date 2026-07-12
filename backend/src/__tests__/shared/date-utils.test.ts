import { describe, it, expect } from "vitest";
import { parseDateParam, getDefaultDateStart, getDefaultDateEnd } from "../../shared/date-utils";
import { ZodError } from "zod";

describe("date-utils", () => {
  describe("parseDateParam", () => {
    it("合法 YYYY-MM-DD 格式应原样返回", () => {
      expect(parseDateParam("2026-07-07")).toBe("2026-07-07");
    });

    it("应支持 fallback 默认值", () => {
      expect(parseDateParam("", "2026-01-01")).toBe("2026-01-01");
    });

    it("value 为 null 时使用 fallback", () => {
      expect(parseDateParam(null, "2026-01-01")).toBe("2026-01-01");
    });

    it("value 为 undefined 时使用 fallback", () => {
      expect(parseDateParam(undefined, "2026-01-01")).toBe("2026-01-01");
    });

    it("空字符串且无 fallback 时抛出 ZodError", () => {
      expect(() => parseDateParam("")).toThrow(ZodError);
    });

    it("非法格式应抛出 ZodError", () => {
      expect(() => parseDateParam("2026/07/07")).toThrow(ZodError);
    });

    it("缺少日期部分应抛出 ZodError", () => {
      expect(() => parseDateParam("2026-07")).toThrow(ZodError);
    });

    it("包含时间部分应抛出 ZodError", () => {
      expect(() => parseDateParam("2026-07-07 12:00")).toThrow(ZodError);
    });

    it("数字传入应尝试转换，不合法则抛出", () => {
      expect(() => parseDateParam(12345)).toThrow(ZodError);
    });
  });

  describe("getDefaultDateStart", () => {
    it("默认返回 30 天前的日期", () => {
      const result = getDefaultDateStart();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const diff = Math.round((Date.now() - new Date(result).getTime()) / (1000 * 60 * 60 * 24));
      expect(diff).toBeGreaterThanOrEqual(29);
      expect(diff).toBeLessThanOrEqual(31);
    });

    it("自定义 daysAgo=7", () => {
      const result = getDefaultDateStart(7);
      const diff = Math.round((Date.now() - new Date(result).getTime()) / (1000 * 60 * 60 * 24));
      expect(diff).toBeGreaterThanOrEqual(6);
      expect(diff).toBeLessThanOrEqual(8);
    });

    it("daysAgo=0 应返回今天", () => {
      const result = getDefaultDateStart(0);
      const today = new Date().toISOString().slice(0, 10);
      expect(result).toBe(today);
    });
  });

  describe("getDefaultDateEnd", () => {
    it("应返回今天的日期字符串", () => {
      const result = getDefaultDateEnd();
      const today = new Date().toISOString().slice(0, 10);
      expect(result).toBe(today);
    });

    it("格式应为 YYYY-MM-DD", () => {
      expect(getDefaultDateEnd()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
