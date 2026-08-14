import { describe, it, expect, vi } from "vitest";
import { asyncHandler } from "../../shared/async-handler";

describe("async-handler", () => {
  it("成功的 Promise 应正常调用 handler", async () => {
    const mockReq = {};
    const mockRes = {};
    const mockNext = vi.fn();
    const handler = vi.fn().mockResolvedValue("ok");

    const wrapped = asyncHandler(handler);
    await wrapped(mockReq, mockRes, mockNext);

    expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
  });

  it("rejected Promise 应将错误传递给 next", async () => {
    const mockReq = {};
    const mockRes = {};
    const mockNext = vi.fn();
    const error = new Error("异步错误");
    const handler = vi.fn().mockRejectedValue(error);

    const wrapped = asyncHandler(handler);
    await wrapped(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it("handler 返回 rejected Promise 应将错误传递给 next", async () => {
    const mockNext = vi.fn();
    const error = new Error("异步错误");
    const handler = () => Promise.reject(error);

    const wrapped = asyncHandler(handler);
    await wrapped({}, {}, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it("返回非 Promise 值也应正常工作", async () => {
    const mockNext = vi.fn();
    const handler = vi.fn().mockReturnValue("value");

    const wrapped = asyncHandler(handler);
    await wrapped({}, {}, mockNext);

    expect(handler).toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("next 不应被成功场景调用", async () => {
    const mockNext = vi.fn();
    const handler = vi.fn().mockResolvedValue(undefined);

    const wrapped = asyncHandler(handler);
    await wrapped({}, {}, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
  });
});
