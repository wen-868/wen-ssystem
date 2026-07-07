import { describe, it, expect, vi, afterEach } from "vitest";
import logger from "../../shared/logger.js";

describe("logger", () => {
  it("应导出 info/warn/error/debug 四个方法", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("info 调用不抛出异常", () => {
    expect(() => logger.info("测试消息")).not.toThrow();
  });

  it("error 调用不抛出异常", () => {
    expect(() => logger.error("错误消息")).not.toThrow();
  });

  it("warn 调用不抛出异常", () => {
    expect(() => logger.warn("警告消息")).not.toThrow();
  });

  it("debug 调用不抛出异常", () => {
    expect(() => logger.debug("调试消息")).not.toThrow();
  });

  it("info 带多个非 Error 参数应走 else 分支", () => {
    expect(() => logger.info("消息", "arg1", "arg2")).not.toThrow();
  });

  it("error 带 Error 参数应走 instanceof 分支", () => {
    expect(() => logger.error("错误", new Error("err"))).not.toThrow();
  });

  it("error 带多个非 Error 参数应走 else 分支", () => {
    expect(() => logger.error("错误", "a", "b")).not.toThrow();
  });

  it("warn 带 Error 参数应走 instanceof 分支", () => {
    expect(() => logger.warn("警告", new Error("warn-err"))).not.toThrow();
  });

  it("warn 带多个非 Error 参数应走 else 分支", () => {
    expect(() => logger.warn("警告", "x", "y")).not.toThrow();
  });

  it("debug 带 Error 参数应走 instanceof 分支", () => {
    expect(() => logger.debug("调试", new Error("debug-err"))).not.toThrow();
  });

  it("debug 带多个非 Error 参数应走 else 分支", () => {
    expect(() => logger.debug("调试", 1, 2, 3)).not.toThrow();
  });
});
