/**
 * 管理端用户反馈 service 单元测试
 * 被测文件：src/services/admin/feedback.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

import {
  insertFeedback,
  listFeedbacks,
  updateFeedbackStatus,
} from "../../../services/admin/feedback.service";

describe("feedback.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("insertFeedback", () => {
    it("插入反馈返回 insertId（含可选字段）", async () => {
      mocks.query.mockResolvedValue({ insertId: 42 });
      const id = await insertFeedback({
        type: "BUG",
        title: "标题",
        content: "内容",
        contact: "c",
        screenshot_urls: "s",
        page_url: "p",
        browser_info: "b",
        user_id: 1,
        tenant_id: "t1",
      });
      expect(id).toBe(42);
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("INSERT INTO t_system_feedback");
      expect(params).toEqual(["BUG", "标题", "内容", "c", "s", "p", "b", 1, "t1"]);
    });

    it("可选字段缺失时使用 null", async () => {
      mocks.query.mockResolvedValue({ insertId: 1 });
      await insertFeedback({ type: "FEATURE", title: "t", content: "c", tenant_id: "t1" });
      const [, params] = mocks.query.mock.calls[0];
      expect(params).toEqual(["FEATURE", "t", "c", null, null, null, null, null, "t1"]);
    });
  });

  describe("listFeedbacks", () => {
    it("无筛选时返回分页列表", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
      const res = await listFeedbacks({ page: 1, pageSize: 10, tenant_id: "t1" });
      expect(res.list.length).toBe(1);
      expect(res.total).toBe(1);
      expect(res.page).toBe(1);
    });

    it("带 type/status/keyword 筛选", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      await listFeedbacks({ page: 1, pageSize: 10, tenant_id: "t1", type: "BUG", status: "PENDING", keyword: "kw" });
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("f.type = ?");
      expect(sql).toContain("f.status = ?");
      expect(sql).toContain("LIKE");
      // tenant_id, type, status, kw, kw, pageSize, offset
      expect(params).toEqual(["t1", "BUG", "PENDING", "%kw%", "%kw%", 10, 0]);
    });

    it("countResult 为 null 时 total 归零", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue(null);
      const res = await listFeedbacks({ page: 2, pageSize: 5, tenant_id: "t1" });
      expect(res.total).toBe(0);
    });
  });

  describe("updateFeedbackStatus", () => {
    it("带 reply 时更新 status 和 reply", async () => {
      mocks.query.mockResolvedValue(undefined);
      await updateFeedbackStatus(1, "RESOLVED", "已处理", "t1");
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("SET status = ?, reply = ?");
      expect(params).toEqual(["RESOLVED", "已处理", 1, "t1"]);
    });

    it("不带 reply 时仅更新 status", async () => {
      mocks.query.mockResolvedValue(undefined);
      await updateFeedbackStatus(2, "REJECTED", undefined, "t1");
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).not.toContain("reply = ?");
      expect(params).toEqual(["REJECTED", 2, "t1"]);
    });
  });
});
