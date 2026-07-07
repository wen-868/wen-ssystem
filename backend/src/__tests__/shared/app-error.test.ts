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

  it("应支持 500 状态码", () => {
    const err = new AppError("服务器内部错误", 500);
    expect(err.statusCode).toBe(500);
  });

  it("应支持 401 状态码", () => {
    const err = new AppError("未授权", 401);
    expect(err.statusCode).toBe(401);
  });

  it("空字符串消息也应正常创建", () => {
    const err = new AppError("");
    expect(err.message).toBe("");
    expect(err.statusCode).toBe(400);
  });

  it("两个 AppError 实例应各自独立", () => {
    const err1 = new AppError("错误1", 400);
    const err2 = new AppError("错误2", 404);
    expect(err1.message).not.toBe(err2.message);
    expect(err1.statusCode).not.toBe(err2.statusCode);
  });

  it("throw 后应能通过 instanceof 区分 AppError 和普通 Error", () => {
    try {
      throw new AppError("业务错误");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toBeInstanceOf(Error);
      expect((e as AppError).name).toBe("AppError");
    }
  });
});