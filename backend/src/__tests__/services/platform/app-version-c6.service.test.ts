import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  audit: vi.fn()
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne
}));

vi.mock("../../../services/admin/platform-audit-log.service", () => ({
  insertPlatformAuditLog: mocks.audit
}));

import {
  archiveVersion,
  getLatestVersion,
  pauseVersion,
  resumeVersion,
  rollbackVersion,
  saveDraftVersion
} from "../../../services/platform/app-version.service";

const operator = { adminId: 1, adminName: "凌舟", ip: "10.0.0.1" };

beforeEach(() => {
  mocks.query.mockReset();
  mocks.queryOne.mockReset();
  mocks.audit.mockReset();
  mocks.audit.mockResolvedValue(1);
});

describe("C6-1A · getLatestVersion 只下发已发布版本", () => {
  it("客户端检查的 SQL 必须带 status='PUBLISHED'（草稿/暂停/归档不下发）", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await getLatestVersion("app_mobile");
    const sql = String(mocks.queryOne.mock.calls[0][0]);
    expect(sql).toContain("enabled = 1");
    expect(sql).toContain("status = 'PUBLISHED'");
  });
});

describe("C6-1A · saveDraftVersion（#34 草稿）", () => {
  it("同行已存在时 UPDATE 为 DRAFT 且 enabled=0（草稿不占当前版本位）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 5, status: "PAUSED" });
    mocks.query.mockResolvedValue({});
    const res = await saveDraftVersion({ platform: "admin_web", versionCode: 9, versionName: "0.9.0" });
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("UPDATE t_app_version");
    expect(sql).toContain("status='DRAFT'");
    expect(sql).toContain("enabled=0");
    expect(res).toEqual({ id: 5, status: "DRAFT", enabled: false });
  });

  it("已发布版本不得被草稿覆盖：status=PUBLISHED 时 400（防止静默下架线上版本）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 5, status: "PUBLISHED" });
    await expect(
      saveDraftVersion({ platform: "admin_web", versionCode: 9, versionName: "0.9.0" })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("不存在时 INSERT 且 status='DRAFT'、enabled 0", async () => {
    mocks.queryOne.mockResolvedValue(null);
    mocks.query.mockResolvedValue({ insertId: 11 });
    const res = await saveDraftVersion({ platform: "print_agent", versionCode: 3, versionName: "1.2.0" });
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("INSERT INTO t_app_version");
    expect(sql).toContain("'DRAFT'");
    expect(res.status).toBe("DRAFT");
    expect(res.id).toBe(11);
  });
});

describe("C6-1A · pause / resume / archive（#36 版本操作）", () => {
  it("暂停放量：PUBLISHED → PAUSED 且 gray_ratio=0，并写审计留痕", async () => {
    mocks.queryOne.mockResolvedValue({
      id: 5,
      platform: "app_mobile",
      versionCode: 7,
      versionName: "1.7.0",
      status: "PUBLISHED"
    });
    mocks.query.mockResolvedValue({});
    const res = await pauseVersion(5, operator);
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("status='PAUSED'");
    expect(sql).toContain("gray_ratio=0");
    expect(res).toEqual({ id: 5, status: "PAUSED", grayRatio: 0 });
    expect(mocks.audit).toHaveBeenCalledTimes(1);
    expect((mocks.audit.mock.calls[0][0] as any).action).toBe("PAUSE_VERSION");
  });

  it("草稿不可暂停：DRAFT 调 pause 应报 400（不许把未发布版本当放量目标）", async () => {
    mocks.queryOne.mockResolvedValue({
      id: 5,
      platform: "app_mobile",
      versionCode: 7,
      versionName: "1.7.0",
      status: "DRAFT"
    });
    await expect(pauseVersion(5, operator)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("暂停中才可继续放量：PAUSED → PUBLISHED", async () => {
    mocks.queryOne.mockResolvedValue({
      id: 5,
      platform: "app_mobile",
      versionCode: 7,
      versionName: "1.7.0",
      status: "PAUSED"
    });
    mocks.query.mockResolvedValue({});
    const res = await resumeVersion(5, operator);
    expect(String(mocks.query.mock.calls[0][0])).toContain("status='PUBLISHED'");
    expect(res.status).toBe("PUBLISHED");
    expect((mocks.audit.mock.calls[0][0] as any).action).toBe("RESUME_VERSION");
  });

  it("已发布版本不可「继续放量」（须先暂停）", async () => {
    mocks.queryOne.mockResolvedValue({
      id: 5,
      platform: "app_mobile",
      versionCode: 7,
      versionName: "1.7.0",
      status: "PUBLISHED"
    });
    await expect(resumeVersion(5, operator)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("归档：status=ARCHIVED + enabled=0 + archived_at=NOW()", async () => {
    mocks.queryOne.mockResolvedValue({
      id: 5,
      platform: "app_mobile",
      versionCode: 7,
      versionName: "1.7.0",
      status: "PUBLISHED"
    });
    mocks.query.mockResolvedValue({});
    const res = await archiveVersion(5, operator);
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("status='ARCHIVED'");
    expect(sql).toContain("enabled=0");
    expect(sql).toContain("archived_at=NOW()");
    expect(res).toEqual({ id: 5, status: "ARCHIVED", enabled: false });
  });

  it("重复归档应报 400（幂等由语义拦截，不静默成功）", async () => {
    mocks.queryOne.mockResolvedValue({
      id: 5,
      platform: "app_mobile",
      versionCode: 7,
      versionName: "1.7.0",
      status: "ARCHIVED"
    });
    await expect(archiveVersion(5, operator)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("版本不存在时 404（不静默 UPDATE 空行）", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(archiveVersion(999, operator)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

describe("C6-1A · rollbackVersion（#39 回滚，口径＝裁定 R5②）", () => {
  it("目标为已发布且早于当前启用版本：目标 enabled=1，同平台其它行 enabled=0，并留痕", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({
        id: 3,
        platform: "admin_web",
        versionCode: 2,
        versionName: "0.2.0",
        status: "PUBLISHED"
      })
      .mockResolvedValueOnce({ id: 6, versionCode: 3 });
    mocks.query.mockResolvedValue({});

    const res = await rollbackVersion(3, operator);

    expect(String(mocks.query.mock.calls[0][0])).toContain("SET enabled = 0");
    expect(String(mocks.query.mock.calls[1][0])).toContain("SET enabled = 1");
    expect(res).toMatchObject({ id: 3, versionCode: 2, enabled: true, status: "PUBLISHED" });
    expect((mocks.audit.mock.calls[0][0] as any).action).toBe("ROLLBACK_VERSION");
    expect((mocks.audit.mock.calls[0][0] as any).detail).toMatchObject({
      toVersionCode: 2,
      fromVersionCode: 3
    });
  });

  it("目标不是已发布版本（草稿/暂停/归档）时 400，且不执行任何 UPDATE", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      id: 4,
      platform: "admin_web",
      versionCode: 4,
      versionName: "0.4.0",
      status: "DRAFT"
    });
    await expect(rollbackVersion(4, operator)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("目标不早于当前启用版本时 400（如当前已是更低版本 / 目标即当前版本）", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({
        id: 6,
        platform: "admin_web",
        versionCode: 3,
        versionName: "0.3.0",
        status: "PUBLISHED"
      })
      .mockResolvedValueOnce({ id: 6, versionCode: 3 });
    await expect(rollbackVersion(6, operator)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
