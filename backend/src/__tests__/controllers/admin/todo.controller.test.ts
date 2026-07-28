/**
 * 管理端待办事项 controller 单元测试
 * 被测文件：src/controllers/admin/todo.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  listTodos: vi.fn(),
  getTodoStats: vi.fn(),
  createTodo: vi.fn(),
  completeTodo: vi.fn(),
  dismissTodo: vi.fn(),
  deleteTodo: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/todo.service", () => ({
  listTodos: mocks.listTodos,
  getTodoStats: mocks.getTodoStats,
  createTodo: mocks.createTodo,
  completeTodo: mocks.completeTodo,
  dismissTodo: mocks.dismissTodo,
  deleteTodo: mocks.deleteTodo,
}));

import {
  listTodos,
  getTodoStats,
  createTodo,
  completeTodo,
  dismissTodo,
  deleteTodo,
} from "../../../controllers/admin/todo.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.send = vi.fn();
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin todo.controller", () => {
  it("listTodos 默认分页参数", async () => {
    mocks.listTodos.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listTodos(req, res, vi.fn());
    expect(mocks.listTodos).toHaveBeenCalledWith("t1", 1, 20, undefined, undefined, undefined);
  });

  it("listTodos 传入筛选条件", async () => {
    mocks.listTodos.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ query: { type: "ORDER", priority: "HIGH", status: "PENDING", page: "2", pageSize: "10" } });
    const res = mockRes();
    await listTodos(req, res, vi.fn());
    expect(mocks.listTodos).toHaveBeenCalledWith("t1", 2, 10, "ORDER", "HIGH", "PENDING");
  });

  it("getTodoStats 调用 service 并返回统计", async () => {
    mocks.getTodoStats.mockResolvedValue({ total: 10, pending: 5 });
    const req = mockReq();
    const res = mockRes();
    await getTodoStats(req, res, vi.fn());
    expect(mocks.getTodoStats).toHaveBeenCalledWith("t1");
    expect(mocks.ok).toHaveBeenCalledWith({ total: 10, pending: 5 });
  });

  it("createTodo 成功创建待办", async () => {
    mocks.createTodo.mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { title: "处理订单", type: "ORDER", priority: "HIGH" } });
    const res = mockRes();
    await createTodo(req, res, vi.fn());
    expect(mocks.createTodo).toHaveBeenCalledWith("t1", expect.objectContaining({
      title: "处理订单", type: "ORDER", priority: "HIGH",
    }));
    expect(mocks.ok).toHaveBeenCalledWith({ id: 1 });
  });

  it("createTodo 传入可选字段", async () => {
    mocks.createTodo.mockResolvedValue({ id: 2 });
    const req = mockReq({ body: { title: "盘点", type: "STOCK", priority: "LOW", dueDate: "2026-01-31", remark: "备注", source: "系统" } });
    const res = mockRes();
    await createTodo(req, res, vi.fn());
    expect(mocks.createTodo).toHaveBeenCalledWith("t1", expect.objectContaining({
      dueDate: "2026-01-31", remark: "备注", source: "系统",
    }));
  });

  it("completeTodo 传入 id 转换为数字", async () => {
    mocks.completeTodo.mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();
    await completeTodo(req, res, vi.fn());
    expect(mocks.completeTodo).toHaveBeenCalledWith("t1", 5);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { success: true } });
  });

  it("dismissTodo 传入 id 转换为数字", async () => {
    mocks.dismissTodo.mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "6" } });
    const res = mockRes();
    await dismissTodo(req, res, vi.fn());
    expect(mocks.dismissTodo).toHaveBeenCalledWith("t1", 6);
  });

  it("deleteTodo 传入 id 转换为数字", async () => {
    mocks.deleteTodo.mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "7" } });
    const res = mockRes();
    await deleteTodo(req, res, vi.fn());
    expect(mocks.deleteTodo).toHaveBeenCalledWith("t1", 7);
    expect(mocks.ok).toHaveBeenCalledWith({ success: true });
  });

  it("listTodos 调用 res.json 返回 ok 包装结果", async () => {
    mocks.listTodos.mockResolvedValue({ list: [{ id: 1 }], total: 1 });
    const req = mockReq();
    const res = mockRes();
    await listTodos(req, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { list: [{ id: 1 }], total: 1 } });
  });
});
