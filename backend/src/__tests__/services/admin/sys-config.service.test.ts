import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import { getAllConfigs, getConfigByGroup, batchUpdateConfigs } from "../../../services/admin/sys-config.service";

describe("admin/sys-config.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getAllConfigs：返回配置并按分组聚合", async () => {
    mocks.query.mockResolvedValueOnce([
      { id: 1, configKey: "company_name", configValue: "智享酒业", configGroup: "enterprise" },
      { id: 2, configKey: "wechat_appid", configValue: "wx123", configGroup: "wechat" },
    ]);
    const result = await getAllConfigs("t1");
    expect(result.all).toHaveLength(2);
    expect(result.grouped.enterprise).toHaveLength(1);
    expect(result.grouped.wechat).toHaveLength(1);
  });

  it("getConfigByGroup：按分组查询配置", async () => {
    mocks.query.mockResolvedValueOnce([{ id: 1, configKey: "wechat_appid", configGroup: "wechat" }]);
    const result = await getConfigByGroup("wechat", "t1");
    expect(result[0].configGroup).toBe("wechat");
  });

  it("batchUpdateConfigs：批量更新或创建配置", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ id: 1 }) // 已存在 → UPDATE
      .mockResolvedValueOnce(null); // 不存在 → INSERT
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    const result = await batchUpdateConfigs([
      { config_key: "company_name", config_value: "新公司名" },
      { config_key: "new_key", config_value: "new_value" },
    ], "t1");
    expect(result.updated).toBe(2);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_sys_config"),
      expect.arrayContaining(["新公司名", "company_name", "t1"])
    );
  });
});
