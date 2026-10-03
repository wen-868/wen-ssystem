/**
 * shared/db-error-message 单元测试（S3-155 新增）
 * 被测文件：src/shared/db-error-message.ts
 * 覆盖：只认 1062（ER_DUP_ENTRY）、条码/非条码列区分、撞键中文文案、非撞键保留原文、非 Error 兜底
 */
import { describe, it, expect } from "vitest";
import {
  BARCODE_DUPLICATE_MESSAGE,
  isDuplicateEntryError,
  isBarcodeDuplicateError,
  rowErrorMessage,
} from "../../shared/db-error-message";

/** 造一个 mysql2 撞唯一键（1062）的同形错误 */
function dup(message: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), { code: "ER_DUP_ENTRY", errno: 1062, ...extra });
}

describe("shared/db-error-message", () => {
  describe("isDuplicateEntryError —— 只认 1062", () => {
    it("code = ER_DUP_ENTRY ⇒ true", () => {
      expect(isDuplicateEntryError(dup("Duplicate entry '6901' for key 'uk_barcode'"))).toBe(true);
    });

    it("只有 errno = 1062 也判 ⇒ true", () => {
      expect(isDuplicateEntryError(Object.assign(new Error("dup"), { errno: 1062 }))).toBe(true);
    });

    it("其它 DB 错误（1452 外键 / 语法错）⇒ false，不误吞", () => {
      expect(
        isDuplicateEntryError(
          Object.assign(new Error("fk"), { code: "ER_NO_REFERENCED_ROW_2", errno: 1452 }),
        ),
      ).toBe(false);
      expect(isDuplicateEntryError(new Error("You have an error in your SQL syntax"))).toBe(false);
    });

    it("仅 message 里出现 Duplicate entry（无 code/errno）⇒ false（不能只靠文本）", () => {
      expect(isDuplicateEntryError(new Error("Duplicate entry '6901' for key 'uk_barcode'"))).toBe(false);
    });

    it("null / undefined / 字符串 ⇒ false", () => {
      expect(isDuplicateEntryError(null)).toBe(false);
      expect(isDuplicateEntryError(undefined)).toBe(false);
      expect(isDuplicateEntryError("ER_DUP_ENTRY")).toBe(false);
    });
  });

  describe("isBarcodeDuplicateError —— 条码列与其它列区分", () => {
    it("key 名含 barcode ⇒ true", () => {
      expect(
        isBarcodeDuplicateError(dup("Duplicate entry '6901' for key 'uk_product_sku_tenant_barcode'")),
      ).toBe(true);
    });

    it("key 名是商品编码列（uk_product_sku_code）⇒ false", () => {
      expect(
        isBarcodeDuplicateError(dup("Duplicate entry 'SKU001' for key 'uk_product_sku_code'")),
      ).toBe(false);
    });

    it("非撞键错误 ⇒ false", () => {
      expect(isBarcodeDuplicateError(new Error("Data too long for column 'sku_name'"))).toBe(false);
    });
  });

  describe("rowErrorMessage —— 撞键中文 / 非撞键保留原文 / 非 Error 兜底", () => {
    const options = { dupMessage: "商品编码重复，请检查后重试" };

    it("撞条码唯一键 ⇒ 统一中文业务文案（不含 Duplicate entry）", () => {
      const got = rowErrorMessage(
        dup("Duplicate entry '6901' for key 'uk_product_sku_tenant_barcode'"),
        options,
      );
      expect(got).toBe(BARCODE_DUPLICATE_MESSAGE);
      expect(got).not.toContain("Duplicate entry");
    });

    it("撞其它唯一键 ⇒ 用调用方给的领域化中文文案", () => {
      const got = rowErrorMessage(dup("Duplicate entry 'SKU001' for key 'uk_product_sku_code'"), options);
      expect(got).toBe("商品编码重复，请检查后重试");
      expect(got).not.toContain("Duplicate entry");
    });

    it("barcodeMessage 可覆盖条码文案", () => {
      const got = rowErrorMessage(dup("Duplicate entry 'x' for key 'uk_barcode'"), {
        dupMessage: "其它重复",
        barcodeMessage: "条码重复了",
      });
      expect(got).toBe("条码重复了");
    });

    it("非撞键错误 ⇒ 保留原始信息（不误吞、不掩盖）", () => {
      expect(rowErrorMessage(new Error("Data too long for column 'sku_name' at row 1"), options)).toBe(
        "Data too long for column 'sku_name' at row 1",
      );
    });

    it("字符串抛出 ⇒ 原样返回", () => {
      expect(rowErrorMessage("db down", options)).toBe("db down");
    });

    it("非 Error / 非字符串 ⇒ 兜底「处理失败」", () => {
      expect(rowErrorMessage(undefined, options)).toBe("处理失败");
      expect(rowErrorMessage(null, options)).toBe("处理失败");
      expect(rowErrorMessage({ foo: 1 }, options)).toBe("处理失败");
    });

    it("fallback 可覆盖兜底文案；Error 空 message 也走 fallback", () => {
      expect(rowErrorMessage(undefined, { dupMessage: "x", fallback: "导入失败" })).toBe("导入失败");
      expect(rowErrorMessage(new Error(""), { dupMessage: "x", fallback: "导入失败" })).toBe("导入失败");
    });
  });
});
