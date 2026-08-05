/**
 * 系统配置 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/sys-config.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import {
  getAllConfigs,
  getConfigByGroup,
  batchUpdateConfigs,
  createConfig,
} from "../../../services/admin/sys-config.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("sys-config.service - getAllConfigs", () => {
  it("按 config_group 分组返回，空组名归入 other", async () => {
    mocks.query.mockResolvedValue([
      { id: 1, configKey: "k1", configValue: "v1", configGroup: "base", description: "", updatedAt: "2026-01-01" },
      { id: 2, configKey: "k2", configValue: "v2", configGroup: "", description: "", updatedAt: "2026-01-01" },
    ]);
    const res = await getAllConfigs("t1");
    expect(res.all).toHaveLength(2);
    expect(res.grouped.base).toHaveLength(1);
    expect(res.grouped.other).toHaveLength(1);
  });

  it("空记录时返回空对象分组", async () => {
    mocks.query.mockResolvedValue([]);
    const res = await getAllConfigs("t1");
    expect(res.all).toEqual([]);
    expect(res.grouped).toEqual({});
  });
});

describe("sys-config.service - getConfigByGroup", () => {
  it("按组查询并返回记录", async () => {
    mocks.query.mockResolvedValue([{ id: 3, configKey: "k3" }]);
    const res = await getConfigByGroup("base", "t1");
    expect(res).toEqual([{ id: 3, configKey: "k3" }]);
    expect(mocks.query.mock.calls[0][1]).toEqual(["base", "t1"]);
  });
});

describe("sys-config.service - batchUpdateConfigs", () => {
  it("已存在配置时走 UPDATE 分支", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1 });
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await batchUpdateConfigs([{ config_key: "k1", config_value: "new" }], "t1");
    expect(res).toEqual({ updated: 1 });
    expect(String(mocks.query.mock.calls[0][0])).toContain("UPDATE t_sys_config");
  });

  it("不存在配置时走 INSERT 分支", async () => {
    mocks.queryOne.mockResolvedValue(null);
    mocks.query.mockResolvedValue({ insertId: 9 });
    const res = await batchUpdateConfigs([{ config_key: "k2", config_value: "v2" }], "t1");
    expect(res).toEqual({ updated: 1 });
    expect(String(mocks.query.mock.calls[0][0])).toContain("INSERT INTO t_sys_config");
  });
});

describe("sys-config.service - createConfig", () => {
  it("成功创建并返回 configKey", async () => {
    mocks.query.mockResolvedValue({ insertId: 10 });
    const res = await createConfig(
      { config_key: "k9", config_value: "v9", config_group: "base", description: "说明" },
      "t1"
    );
    expect(res).toEqual({ configKey: "k9" });
    expect(mocks.query.mock.calls[0][1]).toEqual(["k9", "v9", "base", "说明", "t1"]);
  });
});
