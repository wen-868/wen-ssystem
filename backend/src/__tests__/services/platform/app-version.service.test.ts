/**
 * 应用版本发布 service 单元测试
 * 被测文件：src/services/platform/app-version.service.ts
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
  getLatestVersion,
  listVersions,
  publishVersion,
  deleteVersion,
} from "../../../services/platform/app-version.service";

beforeEach(() => {
  mocks.query.mockReset();
  mocks.queryOne.mockReset();
});

describe("app-version.service - getLatestVersion", () => {
  it("返回当前启用最新版本（字段映射+类型转换）", async () => {
    mocks.queryOne.mockResolvedValue({
      platform: "admin_web",
      versionCode: 3,
      versionName: "0.3.0",
      minVersionCode: 1,
      isForce: 1,
      updateUrl: "https://example.com/download",
      packageUrl: "https://example.com/app.wgt",
      updateNote: "修复若干问题",
      updatedAt: "2026-08-14 12:00:00",
    });
    const res = await getLatestVersion("admin_web");
    expect(res?.versionCode).toBe(3);
    expect(res?.versionName).toBe("0.3.0");
    expect(res?.isForce).toBe(true);
    expect(res?.minVersionCode).toBe(1);
  });

  it("无版本时返回 null", async () => {
    mocks.queryOne.mockResolvedValue(null);
    const res = await getLatestVersion("app_mobile");
    expect(res).toBeNull();
  });
});

describe("app-version.service - listVersions", () => {
  it("不带平台返回全部", async () => {
    mocks.query.mockResolvedValue([{ platform: "admin_web", versionCode: 2 }]);
    const res = await listVersions();
    expect(res).toHaveLength(1);
    expect(mocks.query.mock.calls[0][1]).toEqual([]);
  });

  it("带平台时追加 WHERE 条件", async () => {
    mocks.query.mockResolvedValue([]);
    await listVersions("print_agent");
    expect(mocks.query.mock.calls[0][0]).toContain("WHERE platform = ?");
    expect(mocks.query.mock.calls[0][1]).toEqual(["print_agent"]);
  });
});

describe("app-version.service - publishVersion", () => {
  it("版本已存在时执行 UPDATE", async () => {
    mocks.queryOne.mockResolvedValue({ id: 5 });
    mocks.query.mockResolvedValue(undefined);
    await publishVersion({ platform: "admin_web", versionCode: 2, versionName: "0.2.0", isForce: true });
    expect(mocks.query.mock.calls[0][0]).toContain("UPDATE t_app_version");
    expect(mocks.query.mock.calls[0][1]).toContain(5);
  });

  it("版本不存在时执行 INSERT", async () => {
    mocks.queryOne.mockResolvedValue(null);
    mocks.query.mockResolvedValue(undefined);
    await publishVersion({ platform: "print_agent", versionCode: 2, versionName: "1.1.0" });
    expect(mocks.query.mock.calls[0][0]).toContain("INSERT INTO t_app_version");
  });
});

describe("app-version.service - deleteVersion", () => {
  it("按 id 删除", async () => {
    mocks.query.mockResolvedValue(undefined);
    const res = await deleteVersion(3);
    expect(res.success).toBe(true);
    expect(mocks.query.mock.calls[0][1]).toEqual([3]);
  });
});
