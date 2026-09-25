/**
 * 平台评价 service 单元测试（R101-S3-114）
 * 被测文件：src/services/admin/platform-review.service.ts
 *
 * 背景（生产事故）：`GET /api/platform/reviews` 与 `/stats` 生产 500 ——
 *   `ER_BAD_FIELD_ERROR 1054 Unknown column 'tenant_id'` / `Unknown column 'platform_name'`。
 * 根因：① 服务按**臆想的表结构**写（tenant_id / platform_no / platform_name / review_type /
 *   status / review_result / review_at 七列在生产表里都不存在）；② `t_platform_review` 是
 *   **平台级表**，却被 queryWithTenant 注入 `tenant_id = ?`（平台 JWT 无租户 ⇒ tenant_id 为 undefined）。
 *
 * 重点断言：
 *  - 空表（0 行）时 list = `{ total, page, pageSize, records: [] }`、stats = `{ stats: [] }`；
 *  - **SQL 不得含 tenant_id**（反测挂点：把 SQL 改回 `tenant_id = ?` 形态，本断言必红）；
 *  - SQL 不得引用臆想列（platform_name / platform_no / review_type / status / review_result / review_at）；
 *  - SQL 只引用真实表 t_platform_review 的真实列（11 列，含别名）；
 *  - 不得调用租户注入函数 queryWithTenant / queryOneWithTenant（调用即抛错 ⇒ 直接红）；
 *  - 过滤条件按真实列下推（platform / rating）；
 *  - replyReview 写 reply_content + replied_at（不是不存在的 review_result）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  // 平台级表禁止使用的租户注入函数：一旦被调用即抛错（本单红线，不给"静默注入"的机会）
  queryWithTenant: vi.fn(() => {
    throw new Error("t_platform_review 是平台级表，不得使用 queryWithTenant（租户注入）");
  }),
  queryOneWithTenant: vi.fn(() => {
    throw new Error("t_platform_review 是平台级表，不得使用 queryOneWithTenant（租户注入）");
  }),
  transaction: vi.fn(),
}));

import {
  listReviews,
  getStats,
  replyReview,
  getReviewById,
} from "../../../services/admin/platform-review.service";

/** 真实表 t_platform_review 的 11 列（生产 information_schema 实测 2026-09-25） */
const REAL_COLUMNS = [
  "id",
  "platform",
  "platform_review_id",
  "order_no",
  "rating",
  "content",
  "reply_content",
  "replied_at",
  "synced_at",
  "created_at",
  "updated_at",
];

/** 臆想出来的列（真实表里一律不存在，SQL 里出现即回归） */
const INVENTED_COLUMNS = [
  "tenant_id",
  "platform_name",
  "platform_no",
  "review_type",
  "status",
  "review_result",
  "review_at",
];

/** 收集本次用例中所有下发到数据库的 SQL（含 COUNT 与列表查询） */
function allSql(): string[] {
  return [
    ...mocks.query.mock.calls.map((c) => String(c[0])),
    ...mocks.queryOne.mock.calls.map((c) => String(c[0])),
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  // 空表：COUNT 0 行、列表 0 行
  mocks.queryOne.mockResolvedValue(null);
  mocks.query.mockResolvedValue([]);
});

describe("platform-review.service · listReviews", () => {
  it("空表（0 行）返回 { total: 0, page, pageSize, records: [] }", async () => {
    const result = await listReviews({ page: 1, pageSize: 20 });

    expect(result).toEqual({ total: 0, page: 1, pageSize: 20, records: [] });
  });

  it("分页参数原样回传（page/pageSize 与请求一致）", async () => {
    const result = await listReviews({ page: 3, pageSize: 50 });

    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it("SQL 不得含 tenant_id（反测挂点：改回 tenant_id = ? 形态本断言必红）", async () => {
    await listReviews({ page: 1, pageSize: 20 });

    const sqls = allSql();
    expect(sqls.length).toBeGreaterThan(0);
    for (const sql of sqls) {
      expect(sql).not.toMatch(/tenant_id/i);
    }
  });

  it("SQL 不得引用臆想列，且必须引用真实表与真实列", async () => {
    await listReviews({ page: 1, pageSize: 20 });

    const listSql = String(mocks.query.mock.calls[0][0]);
    for (const invented of INVENTED_COLUMNS) {
      expect(listSql).not.toContain(invented);
    }
    expect(listSql).toContain("t_platform_review");
    for (const column of REAL_COLUMNS) {
      expect(listSql).toContain(column);
    }
    // 无过滤条件时是平台级全表查询，不带 WHERE
    expect(listSql).not.toContain("WHERE");
  });

  it("过滤条件按真实列下推：platform / rating", async () => {
    await listReviews({ page: 2, pageSize: 10, platform: "JD", rating: 5 });

    const countSql = String(mocks.queryOne.mock.calls[0][0]);
    const countParams = mocks.queryOne.mock.calls[0][1];
    const listSql = String(mocks.query.mock.calls[0][0]);
    const listParams = mocks.query.mock.calls[0][1];

    expect(countSql).toContain("platform = ?");
    expect(countSql).toContain("rating = ?");
    expect(countParams).toEqual(["JD", 5]);
    expect(listSql).toContain("platform = ?");
    expect(listSql).toContain("rating = ?");
    // 过滤参数 + 分页参数（LIMIT/OFFSET）
    expect(listParams).toEqual(["JD", 5, 10, 10]);
    expect(listSql).toContain("LIMIT ? OFFSET ?");
  });
});

describe("platform-review.service · getStats", () => {
  it("空表返回 { stats: [] }", async () => {
    const result = await getStats();

    expect(result).toEqual({ stats: [] });
  });

  it("按真实列 platform 分组，且 SQL 不含 tenant_id", async () => {
    mocks.query.mockResolvedValue([{ platform: "JD", cnt: 3 }]);

    const result = await getStats();

    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("t_platform_review");
    expect(sql).toContain("platform");
    expect(sql).toContain("GROUP BY platform");
    expect(sql).not.toMatch(/tenant_id/i);
    expect(sql).not.toContain("platform_name");
    expect(result).toEqual({ stats: [{ platform: "JD", cnt: 3 }] });
  });
});

describe("platform-review.service · replyReview", () => {
  it("写 reply_content + replied_at，不碰 review_result/review_at/tenant_id", async () => {
    const result = await replyReview(7, "多谢反馈");

    const sql = String(mocks.query.mock.calls[0][0]);
    const params = mocks.query.mock.calls[0][1];

    expect(result).toEqual({ id: 7 });
    expect(sql).toContain("UPDATE t_platform_review");
    expect(sql).toContain("reply_content = ?");
    expect(sql).toContain("replied_at = NOW()");
    expect(params).toEqual(["多谢反馈", 7]);
    expect(sql).not.toContain("review_result");
    expect(sql).not.toContain("review_at");
    expect(sql).not.toMatch(/tenant_id/i);
  });
});

describe("platform-review.service · getReviewById", () => {
  it("按 id 查详情，SQL 只引用真实列且不含 tenant_id", async () => {
    const row = { id: 9, platform: "TMALL", rating: 4 };
    mocks.queryOne.mockResolvedValue(row);

    const result = await getReviewById(9);

    const sql = String(mocks.queryOne.mock.calls[0][0]);
    const params = mocks.queryOne.mock.calls[0][1];
    expect(result).toBe(row);
    expect(sql).toContain("WHERE id = ?");
    expect(sql).not.toMatch(/tenant_id/i);
    expect(params).toEqual([9]);
  });
});

describe("platform-review.service · 平台级语义（禁止租户注入）", () => {
  it("四个函数只走 query/queryOne，不调用 queryWithTenant/queryOneWithTenant", async () => {
    await listReviews({ page: 1, pageSize: 20 });
    await getStats();
    await replyReview(1, "回复");
    await getReviewById(1);

    // 若真用了注入函数，mock 里的实现会直接抛错 ⇒ 前面的 await 就会失败；
    // 这里再显式确认两个注入函数从未被调用。
    const db = await import("../../../shared/db");
    expect(db.queryWithTenant).not.toHaveBeenCalled();
    expect(db.queryOneWithTenant).not.toHaveBeenCalled();
  });
});
