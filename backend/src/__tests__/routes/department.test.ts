import { describe, it, expect } from "vitest";
import { departmentRouter } from "../../routes/department.routes";

describe("routes/department", () => {
  it("应导出 departmentRouter", () => {
    expect(departmentRouter).toBeDefined();
  });

  it("departmentRouter 应该是一个 Router 实例", () => {
    expect(typeof departmentRouter.get).toBe("function");
    expect(typeof departmentRouter.post).toBe("function");
    expect(typeof departmentRouter.put).toBe("function");
    expect(typeof departmentRouter.delete).toBe("function");
  });
});
