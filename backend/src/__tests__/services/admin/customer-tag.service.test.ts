import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { listTags, createTag, deleteTag, addCustomerTag, getCustomerTags } from "../../../services/admin/customer-tag.service";

describe("admin/customer-tag.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("listTags：返回标签列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, tag_name: "重点客户", tag_type: "LEVEL" }]);
    const result = await listTags("t1");
    expect(result[0].tag_name).toBe("重点客户");
  });

  it("createTag：创建标签", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ insertId: 10 });
    const result = await createTag({ tagName: "VIP", tagType: "LEVEL", tenantId: "t1" });
    expect(result.id).toBe(10);
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO t_customer_tag"),
      expect.arrayContaining(["VIP", "t1"]),
      "t1"
    );
  });

  it("deleteTag：删除标签", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    await deleteTag(5, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM t_customer_tag"),
      [5, "t1"],
      "t1"
    );
  });

  it("addCustomerTag：给客户打标签", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    await addCustomerTag(1, 5, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("t_customer_tag_relation"),
      expect.arrayContaining([1, 5]),
      "t1"
    );
  });

  it("getCustomerTags：返回客户标签", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, tag_name: "VIP" }]);
    const result = await getCustomerTags(1, "t1");
    expect(result[0].tag_name).toBe("VIP");
  });
});
