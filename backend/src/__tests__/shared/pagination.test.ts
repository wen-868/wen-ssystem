import { describe, it, expect } from "vitest";
import {
  normalizePagination,
  calculateOffset,
  paginate,
  paginatedQuery,
  paginatedSearchQuery,
} from "../../shared/pagination";

describe("shared/pagination - normalizePagination", () => {
  it("默认参数 → page=1, pageSize=20", () => {
    expect(normalizePagination({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("page 为非数字/小于1 时归正为 1", () => {
    expect(normalizePagination({ page: NaN, pageSize: 10 }).page).toBe(1);
    expect(normalizePagination({ page: 0, pageSize: 10 }).page).toBe(1);
    expect(normalizePagination({ page: -3, pageSize: 10 }).page).toBe(1);
  });

  it("pageSize 为非数字/小于1 时归正为 20", () => {
    expect(normalizePagination({ page: 2, pageSize: NaN }).pageSize).toBe(20);
    expect(normalizePagination({ page: 2, pageSize: 0 }).pageSize).toBe(20);
  });

  it("pageSize 超过 100 时截断为 100", () => {
    expect(normalizePagination({ page: 1, pageSize: 200 }).pageSize).toBe(100);
  });

  it("正常分页参数原样返回", () => {
    expect(normalizePagination({ page: 3, pageSize: 15 })).toEqual({ page: 3, pageSize: 15 });
  });
});

describe("shared/pagination - calculateOffset", () => {
  it("第 1 页偏移为 0", () => {
    expect(calculateOffset(1, 10)).toBe(0);
  });
  it("第 3 页、每页 10 条偏移为 20", () => {
    expect(calculateOffset(3, 10)).toBe(20);
  });
});

describe("shared/pagination - paginate", () => {
  it("total 为 0 时无上一页/下一页，totalPages 为 0", () => {
    const r = paginate([], 0, 1, 10);
    expect(r.total).toBe(0);
    expect(r.totalPages).toBe(0);
    expect(r.hasNext).toBe(false);
    expect(r.hasPrev).toBe(false);
  });

  it("total=25,pageSize=10,page=1 → totalPages=3, 有下一页无上一页", () => {
    const r = paginate([1, 2], 25, 1, 10);
    expect(r.totalPages).toBe(3);
    expect(r.hasNext).toBe(true);
    expect(r.hasPrev).toBe(false);
    expect(r.records).toHaveLength(2);
  });

  it("末页 → 无下一页有上一页", () => {
    const r = paginate([], 25, 3, 10);
    expect(r.hasNext).toBe(false);
    expect(r.hasPrev).toBe(true);
  });
});

describe("shared/pagination - paginatedQuery", () => {
  it("并发调用 queryFn/countFn 并汇总分页结果", async () => {
    const r = await paginatedQuery(
      async () => [{ id: 1 }, { id: 2 }],
      async () => 25,
      1,
      10
    );
    expect(r.total).toBe(25);
    expect(r.records).toHaveLength(2);
    expect(r.totalPages).toBe(3);
  });
});

describe("shared/pagination - paginatedSearchQuery", () => {
  it("返回分页结果，keyword 仅向下兼容不展开进结果", async () => {
    const r = await paginatedSearchQuery(
      async () => [{ id: 1 }],
      async () => 7,
      2,
      10,
      "茅台"
    );
    expect(r.page).toBe(2);
    expect(r.pageSize).toBe(10);
    expect(r.total).toBe(7);
    expect(r.records).toHaveLength(1);
    expect((r as any).keyword).toBeUndefined();
  });

  it("缺省参数归正为第 1 页每页 20", async () => {
    const r = await paginatedSearchQuery(async () => [], async () => 0, 1, 20);
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(20);
  });
});
