import { describe, it, expect } from "vitest";
import { AppError } from "../../shared/app-error.js";

describe("AppError", () => {
  it("应创建带有默认状态码 400 的错误", () => {
    const err = new AppError("参数错误");
    expect(err.message).toBe("参数错误");
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe("AppError");
  });

  it("应支持自定义状态码", () => {
    const err = new AppError("未找到", 404);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("未找到");
  });

  it("应是 Error 的实例", () => {
    const err = new AppError("测试");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it("应支持 stack 属性", () => {
    const err = new AppError("测试");
    expect(err.stack).toBeDefined();
  });

  it("catch 块应能正确捕获", () => {
    try {
      throw new AppError("测试错误", 403);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(403);
    }
  });
});