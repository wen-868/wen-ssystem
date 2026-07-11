import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/customer-statement.service.js", () => ({
  list: vi.fn(),
  getDetail: vi.fn(),
  create: vi.fn(),
  confirm: vi.fn(),
  markPaid: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as customerStatementService from "../../../services/admin/customer-statement.service.js";
import { ok } from "../../../shared/response.js";
import {
  list,
  getDetail,
  create,
  confirm,
  markPaid,
} from "../../../controllers/admin/customer-statement.controller.js";

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

describe("customer-statement.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("应返回客户对账单列表", async () => {
      (customerStatementService.list as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await list(req as any, res as any);
      expect(customerStatementService.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        tenantId: "t1",
        customerId: undefined,
        status: undefined,
        dateStart: undefined,
        dateEnd: undefined,
      });
      expect(ok).toHaveBeenCalled();
    });

    it("应支持按客户、状态、日期筛选", async () => {
      (customerStatementService.list as any).mockResolvedValue({ total: 1, records: [] });
      const req = mockReq({
        query: {
          customer_id: "5",
          status: "PENDING",
          start_date: "2026-01-01",
          end_date: "2026-01-31",
          page: "2",
          pageSize: "10",
        },
      });
      const res = mockRes();
      await list(req as any, res as any);
      expect(customerStatementService.list).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10,
        tenantId: "t1",
        customerId: 5,
        status: "PENDING",
        dateStart: "2026-01-01",
        dateEnd: "2026-01-31",
      });
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错时应抛出异常", async () => {
      (customerStatementService.list as any).mockRejectedValue(new Error("数据库错误"));
      const req = mockReq();
      const res = mockRes();
      await expect(list(req as any, res as any)).rejects.toThrow("数据库错误");
    });
  });

  describe("getDetail", () => {
    it("应返回对账单详情", async () => {
      (customerStatementService.getDetail as any).mockResolvedValue({ statementNo: "CS001" });
      const req = mockReq({ params: { statementNo: "CS001" } });
      const res = mockRes();
      await getDetail(req as any, res as any);
      expect(customerStatementService.getDetail).toHaveBeenCalledWith("CS001", "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错时应抛出异常", async () => {
      (customerStatementService.getDetail as any).mockRejectedValue(new Error("对账单不存在"));
      const req = mockReq({ params: { statementNo: "CS999" } });
      const res = mockRes();
      await expect(getDetail(req as any, res as any)).rejects.toThrow("对账单不存在");
    });
  });

  describe("create", () => {
    it("应创建客户对账单", async () => {
      const body = { customerId: 1, startDate: "2026-01-01", endDate: "2026-01-31" };
      (customerStatementService.create as any).mockResolvedValue({ statementNo: "CS001" });
      const req = mockReq({ body });
      const res = mockRes();
      await create(req as any, res as any);
      expect(customerStatementService.create).toHaveBeenCalledWith(body, "t1", 1, "admin");
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错时应抛出异常", async () => {
      const body = { customerId: 1 };
      (customerStatementService.create as any).mockRejectedValue(new Error("客户不存在"));
      const req = mockReq({ body });
      const res = mockRes();
      await expect(create(req as any, res as any)).rejects.toThrow("客户不存在");
    });
  });

  describe("confirm", () => {
    it("应确认对账单", async () => {
      (customerStatementService.confirm as any).mockResolvedValue({ statementNo: "CS001", status: "CONFIRMED" });
      const req = mockReq({ params: { statementNo: "CS001" } });
      const res = mockRes();
      await confirm(req as any, res as any);
      expect(customerStatementService.confirm).toHaveBeenCalledWith("CS001", "t1", 1, "admin");
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错时应抛出异常", async () => {
      (customerStatementService.confirm as any).mockRejectedValue(new Error("对账单已确认"));
      const req = mockReq({ params: { statementNo: "CS001" } });
      const res = mockRes();
      await expect(confirm(req as any, res as any)).rejects.toThrow("对账单已确认");
    });
  });

  describe("markPaid", () => {
    it("应标记对账单已付款", async () => {
      (customerStatementService.markPaid as any).mockResolvedValue({ statementNo: "CS001", status: "PAID" });
      const req = mockReq({ params: { statementNo: "CS001" } });
      const res = mockRes();
      await markPaid(req as any, res as any);
      expect(customerStatementService.markPaid).toHaveBeenCalledWith("CS001", "t1", 1, "admin");
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错时应抛出异常", async () => {
      (customerStatementService.markPaid as any).mockRejectedValue(new Error("对账单未确认"));
      const req = mockReq({ params: { statementNo: "CS001" } });
      const res = mockRes();
      await expect(markPaid(req as any, res as any)).rejects.toThrow("对账单未确认");
    });
  });
});
