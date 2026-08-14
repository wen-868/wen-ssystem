/**
 * 管理端客户标签 service 单元测试
 * 被测文件：src/services/admin/customer-tag.service.ts
 * 覆盖全部 9 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

import {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  addCustomerTag,
  removeCustomerTag,
  getCustomerTags,
  getCustomerProfile,
  updateCustomerProfile,
} from "../../../services/admin/customer-tag.service";

beforeEach(() => {
  vi.clearAllMocks();
});

// ============ listTags ============
describe("admin customer-tag.service - listTags", () => {
  it("返回标签列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, tagName: "VIP" }]);
    const res = await listTags("t1");
    expect(res).toEqual([{ id: 1, tagName: "VIP" }]);
  });
});

// ============ createTag ============
describe("admin customer-tag.service - createTag", () => {
  it("有 tagGroup 时创建标签（?? 左）", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 10 });
    const res = await createTag({ tagName: "VIP", tagType: "CUSTOM", tagGroup: "G1", tenantId: "t1" });
    expect(res).toEqual({ id: 10, tagName: "VIP", tagType: "CUSTOM" });
  });

  it("无 tagGroup 时创建标签（?? 右）", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 11 });
    const res = await createTag({ tagName: "新客", tagType: "AUTO", tenantId: "t1" });
    expect(res.id).toBe(11);
  });
});

// ============ updateTag ============
describe("admin customer-tag.service - updateTag", () => {
  it("全字段更新", async () => {
    const res = await updateTag(1, { tagName: "新名", tagType: "CUSTOM", tagGroup: "G2", tenantId: "t1" });
    expect(res.id).toBe(1);
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("无字段更新时抛错", async () => {
    await expect(updateTag(1, { tenantId: "t1" })).rejects.toThrow("没有需要更新的字段");
  });
});

// ============ deleteTag ============
describe("admin customer-tag.service - deleteTag", () => {
  it("删除标签及关联关系", async () => {
    const res = await deleteTag(1, "t1");
    expect(res).toEqual({ id: 1 });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });
});

// ============ addCustomerTag ============
describe("admin customer-tag.service - addCustomerTag", () => {
  it("添加客户标签关联", async () => {
    const res = await addCustomerTag(1, 2, "t1");
    expect(res).toEqual({ customerId: 1, tagId: 2 });
  });
});

// ============ removeCustomerTag ============
describe("admin customer-tag.service - removeCustomerTag", () => {
  it("移除客户标签关联", async () => {
    const res = await removeCustomerTag(1, 2, "t1");
    expect(res).toEqual({ customerId: 1, tagId: 2 });
  });
});

// ============ getCustomerTags ============
describe("admin customer-tag.service - getCustomerTags", () => {
  it("返回客户标签列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, tagName: "VIP" }]);
    const res = await getCustomerTags(1, "t1");
    expect(res).toEqual([{ id: 1, tagName: "VIP" }]);
  });
});

// ============ getCustomerProfile ============
describe("admin customer-tag.service - getCustomerProfile", () => {
  it("画像存在 + member/points 有值（?? 全左分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ customerId: 1, ageGroup: "30-40", gender: "M", preferCategory: "白酒", preferBrand: "茅台", avgOrderAmount: 500, totalOrderCount: 10, lastOrderAt: "2026-07-01", totalPoints: 100, memberLevel: "VIP2", lifecycleStage: "ACTIVE" })
      .mockResolvedValueOnce({ name: "张三", mobile: "138" })
      .mockResolvedValueOnce({ availablePoints: 50 });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, tagName: "VIP" }]);
    const res = await getCustomerProfile(1, "t1");
    expect(res.name).toBe("张三");
    expect(res.mobile).toBe("138");
    expect(res.availablePoints).toBe(50);
    expect(res.tags).toHaveLength(1);
  });

  it("画像不存在 + member/points 为 null（INSERT + ?? 全右分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getCustomerProfile(99, "t1");
    expect(res.name).toBe("");
    expect(res.mobile).toBe("");
    expect(res.availablePoints).toBe(0);
    expect(res.lifecycleStage).toBe("PROSPECT");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2); // INSERT profile + getCustomerTags
  });
});

// ============ updateCustomerProfile ============
describe("admin customer-tag.service - updateCustomerProfile", () => {
  it("stats 为 null 时 stage = PROSPECT（?. 右分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)   // stats
      .mockResolvedValueOnce(null)   // points
      .mockResolvedValueOnce(null);  // level
    const res = await updateCustomerProfile(1, "t1");
    expect(res.stage).toBe("PROSPECT");
  });

  it("orderCount = 1 + lastOrder 今天时 stage = NEW", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ orderCount: 1, avgAmount: 100, lastOrder: new Date().toISOString() })
      .mockResolvedValueOnce({ totalPoints: 50 })
      .mockResolvedValueOnce({ level_name: "VIP1" });
    const res = await updateCustomerProfile(1, "t1");
    expect(res.stage).toBe("NEW");
  });

  it("orderCount > 1 + lastOrder 今天时 stage = ACTIVE", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ orderCount: 5, avgAmount: 200, lastOrder: new Date().toISOString() })
      .mockResolvedValueOnce({ totalPoints: 100 })
      .mockResolvedValueOnce({ level_name: "VIP2" });
    const res = await updateCustomerProfile(1, "t1");
    expect(res.stage).toBe("ACTIVE");
  });

  it("lastOrder 60天前时 stage = DORMANT", async () => {
    const pastDate = new Date(Date.now() - 60 * 86400000).toISOString();
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ orderCount: 5, avgAmount: 200, lastOrder: pastDate })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const res = await updateCustomerProfile(1, "t1");
    expect(res.stage).toBe("DORMANT");
  });

  it("lastOrder 为 null 时 stage = LOST（daysSinceLast = 999）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ orderCount: 5, avgAmount: 200, lastOrder: null })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const res = await updateCustomerProfile(1, "t1");
    expect(res.stage).toBe("LOST");
  });
});
