/**
 * 待办 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/todo.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  executeWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  executeWithTenant: mocks.executeWithTenant,
}));

import {
  listTodos,
  getTodoStats,
  createTodo,
  completeTodo,
  dismissTodo,
  deleteTodo,
} from "../../../services/admin/todo.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("todo.service - listTodos", () => {
  it("无筛选时仅按租户，total 缺失兜底 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listTodos("t1", 1, 10);
    expect(res).toEqual({ total: 0, page: 1, pageSize: 10, records: [{ id: 1 }] });
  });

  it("type/priority/status 筛选条件拼接", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listTodos("t1", 2, 5, "inventory_alert", "HIGH", "PENDING");
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("type = ?");
    expect(sql).toContain("priority = ?");
    expect(sql).toContain("status = ?");
    expect(sql).toContain("CASE priority WHEN 'HIGH'");
  });
});

describe("todo.service - getTodoStats", () => {
  it("按固定类型返回标签与计数，未出现类型为 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { type: "inventory_alert", count: 3 },
      { type: "order_pending", count: "2" },
    ]);
    const res = await getTodoStats("t1");
    expect(res).toContainEqual({ type: "inventory_alert", label: "库存预警", count: 3 });
    expect(res).toContainEqual({ type: "order_pending", label: "订单待处理", count: 2 });
    expect(res).toContainEqual({ type: "payment_overdue", label: "支付逾期", count: 0 });
    expect(res).toHaveLength(6);
  });
});

describe("todo.service - createTodo", () => {
  it("成功创建，source/dueDate/remark 缺省兜底", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 5 }]);
    const res = await createTodo("t1", { title: "跟进客户", type: "customer_followup", priority: "MEDIUM" });
    expect(res).toEqual({ id: 5 });
    const params = mocks.queryWithTenant.mock.calls[0][1] as unknown[];
    expect(params).toContain("");
    expect(params).toContain(null);
  });
});

describe("todo.service - completeTodo / dismissTodo / deleteTodo", () => {
  it("完成待办返回 completed:true", async () => {
    mocks.executeWithTenant.mockResolvedValue(undefined);
    const res = await completeTodo("t1", 1);
    expect(res).toEqual({ completed: true });
    expect(String(mocks.executeWithTenant.mock.calls[0][0])).toContain("'COMPLETED'");
  });

  it("忽略待办返回 dismissed:true", async () => {
    mocks.executeWithTenant.mockResolvedValue(undefined);
    const res = await dismissTodo("t1", 1);
    expect(res).toEqual({ dismissed: true });
    expect(String(mocks.executeWithTenant.mock.calls[0][0])).toContain("'DISMISSED'");
  });

  it("删除待办返回 deleted:true", async () => {
    mocks.executeWithTenant.mockResolvedValue(undefined);
    const res = await deleteTodo("t1", 1);
    expect(res).toEqual({ deleted: true });
  });
});
