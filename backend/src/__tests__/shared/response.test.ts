import { describe, it, expect } from "vitest";
import { ok, fail } from "../../shared/response";

describe("ok", () => {
  it("应返回 code 为 0 的成功响应", () => {
    const result = ok();
    expect(result.code).toBe("0");
    expect(result.msg).toBe("成功");
  });

  it("应包含 traceId", () => {
    const result = ok();
    expect(result.traceId).toBeDefined();
    expect(typeof result.traceId).toBe("string");
  });

  it("传入数据时应将 data 附加到响应中", () => {
    const data = { id: 1, name: "测试" };
    const result = ok(data);
    expect(result.data).toEqual(data);
  });

  it("传入 null 时应保留 data 为 null", () => {
    const result = ok(null);
    expect(result.code).toBe("0");
    expect(result.data).toBeNull();
  });

  it("传入 undefined 时 data 为 undefined", () => {
    const result = ok(undefined);
    expect(result.code).toBe("0");
    expect(result.data).toBeUndefined();
  });

  it("传入数组时应正确附加", () => {
    const result = ok([1, 2, 3]);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it("传入字符串时应正确附加", () => {
    const result = ok("hello");
    expect(result.data).toBe("hello");
  });
});

describe("fail", () => {
  it("默认 code 应为 400", () => {
    const result = fail("参数错误");
    expect(result.code).toBe("400");
    expect(result.msg).toBe("参数错误");
  });

  it("应支持自定义错误码", () => {
    const result = fail("权限不足", "403");
    expect(result.code).toBe("403");
    expect(result.msg).toBe("权限不足");
  });

  it("应包含 traceId", () => {
    const result = fail("错误");
    expect(result.traceId).toBeDefined();
  });

  it("fail 和 ok 的 code 不应相同", () => {
    const f = fail("失败");
    const o = ok({ value: 1 });
    expect(f.code).not.toBe(o.code);
  });
});