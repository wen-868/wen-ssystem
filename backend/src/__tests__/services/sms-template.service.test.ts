import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import {
  listSmsTemplates,
  createSmsTemplate,
  updateSmsTemplate,
  deleteSmsTemplate,
} from "../../services/sms-template.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sms-template.service - 短信模板管理", () => {
  it("listSmsTemplates 按租户查询", async () => {
    mocks.query.mockResolvedValue([{ id: 1, name: "发货通知", code: "SHIP" }]);
    const res = await listSmsTemplates(tenantId);
    expect(res).toHaveLength(1);
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("tenant_id = ?"), [tenantId]);
  });

  it("createSmsTemplate 必填缺失抛 400", async () => {
    await expect(createSmsTemplate({ name: "", code: "X", content: "内容" }, tenantId))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it("createSmsTemplate 编码重复抛 400", async () => {
    mocks.queryOne.mockResolvedValue({ total: 1 });
    await expect(createSmsTemplate({ name: "A", code: "DUP", content: "内容" }, tenantId))
      .rejects.toMatchObject({ statusCode: 400, message: "该模板编码已存在" });
  });

  it("createSmsTemplate 成功返回新 id（ResultSetHeader 数组归一化）", async () => {
    mocks.queryOne.mockResolvedValue({ total: 0 });
    mocks.query.mockResolvedValue([{ insertId: 7 }]); // database.ts 归一化为数组
    const res = await createSmsTemplate({ name: "发货通知", code: "SHIP", content: "您的订单已发货" }, tenantId);
    expect(res).toEqual({ id: 7 });
  });

  it("updateSmsTemplate 模板不存在抛 404", async () => {
    mocks.queryOne.mockResolvedValue({ total: 0 });
    await expect(updateSmsTemplate(99, { name: "X" }, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "短信模板不存在" });
  });

  it("updateSmsTemplate 存在时更新并带租户条件", async () => {
    mocks.queryOne.mockResolvedValue({ total: 1 });
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    await updateSmsTemplate(1, { name: "新名称", status: "DISABLED" }, tenantId);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("WHERE id = ? AND tenant_id = ?");
    expect(params).toEqual(["新名称", "", "", "", "DISABLED", 1, tenantId]);
  });

  it("deleteSmsTemplate 按租户删除", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    await deleteSmsTemplate(3, tenantId);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM t_sms_template"),
      [3, tenantId]
    );
  });
});
