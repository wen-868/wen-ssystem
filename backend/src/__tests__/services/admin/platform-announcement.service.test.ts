/**
 * 平台公告 service 单元测试（R101-S2-01 批 5 收尾 · 组一）
 * 被测文件：src/services/admin/platform-announcement.service.ts
 *
 * 重点断言（status 由数字 0/1 统一为字符串枚举 DRAFT/PUBLISHED）：
 *  - listAnnouncements 传入 status='PUBLISHED' 时，字符串原样下推到 SQL 参数；
 *  - createAnnouncement 传入 status='DRAFT' 时，字符串原样写入 INSERT 参数；
 *  - togglePublish 双向切换：当前 PUBLISHED -> 新 DRAFT（publish_at 不刷新），
 *    当前 DRAFT -> 新 PUBLISHED（publish_at = NOW() 拼接）；
 *    旧实现用 status === 1（数字）比对 VARCHAR 永远不成立，导致只能发布、无法下架，
 *    新实现用 === "PUBLISHED" 字符串比对，双向均正确。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

import {
  listAnnouncements,
  createAnnouncement,
  togglePublish,
} from "../../../services/admin/platform-announcement.service";

beforeEach(() => {
  vi.clearAllMocks();
  // queryOne 默认返回计数；listAnnouncements 只关心 total
  mocks.queryOne.mockImplementation(async (sql: string) => {
    if (sql.includes("COUNT(*)")) return { total: 2 };
    return null;
  });
  // query 默认返回空列表/占位 header
  mocks.query.mockResolvedValue({ insertId: 1 });
});

describe("listAnnouncements status 字符串枚举", () => {
  it("传入 status='PUBLISHED' 时字符串原样下推到 SQL 参数", async () => {
    await listAnnouncements({
      page: 1,
      pageSize: 20,
      status: "PUBLISHED",
    });

    // COUNT 查询与列表查询都应携带 'PUBLISHED' 字符串（非数字 1）
    const countArgs = mocks.queryOne.mock.calls[0];
    const listArgs = mocks.query.mock.calls[0];
    expect(countArgs[1]).toContain("PUBLISHED");
    expect(listArgs[1]).toContain("PUBLISHED");
    expect(countArgs[1]).not.toContain(1);
  });

  it("不传 status 时列表查询参数不含 status 条件值", async () => {
    await listAnnouncements({ page: 1, pageSize: 20 });
    const listArgs = mocks.query.mock.calls[0];
    // where 条件中不应出现 'PUBLISHED'/'DRAFT' 占位
    expect(listArgs[1]).not.toContain("PUBLISHED");
    expect(listArgs[1]).not.toContain("DRAFT");
  });
});

describe("createAnnouncement status 字符串枚举", () => {
  it("传入 status='DRAFT' 时字符串原样写入 INSERT 参数（第 5 位）", async () => {
    await createAnnouncement({
      title: "T",
      type: "NOTICE",
      content: "C",
      isTop: 0,
      status: "DRAFT",
    });
    const insertArgs = mocks.query.mock.calls[0];
    const values = insertArgs[1] as unknown[];
    // INSERT 参数顺序：title, type, content, is_top, status
    expect(values[4]).toBe("DRAFT");
    expect(values[4]).not.toBe(0);
  });
});

describe("togglePublish 双向切换（修复 ===1 锁死 bug）", () => {
  it("当前 PUBLISHED -> 新 DRAFT，且 publish_at 不刷新", async () => {
    mocks.queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT status")) return { status: "PUBLISHED" };
      return null;
    });

    const result = await togglePublish(10);
    const updateArgs = mocks.query.mock.calls[0];
    const sql = updateArgs[0] as string;
    const params = updateArgs[1] as unknown[];

    expect(result.status).toBe("DRAFT");
    expect(params[0]).toBe("DRAFT");
    expect(sql).not.toContain("publish_at = NOW()");
  });

  it("当前 DRAFT -> 新 PUBLISHED，且 publish_at 刷新", async () => {
    mocks.queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT status")) return { status: "DRAFT" };
      return null;
    });

    const result = await togglePublish(11);
    const updateArgs = mocks.query.mock.calls[0];
    const sql = updateArgs[0] as string;
    const params = updateArgs[1] as unknown[];

    expect(result.status).toBe("PUBLISHED");
    expect(params[0]).toBe("PUBLISHED");
    expect(sql).toContain("publish_at = NOW()");
  });
});
