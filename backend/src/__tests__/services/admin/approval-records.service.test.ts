/**
 * 管理端审批流记录 service 单元测试
 * 被测文件：src/services/admin/approval-records.service.ts
 * 覆盖：isApprovalEnabled / listInstances / submitApproval / getInstanceDetail /
 *       listTasks / approveTask / rejectTask / listNotifications / markNotificationRead
 *
 * 约定：事务内 conn.query 返回 [rows]；SELECT 解构 const [rows]= 故传入 [[...rows]]；
 *       INSERT 解构 const [header]= 故传入 [{...header}]。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../../shared/app-error";
import * as service from "../../../services/admin/approval-records.service";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
}));
vi.mock("../../../shared/id", () => ({ makeBizNo: mocks.makeBizNo }));

let conn = { query: vi.fn(), execute: vi.fn() };
const queryQueue: any[][] = [];

/** 按调用次序为 conn.query 设定返回值（传入 [rows] 形态）；beforeEach 清空队列避免跨用例泄漏 */
function setConnQuery(responses: any[][]) {
  queryQueue.push(...responses);
}

beforeEach(() => {
  queryQueue.length = 0;
  vi.resetAllMocks();
  mocks.makeBizNo.mockReturnValue("SP202608160001");
  conn = {
    query: vi.fn(async () => queryQueue.shift() ?? [[]]),
    execute: vi.fn().mockResolvedValue({}),
  };
  mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
});

async function expectAppError(fn: () => Promise<any>, status: number) {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    expect((e as AppError).statusCode).toBe(status);
    return;
  }
  throw new Error("expected AppError but resolved");
}

describe("approval-records.service", () => {
  describe("isApprovalEnabled", () => {
    it("配置为 1 时启用", async () => {
      mocks.queryOne.mockResolvedValue({ configValue: "1" });
      expect(await service.isApprovalEnabled("t1")).toBe(true);
    });
    it("配置为 0 时未启用", async () => {
      mocks.queryOne.mockResolvedValue({ configValue: "0" });
      expect(await service.isApprovalEnabled("t1")).toBe(false);
    });
    it("配置缺失时未启用", async () => {
      mocks.queryOne.mockResolvedValue(undefined);
      expect(await service.isApprovalEnabled("t1")).toBe(false);
    });
  });

  describe("listInstances", () => {
    it("返回分页实例列表", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ id: 1, instanceNo: "SP1" }]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });

      const res = await service.listInstances(1, 10, "t1", { status: "PENDING" });

      expect(res.total).toBe(1);
      expect(res.records).toHaveLength(1);
    });
    it("无过滤条件也可查询", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });

      const res = await service.listInstances(1, 10, "t1", {});

      expect(res.total).toBe(0);
    });
  });

  describe("submitApproval", () => {
    it("审批未启用时直接返回未启动", async () => {
      mocks.queryOne.mockResolvedValue({ configValue: "0" });

      const res = await service.submitApproval(
        { businessType: "PURCHASE_ORDER", businessNo: "PO1", title: "采购", applicantId: 1 },
        "t1",
      );

      expect(res.started).toBe(false);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("未匹配到审批规则时返回未启动", async () => {
      mocks.queryOne.mockResolvedValue({ configValue: "1" });
      setConnQuery([[[]]]);

      const res = await service.submitApproval(
        { businessType: "PURCHASE_ORDER", businessNo: "PO1", title: "采购", applicantId: 1 },
        "t1",
      );

      expect(res.started).toBe(false);
    });

    it("匹配规则后创建审批实例并返回启动结果", async () => {
      mocks.queryOne.mockResolvedValue({ configValue: "1" });
      setConnQuery([
        [[
          {
            id: 1,
            rule_name: "采购审批",
            trigger_condition: "{}",
            approval_chain: '[{"level":1,"approverType":"ROLE","approverValue":"MGR"}]',
            sla_hours: 24,
            escalation_level: 0,
          },
        ]],
        [[{ id: 1, approver_name: "经理A" }]],
      ]);
      conn.execute.mockResolvedValue({});

      const res = await service.submitApproval(
        { businessType: "PURCHASE_ORDER", businessNo: "PO1", title: "采购", applicantId: 1 },
        "t1",
      );

      expect(res.started).toBe(true);
      expect(res.instanceNo).toBe("SP202608160001");
      expect(res.status).toBe("PENDING");
      expect(mocks.makeBizNo).toHaveBeenCalledWith("SP");
    });
  });

  describe("getInstanceDetail", () => {
    it("实例不存在时返回 null", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(undefined);
      expect(await service.getInstanceDetail(1, "t1")).toBeNull();
    });
    it("返回实例及其任务/日志", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, instanceNo: "SP1" });
      mocks.queryWithTenant.mockResolvedValue([]);

      const res = await service.getInstanceDetail(1, "t1");

      expect(res?.instanceNo).toBe("SP1");
      expect(res?.tasks).toEqual([]);
      expect(res?.logs).toEqual([]);
    });
  });

  describe("listTasks", () => {
    it("返回分页任务列表", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });

      const res = await service.listTasks(1, 10, "t1", { status: "PENDING" });

      expect(res.total).toBe(1);
    });
  });

  describe("approveTask", () => {
    const baseTask = {
      id: 1,
      instance_id: "SP1",
      approval_level: 1,
      approver_id: 1,
      task_status: "PENDING",
      current_level: 1,
      instanceStatus: "PENDING",
    };

    it("任务不存在时抛 404", async () => {
      setConnQuery([[[]]]);
      await expectAppError(() => service.approveTask(1, "同意", 1, "审批人", "t1"), 404);
    });

    it("审批人不符时抛 403", async () => {
      setConnQuery([[[{ ...baseTask, approver_id: 2 }]]]);
      await expectAppError(() => service.approveTask(1, "同意", 1, "审批人", "t1"), 403);
    });

    it("任务已处理时抛 400", async () => {
      setConnQuery([[[{ ...baseTask, task_status: "APPROVED" }]]]);
      await expectAppError(() => service.approveTask(1, "同意", 1, "审批人", "t1"), 400);
    });

    it("正常审批并终审批通过", async () => {
      setConnQuery([
        [[{ ...baseTask }]],
        [[]],
        [[
          {
            applicant_id: 5,
            applicant_name: "用户",
            business_title: "采购",
            business_type: "PURCHASE_ORDER",
            business_no: "PO1",
          },
        ]],
      ]);
      conn.execute.mockResolvedValue({});

      const res = await service.approveTask(1, "同意", 1, "审批人", "t1");

      expect(res.taskStatus).toBe("APPROVED");
      expect(res.instanceNo).toBe("SP1");
    });
  });

  describe("rejectTask", () => {
    it("正常驳回", async () => {
      setConnQuery([
        [[
          {
            id: 1,
            instance_id: "SP1",
            approval_level: 1,
            approver_id: 1,
            task_status: "PENDING",
            current_level: 1,
            instanceStatus: "PENDING",
          },
        ]],
        [[
          {
            applicant_id: 5,
            applicant_name: "用户",
            business_title: "采购",
            business_type: "PURCHASE_ORDER",
            business_no: "PO1",
          },
        ]],
      ]);
      conn.execute.mockResolvedValue({});

      const res = await service.rejectTask(1, "不通过", 1, "审批人", "t1");

      expect(res.taskStatus).toBe("REJECTED");
      expect(res.instanceNo).toBe("SP1");
    });
  });

  describe("listNotifications", () => {
    it("返回分页通知列表", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });

      const res = await service.listNotifications(1, 10, "t1", { readStatus: 0 });

      expect(res.total).toBe(1);
    });
  });

  describe("markNotificationRead", () => {
    it("标记已读并返回状态", async () => {
      mocks.queryWithTenant.mockResolvedValue(undefined);

      const res = await service.markNotificationRead(1, "t1");

      expect(res.id).toBe(1);
      expect(res.readStatus).toBe(1);
    });
  });
});
