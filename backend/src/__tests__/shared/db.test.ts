import { describe, it, expect, vi, beforeEach } from "vitest";

// 仅模拟 config/database 的副作用（避免真实连接池），connExecute/connQuery/connQueryOne 为 db.ts 内真实定义
vi.mock("../../config/database", () => ({
  pool: {},
  query: vi.fn(),
  transaction: vi.fn(),
}));

import { connExecute, connQuery, connQueryOne } from "../../shared/db";

describe("shared/db - connExecute / connQuery / connQueryOne", () => {
  let fakeConn: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeConn = { execute: vi.fn() };
  });

  it("connQuery 返回 execute 首元素（rows 数组）", async () => {
    fakeConn.execute.mockResolvedValue([[{ id: 1 }, { id: 2 }], undefined]);
    const rows = await connQuery(fakeConn, "SELECT 1");
    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fakeConn.execute).toHaveBeenCalledWith("SELECT 1", []);
  });

  it("connQueryOne 返回首行；空结果返回 null", async () => {
    fakeConn.execute.mockResolvedValue([[{ id: 1 }], undefined]);
    expect(await connQueryOne(fakeConn, "SELECT 1")).toEqual({ id: 1 });
    fakeConn.execute.mockResolvedValueOnce([[], undefined]);
    expect(await connQueryOne(fakeConn, "SELECT 1")).toBeNull();
  });

  it("connExecute 返回 [result, undefined]", async () => {
    fakeConn.execute.mockResolvedValue([{ affectedRows: 1 }, undefined]);
    const [res] = await connExecute(fakeConn, "UPDATE t SET a = ?", [1]);
    expect(res.affectedRows).toBe(1);
    expect(fakeConn.execute).toHaveBeenCalledWith("UPDATE t SET a = ?", [1]);
  });
});
