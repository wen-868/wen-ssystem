import { describe, it, expect } from "vitest";
import { makeBizNo, makeToken } from "../../shared/id";

describe("makeBizNo", () => {
  it("应返回以指定前缀开头的字符串", () => {
    const result = makeBizNo("SO");
    expect(result.startsWith("SO")).toBe(true);
  });

  it("生成的编号长度应大于前缀长度", () => {
    const result = makeBizNo("PO");
    expect(result.length).toBeGreaterThan("PO".length);
  });

  it("应包含时间戳部分（纯数字）", () => {
    const result = makeBizNo("SO");
    // 格式: PREFIX + 日期8位 + 5位随机数字（统一规则：XS2026081211515）
    const afterPrefix = result.slice(2);
    expect(/^\d{13}$/.test(afterPrefix)).toBe(true);
  });

  it("不同前缀应生成不同编号", () => {
    const a = makeBizNo("SO");
    const b = makeBizNo("PO");
    expect(a).not.toBe(b);
    expect(a.startsWith("SO")).toBe(true);
    expect(b.startsWith("PO")).toBe(true);
  });

  it("空字符串前缀也应能正常生成", () => {
    const result = makeBizNo("");
    expect(result.length).toBeGreaterThanOrEqual(13);
  });
});

describe("makeToken", () => {
  it("应返回十六进制字符串", () => {
    const token = makeToken();
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("长度应为 48 位（24 字节）", () => {
    const token = makeToken();
    expect(token.length).toBe(48);
  });

  it("每次调用应生成不同的 token", () => {
    const t1 = makeToken();
    const t2 = makeToken();
    expect(t1).not.toBe(t2);
  });

  it("连续生成 100 个 token 应全部唯一", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) {
      set.add(makeToken());
    }
    expect(set.size).toBe(100);
  });
});

describe("makeBizNo 补充用例", () => {
  it("长前缀也应正常工作", () => {
    const result = makeBizNo("TRACE");
    expect(result.startsWith("TRACE")).toBe(true);
    expect(result.length).toBe("TRACE".length + 13);
  });

  it("生成的编号后缀应为 5 位数字", () => {
    const result = makeBizNo("SO");
    const numPart = result.slice(2 + 8);
    expect(/^\d{5}$/.test(numPart)).toBe(true);
  });
});
